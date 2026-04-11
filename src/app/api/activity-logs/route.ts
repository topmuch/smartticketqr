import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, parsePagination, parseDateRange, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const { startDate, endDate } = parseDateRange(searchParams);

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {} as Record<string, Date>;
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
