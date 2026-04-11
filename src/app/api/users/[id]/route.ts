import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requireTenantRole } from '@/lib/api-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    // Verify user belongs to same organization
    const targetUser = await db.user.findFirst({
      where: { id, organizationId: tenant.organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
            scans: true,
            events: true,
            transactions: true,
            activityLogs: true,
          },
        },
      },
    });

    if (!targetUser) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    return corsResponse({ user: targetUser });
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;
    const body = await request.json();

    // Verify user belongs to same organization
    const existingUser = await db.user.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existingUser) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    const { name, email, role, isActive } = body;

    // Prevent non-super_admin from changing roles
    if (role && tenant.role !== 'super_admin') {
      return corsResponse({ error: 'Only super admin can change user roles' }, 403);
    }

    // Prevent deactivating super_admin
    if (isActive === false && existingUser.role === 'super_admin') {
      return corsResponse({ error: 'Cannot deactivate super admin' }, 400);
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'user.update',
        details: `Updated user: ${updatedUser.email}`,
      },
    });

    return corsResponse({ user: updatedUser });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    // Verify user belongs to same organization
    const existingUser = await db.user.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existingUser) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    if (existingUser.role === 'super_admin') {
      return corsResponse({ error: 'Cannot deactivate super admin' }, 400);
    }

    const deactivatedUser = await db.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'user.deactivate',
        details: `Deactivated user: ${deactivatedUser.email}`,
      },
    });

    return corsResponse({ user: deactivatedUser });
  });
}

export async function OPTIONS() { return handleCors(); }
