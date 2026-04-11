import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    const { id } = await params;

    const targetUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
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
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { id } = await params;
    const body = await request.json();

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    const { name, email, role, isActive } = body;

    // Prevent non-super_admin from changing roles
    if (role && user.role !== 'super_admin') {
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
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'user.update',
        details: `Updated user: ${updatedUser.email}`,
      },
    });

    return corsResponse({ user: updatedUser });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { id } = await params;

    const existingUser = await db.user.findUnique({ where: { id } });
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
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'user.deactivate',
        details: `Deactivated user: ${deactivatedUser.email}`,
      },
    });

    return corsResponse({ user: deactivatedUser });
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
