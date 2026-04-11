import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

/**
 * GET /api/audit-logs — List audit logs (admin+ only).
 *
 * Query params:
 *   action   — filter by action type
 *   severity — filter by severity (info, warning, critical)
 *   userId   — filter by userId
 *   from     — date range start (createdAt >= from)
 *   to       — date range end (createdAt <= to)
 *   page     — pagination page (default: 1)
 *   limit    — pagination limit (default: 10)
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const action = searchParams.get('action');
    const severity = searchParams.get('severity');
    const userId = searchParams.get('userId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build where clause — always filter by organization
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    if (action) where.action = action;
    if (severity) where.severity = severity;
    if (userId) where.userId = userId;

    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    // Parse JSON details back to objects
    const enrichedLogs = logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }));

    return corsResponse({
      data: enrichedLogs,
      pagination: {
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
