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
// GET /api/support-tickets/[id] — Get single support ticket
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const ticket = await db.supportTicket.findFirst({
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

    if (!ticket) {
      return corsResponse({ error: 'Support ticket not found' }, 404);
    }

    return corsResponse({
      success: true,
      data: ticket,
    });
  });
}

// ============================================================
// PUT /api/support-tickets/[id] — Update support ticket
// ============================================================
// Body:
//   { status?: string, assignedTo?: string, priority?: string }
//
// status: open, in_progress, resolved, closed
// When status is resolved/closed, resolvedAt is set automatically.
// ============================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;
    const body = await request.json();
    const { status, assignedTo, priority } = body;

    const existing = await db.supportTicket.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Support ticket not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return corsResponse({
          error: `status must be one of: ${validStatuses.join(', ')}`,
        }, 400);
      }
      updateData.status = status;

      // Auto-set resolvedAt when closing
      if ((status === 'resolved' || status === 'closed') && !existing.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
    }

    if (assignedTo !== undefined) {
      if (assignedTo !== null) {
        // Verify the assigned user belongs to the same org
        const userExists = await db.user.findFirst({
          where: {
            id: assignedTo,
            organizationId: tenant.organizationId,
          },
        });
        if (!userExists) {
          return corsResponse({ error: 'Assigned user not found in this organization' }, 400);
        }
      }
      updateData.assignedTo = assignedTo;
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        return corsResponse({
          error: `priority must be one of: ${validPriorities.join(', ')}`,
        }, 400);
      }
      updateData.priority = priority;
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({ error: 'No fields to update. Provide status, assignedTo, or priority.' }, 400);
    }

    const updated = await db.supportTicket.update({
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
        action: 'support_ticket.update',
        details: `Updated support ticket #${id}: ${Object.keys(updateData).join(', ')}`,
      },
    });

    return corsResponse({
      success: true,
      data: updated,
    });
  });
}

// ============================================================
// DELETE /api/support-tickets/[id] — Close/delete support ticket
// ============================================================
// Sets status to "closed" rather than hard-deleting.
// Requires admin or super_admin role.
// ============================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    const existing = await db.supportTicket.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Support ticket not found' }, 404);
    }

    await db.supportTicket.update({
      where: { id },
      data: {
        status: 'closed',
        resolvedAt: existing.resolvedAt || new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'support_ticket.close',
        details: `Closed support ticket #${id}: ${existing.subject}`,
      },
    });

    return corsResponse({
      success: true,
      message: 'Support ticket closed',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
