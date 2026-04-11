import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, parsePagination, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        include: {
          _count: { select: { tickets: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.event.count({ where }),
    ]);

    return corsResponse({
      data: events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const body = await request.json();
    const { name, type, description, location, startDate, endDate, totalTickets, price, currency, status } = body;

    if (!name || !startDate || !endDate || price === undefined) {
      return corsResponse({ error: 'Name, startDate, endDate, and price are required' }, 400);
    }

    const event = await db.event.create({
      data: {
        name,
        type: type || 'event',
        description,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalTickets: totalTickets || 100,
        price: parseFloat(price),
        currency: currency || 'USD',
        status: status || 'active',
        userId: user.userId,
      },
      include: {
        _count: { select: { tickets: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'event.create',
        details: `Created event: ${event.name}`,
      },
    });

    return corsResponse({ event }, 201);
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
