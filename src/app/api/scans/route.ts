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

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin', 'operator');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const eventId = searchParams.get('eventId');
    const result = searchParams.get('result');
    const { startDate, endDate } = parseDateRange(searchParams);

    const where = tenantWhereWith(tenant.organizationId, {});

    if (eventId) (where as Record<string, unknown>).eventId = eventId;
    if (result) (where as Record<string, unknown>).result = result;
    if (startDate || endDate) {
      (where as Record<string, unknown>).createdAt = {} as Record<string, Date>;
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [scans, total] = await Promise.all([
      db.scan.findMany({
        where,
        include: {
          ticket: {
            select: {
              id: true,
              ticketCode: true,
              ticketType: true,
              holderName: true,
              status: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.scan.count({ where }),
    ]);

    return corsResponse({
      data: scans,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function OPTIONS() { return handleCors(); }
