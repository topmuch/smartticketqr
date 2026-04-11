import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';
import { revokeApiKey } from '@/lib/api-key-auth';

// ============================================================
// GET /api/api-keys/[id] — Get single API key details
// ============================================================
// Never returns keyHash. Returns keyPrefix, permissions, usage stats.
// ============================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const apiKey = await db.apiKey.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
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
    });

    if (!apiKey) {
      return corsResponse({ error: 'API key not found' }, 404);
    }

    return corsResponse({
      success: true,
      data: {
        ...apiKey,
        lastUsedAt: apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : null,
        expiresAt: apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
        createdAt: apiKey.createdAt.toISOString(),
      },
    });
  });
}

// ============================================================
// PUT /api/api-keys/[id] — Update API key
// ============================================================
// Updatable fields: name, permissions, rateLimit
// Cannot update: keyHash, keyPrefix, isActive (use DELETE to revoke)
// ============================================================

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;
    const body = await request.json();
    const { name, permissions, rateLimit } = body;

    // Verify the API key belongs to this organization
    const existingKey = await db.apiKey.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existingKey) {
      return corsResponse({ error: 'API key not found' }, 404);
    }

    if (!existingKey.isActive) {
      return corsResponse({ error: 'Cannot update a revoked API key' }, 400);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return corsResponse({ error: 'API key name must be a non-empty string' }, 400);
      }
      updateData.name = name.trim();
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return corsResponse({ error: 'Permissions must be a non-empty array (e.g. ["read", "write"])' }, 400);
      }
      updateData.permissions = JSON.stringify(permissions);
    }

    if (rateLimit !== undefined) {
      if (typeof rateLimit !== 'number' || rateLimit <= 0) {
        return corsResponse({ error: 'Rate limit must be a positive number' }, 400);
      }
      updateData.rateLimit = Math.min(rateLimit, 10000);
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({ error: 'No fields to update. Provide name, permissions, or rateLimit.' }, 400);
    }

    const updatedKey = await db.apiKey.update({
      where: { id },
      data: updateData,
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
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'apikey.update',
        details: `Updated API key: ${updatedKey.name} (${updatedKey.keyPrefix})`,
      },
    });

    return corsResponse({
      success: true,
      data: {
        ...updatedKey,
        lastUsedAt: updatedKey.lastUsedAt ? updatedKey.lastUsedAt.toISOString() : null,
        expiresAt: updatedKey.expiresAt ? updatedKey.expiresAt.toISOString() : null,
        createdAt: updatedKey.createdAt.toISOString(),
      },
    });
  });
}

// ============================================================
// DELETE /api/api-keys/[id] — Revoke an API key
// ============================================================
// Does NOT actually delete the record. Sets isActive = false.
// This preserves the audit trail and prevents key reuse.
// ============================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    // Verify the API key belongs to this organization
    const existingKey = await db.apiKey.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existingKey) {
      return corsResponse({ error: 'API key not found' }, 404);
    }

    if (!existingKey.isActive) {
      return corsResponse({ error: 'API key is already revoked' }, 400);
    }

    await revokeApiKey(id);

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'apikey.revoke',
        details: `Revoked API key: ${existingKey.name} (${existingKey.keyPrefix})`,
      },
    });

    return corsResponse({
      success: true,
      message: 'API key revoked',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
