import { NextRequest, NextResponse } from 'next/server';
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
// ERROR HANDLER (sanitized for production)
// ============================================================

export async function withErrorHandler(fn: () => Promise<NextResponse | Response>): Promise<NextResponse | Response> {
  try {
    return await fn();
  } catch (error) {
    console.error('[Tenant API Error]', error);

    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Internal server error');

    return corsResponse({ error: message }, 500);
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
