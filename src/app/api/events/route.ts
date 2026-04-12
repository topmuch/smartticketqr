import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, parsePagination, requireTenantRole, tenantWhereWith } from '@/lib/api-helper';
import { checkLimit } from '@/lib/subscription-manager';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where = tenantWhereWith(tenant.organizationId, {});

    if (type) (where as Record<string, unknown>).type = type;
    if (status) (where as Record<string, unknown>).status = status;
    if (search) {
      (where as Record<string, unknown>).OR = [
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
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { name, type, description, location, startDate, endDate, totalTickets, price, currency, status } = body;

    if (!name || !startDate || !endDate || price === undefined) {
      return corsResponse({ error: 'Name, startDate, endDate, and price are required' }, 400);
    }

    // Check subscription limit for events
    const limitCheck = await checkLimit(tenant.organizationId, 'events');
    if (!limitCheck.allowed) {
      return corsResponse({ error: limitCheck.reason, limit: limitCheck, needsUpgrade: true }, 403);
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
        userId: tenant.userId,
        organizationId: tenant.organizationId,
      },
      include: {
        _count: { select: { tickets: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'event.create',
        details: `Created event: ${event.name}`,
      },
    });

    return corsResponse({ event }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
