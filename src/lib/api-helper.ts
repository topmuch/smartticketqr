import { NextRequest, NextResponse } from 'next/server';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
} from '@prisma/client/runtime/library';
import { verifyToken, type JWTPayload } from '@/lib/auth';
import { PERMISSION_MATRIX, type Permission } from './permissions';

// ============================================================
// 🔐 TENANT ISOLATION MIDDLEWARE
// ============================================================
// Reads organization_id from the JWT payload ONLY (never trusts
// client-supplied headers). EVERY API route MUST call resolveTenant()
// before any DB query. This prevents IDOR attacks.
// ============================================================

export interface TenantContext {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

/**
 * Extracts and validates the tenant context from a request.
 * Returns null if authentication or tenant resolution fails.
 *
 * Flow:
 *  1. Verify JWT from Authorization header
 *  2. Extract organizationId from JWT payload (server-verified)
 *  3. Optionally: verify X-Organization-Id header matches JWT
 *  4. Return TenantContext with all required IDs
 *
 * ⚠️ SECURITY: organizationId is NEVER taken from client headers.
 *    It is exclusively sourced from the JWT payload which was signed
 *    by our server. This prevents IDOR (Insecure Direct Object Reference).
 */
export function resolveTenant(request: NextRequest): TenantContext | NextResponse {
  // Step 1: Verify JWT token
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Authentication required', 401);
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return errorResponse('Invalid or expired token', 401);
  }

  // Step 2: Extract organizationId from JWT (server-signed, tamper-proof)
  if (!payload.organizationId) {
    return errorResponse('Token missing organization context', 401);
  }

  const organizationId = payload.organizationId;

  // Step 3 (defensive): If client sends X-Organization-Id, verify it matches.
  // This catches frontend bugs where the wrong org is selected in the UI.
  const clientOrgId = request.headers.get('x-organization-id');
  if (clientOrgId && clientOrgId !== organizationId) {
    return errorResponse('Organization mismatch — access denied', 403);
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId,
  };
}

/**
 * Strict version: resolves tenant AND enforces minimum role.
 * Use this for admin-only endpoints.
 */
export function requireTenantRole(request: NextRequest, ...roles: string[]): TenantContext | NextResponse {
  const tenant = resolveTenant(request);
  if (isErrorResponse(tenant)) return tenant;

  if (!roles.includes(tenant.role)) {
    return errorResponse('Insufficient permissions for this organization', 403);
  }

  return tenant;
}

// ============================================================
// HELPERS
// ============================================================

/** Check if result is an error response (NextResponse) */
export function isErrorResponse(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}

/** Create a JSON error response with CORS headers */
function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id',
      },
    }
  );
}

// ============================================================
// CORS HEADERS (restricted origins)
// ============================================================
// In production, only allow the configured domain.
// In development, allow all origins for local testing.
// ============================================================

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : []; // Empty = use default per-env behavior

/** Get the allowed origin for the current request */
function getAllowedOrigin(requestOrigin: string | null): string {
  // Production: strict origin checking
  if (process.env.NODE_ENV === 'production') {
    if (ALLOWED_ORIGINS.length > 0 && requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
      return requestOrigin;
    }
    // If CORS_ORIGINS is not configured, allow the first ALLOWED_ORIGINS or fall back to request origin
    return ALLOWED_ORIGINS[0] || requestOrigin || '';
  }

  // Development: allow all origins
  return '*';
}

export function getCorsHeaders(origin: string | null = null): Record<string, string> {
  const allowed = getAllowedOrigin(origin);
  return {
    ...(allowed !== '*' && { 'Access-Control-Allow-Origin': allowed }),
    ...(allowed === '*' && { 'Access-Control-Allow-Origin': '*' }),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id',
    ...(allowed !== '*' && { 'Vary': 'Origin' }),
  };
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id',
};

export function corsResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function handleCors(request?: NextRequest) {
  if (request) {
    const origin = request.headers.get('origin');
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ============================================================
// PAGINATION
// ============================================================

export function parsePagination(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  return { page, limit };
}

// ============================================================
// TENANT-AWARE QUERY BUILDERS
// ============================================================
// These helper functions ensure EVERY query includes organization_id
// to prevent cross-tenant data leakage (IDOR protection).
// ============================================================

/**
 * Returns a Prisma WHERE clause that filters by organization_id.
 * Use this in EVERY findMany, findFirst, update, delete, etc.
 */
export function tenantWhere(organizationId: string) {
  return { organizationId };
}

/**
 * Returns a Prisma WHERE clause with organization_id + optional additional filters.
 * Merges the tenant filter with any custom filters.
 */
export function tenantWhereWith(
  organizationId: string,
  additionalFilters: Record<string, unknown>
) {
  return { ...additionalFilters, organizationId };
}

// ============================================================
// ERROR HANDLER (production-grade, context-aware, Prisma-safe)
// ============================================================
// Usage:
//   withErrorHandler('create-ticket', async () => { ... })
//   withErrorHandler(async () => { ... })             // context is optional
//
// Guarantees:
//  • Stack traces are NEVER sent to the client.
//  • Prisma errors are mapped to generic, user-friendly messages
//    even in development (no raw SQL / table names leak).
//  • Production always returns "Internal server error".
//  • Rate-limit (429) errors automatically include a Retry-After header.
//  • Full stack + context are always logged server-side for debugging.
// ============================================================

/**
 * Map Prisma error codes to safe, user-facing messages.
 * These intentionally avoid exposing database internals.
 */
const PRISMA_ERROR_MAP: Record<string, string> = {
  P2002: 'A record with this value already exists',           // unique constraint
  P2003: 'Referenced record not found',                       // foreign key constraint
  P2004: 'A constraint on the database failed',               // constraint violation
  P2005: 'Invalid value provided for a field',                // bad field value
  P2006: 'Invalid value provided — data could not be stored', // bad input data
  P2007: 'Data validation error',                             // data validation
  P2008: 'Failed to parse the query',                         // query parsing
  P2009: 'Query validation error',                            // query validation
  P2010: 'Raw query returned an unexpected result',           // raw query
  P2011: 'Null constraint violation',                         // null constraint
  P2012: 'Missing required value for a field',                // missing value
  P2013: 'Missing required argument',                         // missing arg
  P2014: 'Invalid related record change would break relation', // relation error
  P2015: 'Related record not found',                          // related record
  P2016: 'Query interpretation error',                        // query error
  P2017: 'Maximum query depth exceeded',                      // query depth
  P2018: 'Related records not connected',                     // relation
  P2019: 'Input error',                                       // general input
  P2020: 'Value out of range for field',                      // out of range
  P2021: 'Table not found in database',                       // table missing
  P2022: 'Column not found in database',                      // column missing
  P2023: 'Inconsistent column data',                          // column mismatch
  P2024: 'Timed out fetching a new connection from pool',     // connection pool
  P2025: 'Record not found',                                  // not found
  P2026: 'Current transaction is already committed',           // transaction
  P2027: 'Multiple fields with conflicting defaults',          // defaults
  P2028: 'Transaction API error',                             // tx API
  P2030: 'Full-text search failed',                           // full-text
  P2033: 'Tuple comparison failed',                           // tuple
  P2034: 'Transaction failed due to concurrent write',         // write conflict
  P2035: 'Referenced row not found for update/delete',        // cascading
  P2036: 'Foreign key constraint failed on update/delete',    // FK violation
  P2037: 'Interactive transaction error',                     // interactive tx
  P2038: 'Max 64 transaction parameters exceeded',            // tx params
  P2039: 'Transaction already closed',                        // tx closed
  P2040: 'Error serializing a DateTime value',                // datetime
  P2041: 'Unable to acquire lock on table',                   // lock
  P2042: 'Unable to acquire lock on row',                     // row lock
  P2043: 'Lock on table already acquired',                    // table lock
  P2044: 'Lock on row already acquired',                      // row lock
  P2045: 'Unable to release a lock',                          // release
  P2046: 'Transaction already closed',                        // tx closed
  P2047: 'Unable to acquire lock on a connection pool',       // pool lock
  P2048: 'Unable to acquire lock on a connection',            // conn lock
  P2049: 'Timed out waiting to acquire a lock',               // lock timeout
  P2050: 'Unable to acquire a transaction',                   // acquire tx
  P2051: 'Unable to commit a transaction',                    // commit tx
  P2052: 'Unable to rollback a transaction',                  // rollback tx
  P2053: 'Unable to create a savepoint',                      // savepoint
  P2054: 'Unable to release a savepoint',                     // release savepoint
  P2055: 'Unable to rollback to a savepoint',                 // rollback savepoint
  P2056: 'Unable to start a transaction',                     // start tx
  P2057: 'Maximum 64 savepoints exceeded',                    // savepoint limit
  P2058: 'Transaction already in progress',                   // tx progress
  P2059: 'Unable to set savepoint isolation level',           // isolation
  P2060: 'Unable to set transaction isolation level',         // isolation
  P2061: 'Unable to acquire advisory lock',                   // advisory lock
  P2062: 'Unable to release advisory lock',                   // advisory lock
  P2063: 'Unable to execute raw query in transaction',        // raw query
  P2064: 'Unable to execute raw query',                       // raw query
  P2065: 'Unable to run function in interactive transaction', // interactive tx fn
  P2066: 'Unable to run a query in an interactive transaction', // interactive tx query
  P2067: 'Query returned no result',                          // no result
  P2068: 'Query returned multiple results',                   // multiple results
  P3000: 'Failed to create database',                         // db create
  P3001: 'Failed to delete database',                         // db delete
  P3002: 'Failed to migrate database',                        // migration
  P3003: 'Failed to apply migration',                         // apply migration
  P3004: 'Failed to rollback migration',                      // rollback
  P3005: 'Failed to reset database',                          // reset
  P3006: 'Failed to restore database from file',              // restore
  P3007: 'Failed to resolve database URL',                    // URL
  P3008: 'Failed to create database file',                    // file
  P3009: 'Failed to get migrate progress',                    // progress
  P3010: 'Failed to introspect database',                     // introspect
  P3011: 'Failed to get migration progress',                  // migration progress
  P3012: 'Failed to mark migration as applied',               // mark applied
  P3013: 'Failed to mark migration as rolled back',           // mark rollback
  P3014: 'Failed to get migration ID',                        // migration ID
  P3015: 'Failed to apply migration',                         // apply
  P3016: 'Failed to apply migration',                         // apply
  P3017: 'Failed to apply migration',                         // apply
  P3018: 'Failed to apply migration',                         // apply
  P3019: 'Failed to apply migration',                         // apply
  P3020: 'Failed to rollback migration',                      // rollback
  P3021: 'Failed to create database proxy',                   // proxy
};

const DEFAULT_PRISMA_MESSAGE = 'A database error occurred';

/**
 * Detect Prisma errors and return a safe, user-facing message.
 * This runs regardless of NODE_ENV — Prisma internals never leak.
 */
function classifyPrismaError(error: unknown): { message: string; status: number } | null {
  if (error instanceof PrismaClientKnownRequestError) {
    const userMessage = PRISMA_ERROR_MAP[error.code] ?? DEFAULT_PRISMA_MESSAGE;
    // P2024 = pool timeout → 503 so the client can retry
    // P2034 = write conflict → 409 so the client knows to retry
    // P2025 = not found → 404
    const statusMap: Record<string, number> = {
      P2002: 409, // conflict
      P2003: 400, // bad request (FK)
      P2005: 400,
      P2006: 400,
      P2007: 400,
      P2008: 400,
      P2009: 400,
      P2011: 400,
      P2012: 400,
      P2013: 400,
      P2020: 400,
      P2024: 503,
      P2025: 404,
      P2034: 409,
      P2036: 400,
      P2041: 423,
      P2042: 423,
      P2043: 423,
      P2044: 423,
      P2049: 423,
    };
    return { message: userMessage, status: statusMap[error.code] ?? 500 };
  }

  if (error instanceof PrismaClientValidationError) {
    return { message: 'Invalid request data', status: 400 };
  }

  if (error instanceof PrismaClientInitializationError) {
    return { message: 'Database is temporarily unavailable', status: 503 };
  }

  if (error instanceof PrismaClientRustPanicError) {
    return { message: DEFAULT_PRISMA_MESSAGE, status: 500 };
  }

  return null;
}

/**
 * Detect if an error represents a rate-limit response.
 * Supports errors that carry status 429 or an explicit `retryAfter` property.
 */
function classifyRateLimitError(
  error: unknown
): { retryAfterSeconds: number } | null {
  // HTTPError-like shape (fetch, axios, etc.)
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if ('status' in e && e.status === 429) {
      const retryAfter = typeof e.retryAfter === 'number'
        ? e.retryAfter
        : 60; // default 60s
      return { retryAfterSeconds: Math.max(1, retryAfter) };
    }
    if ('retryAfter' in e && typeof e.retryAfter === 'number') {
      return { retryAfterSeconds: Math.max(1, e.retryAfter as number) };
    }
  }
  return null;
}

export interface ErrorHandlerOptions {
  /** A short tag identifying the operation, e.g. 'create-ticket', 'validate-scan'. */
  context?: string;
}

export async function withErrorHandler(
  fnOrContext: (() => Promise<NextResponse | Response>) | ErrorHandlerOptions,
  fnMaybe?: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  // Support two calling conventions:
  //   withErrorHandler('ctx', fn)   — with context
  //   withErrorHandler(fn)           — context omitted
  let handler: () => Promise<NextResponse | Response>;
  let context: string | undefined;

  if (typeof fnOrContext === 'function') {
    handler = fnOrContext;
  } else {
    context = fnOrContext.context;
    handler = fnMaybe!;
  }

  try {
    return await handler();
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production';
    const tag = context ? `[${context}]` : '[Unhandled]';
    const stack = error instanceof Error ? error.stack : undefined;

    // ── 1. Prisma errors: always safe, never leak internals ────────
    const prismaResult = classifyPrismaError(error);
    if (prismaResult) {
      console.error(
        `\x1b[33m[Prisma Error] ${tag}\x1b[0m\n` +
        `  Code: ${error instanceof PrismaClientKnownRequestError ? (error as PrismaClientKnownRequestError).code : 'N/A'}\n` +
        `  Client message: ${prismaResult.message}\n` +
        (stack ? `  Stack:\n${stack}\n` : '')
      );

      const clientMessage = isProduction ? 'Internal server error' : prismaResult.message;
      return corsResponse({ error: clientMessage }, prismaResult.status);
    }

    // ── 2. Rate-limit errors: 429 + Retry-After header ─────────────
    const rateLimit = classifyRateLimitError(error);
    if (rateLimit) {
      console.error(
        `\x1b[33m[Rate Limit] ${tag} — retry after ${rateLimit.retryAfterSeconds}s\x1b[0m\n` +
        (stack ? `  Stack:\n${stack}\n` : '')
      );

      return NextResponse.json(
        { error: isProduction ? 'Too many requests' : `Rate limited — retry after ${rateLimit.retryAfterSeconds}s` },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // ── 3. Generic / unknown errors ─────────────────────────────────
    // Log full stack to server console (both dev & prod) for debugging.
    console.error(
      `\x1b[31m[API Error] ${tag}\x1b[0m\n` +
      `  Raw error: ${error instanceof Error ? error.message : String(error)}\n` +
      (stack ? `  Stack:\n${stack}\n` : '')
    );

    // In production, NEVER reveal the raw message.
    // In development, show the message for faster debugging — but never the stack.
    const clientMessage = isProduction
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Internal server error');

    return corsResponse({ error: clientMessage }, 500);
  }
}

// ============================================================
// SUBSCRIPTION PLAN LIMITS
// ============================================================

export const PLAN_LIMITS: Record<string, { maxEvents: number; maxTicketsPerEvent: number; maxUsers: number }> = {
  starter: { maxEvents: 5, maxTicketsPerEvent: 500, maxUsers: 3 },
  pro: { maxEvents: 50, maxTicketsPerEvent: 5000, maxUsers: 20 },
  enterprise: { maxEvents: 999, maxTicketsPerEvent: 100000, maxUsers: 999 },
};

export function checkSubscriptionLimit(
  plan: string,
  current: number,
  limitType: 'maxEvents' | 'maxTicketsPerEvent' | 'maxUsers'
): { allowed: boolean; limit: number } {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  const limit = limits[limitType];
  return { allowed: current < limit, limit };
}

// ============================================================
// RBAC PERMISSION CHECK
// ============================================================

/**
 * Check if a tenant has a specific permission.
 * Super admin always has all permissions.
 * Client roles are checked against the PERMISSION_MATRIX.
 */
export function requirePermission(
  tenant: TenantContext,
  permission: Permission
): TenantContext | NextResponse {
  // Super admin bypasses all permission checks
  if (tenant.role === 'super_admin') return tenant;

  // Check if role has the required permission
  const rolePermissions = PERMISSION_MATRIX[tenant.role as keyof typeof PERMISSION_MATRIX];
  if (!rolePermissions || !rolePermissions.includes(permission)) {
    return errorResponse(`Permission denied: ${permission} required`, 403);
  }

  return tenant;
}

/**
 * Check if a tenant has any of the specified permissions.
 * Returns tenant if at least one permission is granted.
 */
export function requireAnyPermission(
  tenant: TenantContext,
  permissions: Permission[]
): TenantContext | NextResponse {
  // Super admin bypasses all permission checks
  if (tenant.role === 'super_admin') return tenant;

  const rolePermissions = PERMISSION_MATRIX[tenant.role as keyof typeof PERMISSION_MATRIX];
  if (!rolePermissions || !permissions.some((p) => rolePermissions.includes(p))) {
    return errorResponse(`Permission denied: one of [${permissions.join(', ')}] required`, 403);
  }

  return tenant;
}
