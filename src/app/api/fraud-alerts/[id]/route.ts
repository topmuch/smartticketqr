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
// GET /api/fraud-alerts/[id] — Get single fraud alert
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const alert = await db.fraudAlert.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!alert) {
      return corsResponse({ error: 'Fraud alert not found' }, 404);
    }

    return corsResponse({
      success: true,
      data: alert,
    });
  });
}

// ============================================================
// PUT /api/fraud-alerts/[id] — Review/update fraud alert
// ============================================================
// Body:
//   { status?: string, reviewedBy?: string }
//
// status: flagged, reviewed, dismissed, blocked
// When status changes from flagged, reviewedAt is set automatically.
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
    const { status, reviewedBy } = body;

    const existing = await db.fraudAlert.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Fraud alert not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      const validStatuses = ['flagged', 'reviewed', 'dismissed', 'blocked'];
      if (!validStatuses.includes(status)) {
        return corsResponse({
          error: `status must be one of: ${validStatuses.join(', ')}`,
        }, 400);
      }
      updateData.status = status;

      // Auto-set reviewedAt and reviewedBy when status changes from flagged
      if (status !== 'flagged' && existing.status === 'flagged') {
        updateData.reviewedAt = new Date();
        updateData.reviewedBy = reviewedBy || tenant.userId;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({ error: 'No fields to update. Provide status or reviewedBy.' }, 400);
    }

    const updated = await db.fraudAlert.update({
      where: { id },
      data: updateData,
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'fraud_alert.update',
        details: `Updated fraud alert ${id}: status=${updated.status}`,
      },
    });

    return corsResponse({
      success: true,
      data: updated,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
