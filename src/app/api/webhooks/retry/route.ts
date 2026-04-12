import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';

// ============================================================
// POST /api/webhooks/retry — Retry a failed webhook delivery
// ============================================================
// Body: { logId: string }
//
// Resets the log entry to 'pending' status with 0 attempts
// and nextRetryAt set to now, making it immediately eligible
// for processing by the webhook queue.
//
// Requires admin or super_admin role.
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { logId } = body;

    if (!logId || typeof logId !== 'string') {
      return corsResponse({ error: 'logId is required' }, 400);
    }

    // Find the log entry scoped to the tenant's organization
    const log = await db.webhookLog.findFirst({
      where: {
        id: logId,
        organizationId: tenant.organizationId,
      },
      select: {
        id: true,
        status: true,
        endpointId: true,
      },
    });

    if (!log) {
      return corsResponse({ error: 'Webhook log not found' }, 404);
    }

    // Reset the log for retry
    const updated = await db.webhookLog.update({
      where: { id: log.id },
      data: {
        status: 'pending',
        attempts: 0,
        nextRetryAt: new Date(),
        httpStatus: null,
        responseBody: null,
      },
    });

    return corsResponse({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        nextRetryAt: updated.nextRetryAt,
      },
      message: 'Webhook queued for retry',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
