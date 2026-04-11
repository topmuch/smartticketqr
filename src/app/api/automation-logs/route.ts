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
// GET /api/automation-logs — List automation logs with filters
// ============================================================
// Query params:
//   ?page=1&limit=20
//   ?status=pending|sent|failed|skipped
//   ?channel=whatsapp|sms|email
//   ?ruleId=xxx
//   ?from=2025-01-01&to=2025-06-30
//
// Tenant-isolated by organizationId.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    // Filter by status
    const status = searchParams.get('status');
    if (status && ['pending', 'sent', 'failed', 'skipped'].includes(status)) {
      where.status = status;
    }

    // Filter by channel
    const channel = searchParams.get('channel');
    if (channel && ['whatsapp', 'sms', 'email'].includes(channel)) {
      where.channel = channel;
    }

    // Filter by ruleId
    const ruleId = searchParams.get('ruleId');
    if (ruleId) {
      where.ruleId = ruleId;
    }

    // Filter by date range
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from || to) {
      const createdAt: Record<string, unknown> = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          createdAt.gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          // Set to end of day
          toDate.setHours(23, 59, 59, 999);
          createdAt.lte = toDate;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    const [logs, total] = await Promise.all([
      db.automationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.automationLog.count({ where }),
    ]);

    return corsResponse({
      success: true,
      data: logs,
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
