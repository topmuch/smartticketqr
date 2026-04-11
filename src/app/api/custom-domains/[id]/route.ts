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
// GET /api/custom-domains/[id] — Get single custom domain
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const domain = await db.customDomain.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!domain) {
      return corsResponse({ error: 'Custom domain not found' }, 404);
    }

    return corsResponse({
      success: true,
      data: domain,
    });
  });
}

// ============================================================
// PUT /api/custom-domains/[id] — Update custom domain
// ============================================================
// Body:
//   { sslStatus?: string, faviconUrl?: string, emailFrom?: string, isActive?: boolean }
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
    const { sslStatus, faviconUrl, emailFrom, isActive } = body;

    const existing = await db.customDomain.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Custom domain not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};

    if (sslStatus !== undefined) {
      const validStatuses = ['pending', 'active', 'failed'];
      if (!validStatuses.includes(sslStatus)) {
        return corsResponse({ error: `sslStatus must be one of: ${validStatuses.join(', ')}` }, 400);
      }
      updateData.sslStatus = sslStatus;
    }

    if (faviconUrl !== undefined) {
      updateData.faviconUrl = typeof faviconUrl === 'string' ? faviconUrl : null;
    }

    if (emailFrom !== undefined) {
      updateData.emailFrom = typeof emailFrom === 'string' ? emailFrom : null;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return corsResponse({ error: 'isActive must be a boolean' }, 400);
      }
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({ error: 'No fields to update. Provide sslStatus, faviconUrl, emailFrom, or isActive.' }, 400);
    }

    const updated = await db.customDomain.update({
      where: { id },
      data: updateData,
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'custom_domain.update',
        details: `Updated custom domain: ${existing.domain}`,
      },
    });

    return corsResponse({
      success: true,
      data: updated,
    });
  });
}

// ============================================================
// DELETE /api/custom-domains/[id] — Remove custom domain
// ============================================================
// Requires admin or super_admin role.
// ============================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    const existing = await db.customDomain.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Custom domain not found' }, 404);
    }

    await db.customDomain.delete({
      where: { id },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'custom_domain.delete',
        details: `Removed custom domain: ${existing.domain}`,
      },
    });

    return corsResponse({
      success: true,
      message: 'Custom domain removed',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
