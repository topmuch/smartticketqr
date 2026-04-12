import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  tenantWhereWith,
} from '@/lib/api-helper';
import { generateApiKey } from '@/lib/api-key-auth';

// ============================================================
// GET /api/api-keys — List API keys for current org
// ============================================================
// Query params:
//   ?status=active   — only active keys
//   ?status=revoked  — only revoked keys
//   (default: all keys)
//
// Returns keys with keyPrefix (NEVER keyHash).
// ============================================================

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = tenantWhereWith(tenant.organizationId, {});

    if (status === 'active') {
      (where as Record<string, unknown>).isActive = true;
    } else if (status === 'revoked') {
      (where as Record<string, unknown>).isActive = false;
    }

    const apiKeys = await db.apiKey.findMany({
      where,
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        permissions: true,
        rateLimit: true,
        lastUsedAt: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedKeys = apiKeys.map((key) => ({
      ...key,
      lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
      expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
      createdAt: key.createdAt.toISOString(),
    }));

    return corsResponse({
      success: true,
      data: formattedKeys,
    });
  });
}

// ============================================================
// POST /api/api-keys — Create a new API key
// ============================================================
// Body:
//   { name: string, permissions?: string[], rateLimit?: number, expiresAt?: string }
//
// IMPORTANT: The raw key is returned ONLY ONCE in the response.
// It cannot be retrieved again after creation.
//
// Requires: admin or super_admin role
// ============================================================

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { name, permissions, rateLimit, expiresAt } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return corsResponse({ error: 'API key name is required' }, 400);
    }

    const parsedPermissions = Array.isArray(permissions) && permissions.length > 0
      ? permissions
      : ['read'];

    const parsedRateLimit = typeof rateLimit === 'number' && rateLimit > 0
      ? Math.min(rateLimit, 10000)
      : 100;

    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : undefined;

    if (parsedExpiresAt && isNaN(parsedExpiresAt.getTime())) {
      return corsResponse({ error: 'Invalid expiresAt date format' }, 400);
    }

    // Generate the API key using the library (creates DB record + returns raw key once)
    const result = await generateApiKey(
      'stq_live',
      tenant.organizationId,
      name.trim(),
      {
        permissions: parsedPermissions,
        rateLimit: parsedRateLimit,
        expiresAt: parsedExpiresAt,
      }
    );

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'apikey.create',
        details: `Created API key: ${result.name} (${result.keyPrefix})`,
      },
    });

    return corsResponse({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        keyPrefix: result.keyPrefix,
        rawKey: result.rawKey,
        permissions: result.permissions,
        rateLimit: result.rateLimit,
        expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
      },
      message: 'Save this key now — it won\'t be shown again',
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
