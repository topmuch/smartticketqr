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

// ============================================================
// GET /api/affiliates/[id] — Get affiliate details
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const affiliate = await db.affiliate.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!affiliate) {
      return corsResponse({ error: 'Affiliate not found' }, 404);
    }

    return corsResponse({
      success: true,
      data: affiliate,
    });
  });
}

// ============================================================
// PUT /api/affiliates/[id] — Update affiliate
// ============================================================
// Body:
//   { commissionRate?: number, isActive?: boolean }
//
// Requires admin or super_admin role.
// ============================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;
    const body = await request.json();
    const { commissionRate, isActive } = body;

    const existing = await db.affiliate.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Affiliate not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};

    if (commissionRate !== undefined) {
      if (typeof commissionRate !== 'number' || commissionRate < 0) {
        return corsResponse({ error: 'commissionRate must be a non-negative number (max 50)' }, 400);
      }
      updateData.commissionRate = Math.min(commissionRate, 50);
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return corsResponse({ error: 'isActive must be a boolean' }, 400);
      }
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({ error: 'No fields to update. Provide commissionRate or isActive.' }, 400);
    }

    const updated = await db.affiliate.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'affiliate.update',
        details: `Updated affiliate ${existing.code}: ${Object.keys(updateData).join(', ')}`,
      },
    });

    return corsResponse({
      success: true,
      data: updated,
    });
  });
}

// ============================================================
// DELETE /api/affiliates/[id] — Deactivate affiliate
// ============================================================
// Sets isActive to false rather than hard-deleting.
// Requires admin or super_admin role.
// ============================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    const existing = await db.affiliate.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Affiliate not found' }, 404);
    }

    if (!existing.isActive) {
      return corsResponse({ error: 'Affiliate is already deactivated' }, 400);
    }

    await db.affiliate.update({
      where: { id },
      data: { isActive: false },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'affiliate.deactivate',
        details: `Deactivated affiliate ${existing.code}`,
      },
    });

    return corsResponse({
      success: true,
      message: 'Affiliate deactivated',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
