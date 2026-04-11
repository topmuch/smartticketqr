import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, parsePagination, parseDateRange, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin', 'operator');
    if (isErrorResponse(authCheck)) return authCheck;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const eventId = searchParams.get('eventId');
    const result = searchParams.get('result');
    const { startDate, endDate } = parseDateRange(searchParams);

    const where: Record<string, unknown> = {};

    if (eventId) where.eventId = eventId;
    if (result) where.result = result;
    if (startDate || endDate) {
      where.createdAt = {} as Record<string, Date>;
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
