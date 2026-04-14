import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, parsePagination, requireTenantRole, tenantWhereWith } from '@/lib/api-helper';

function parseDateRange(searchParams: URLSearchParams): { startDate?: Date; endDate?: Date } {
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  return {
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined,
  };
}

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const { startDate, endDate } = parseDateRange(searchParams);

    const where: Record<string, unknown> = tenantWhereWith(tenant.organizationId, {});

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
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
      db.activityLog.count({ where }),
    ]);

    return corsResponse({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function OPTIONS() { return handleCors(); }
