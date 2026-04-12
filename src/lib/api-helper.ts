import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, type JWTPayload } from '@/lib/auth';

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
// CORS HEADERS (updated with X-Organization-Id)
// ============================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id',
};

export function corsResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function handleCors() {
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

export async function withErrorHandler(fn: () => Promise<NextResponse>): Promise<NextResponse> {
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
