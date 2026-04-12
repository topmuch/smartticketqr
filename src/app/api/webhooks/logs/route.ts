import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

// ============================================================
// GET /api/webhooks/logs — List webhook delivery logs
// ============================================================
// Query params:
//   ?status=pending|delivered|failed
//   ?eventType=ticket.validated
//   ?endpointId=xxx
//   ?page=1&limit=20
//
// Returns paginated logs with endpoint URL (joined).
// Tenant-isolated by organizationId.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    // Build where clause with optional filters
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    // Filter by status
    const status = searchParams.get('status');
    if (status && ['pending', 'delivered', 'failed'].includes(status)) {
      where.status = status;
    }

    // Filter by eventType
    const eventType = searchParams.get('eventType');
    if (eventType) {
      where.eventType = eventType;
    }

    // Filter by endpointId
    const endpointId = searchParams.get('endpointId');
    if (endpointId) {
      where.endpointId = endpointId;
    }

    const [logs, total] = await Promise.all([
      db.webhookLog.findMany({
        where,
        select: {
          id: true,
          endpointId: true,
          eventType: true,
          httpStatus: true,
          attempts: true,
          status: true,
          nextRetryAt: true,
          createdAt: true,
          endpoint: {
            select: {
              url: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.webhookLog.count({ where }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      endpointId: log.endpointId,
      endpointUrl: log.endpoint.url,
      eventType: log.eventType,
      httpStatus: log.httpStatus,
      attempts: log.attempts,
      status: log.status,
      createdAt: log.createdAt,
      nextRetryAt: log.nextRetryAt,
    }));

    return corsResponse({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
