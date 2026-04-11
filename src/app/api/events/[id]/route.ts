import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        _count: { select: { tickets: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!event) {
      return corsResponse({ error: 'Event not found' }, 404);
    }

    // Get ticket status breakdown
    const ticketStats = await db.ticket.groupBy({
      by: ['status'],
      where: { eventId: id },
      _count: true,
    });

    return corsResponse({
      ...event,
      ticketStats: ticketStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
    });
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { id } = await params;
    const body = await request.json();

    const existingEvent = await db.event.findUnique({ where: { id } });
    if (!existingEvent) {
      return corsResponse({ error: 'Event not found' }, 404);
    }

    const { name, type, description, location, startDate, endDate, totalTickets, price, currency, status } = body;

    const event = await db.event.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(totalTickets !== undefined && { totalTickets }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(currency && { currency }),
        ...(status && { status }),
      },
      include: {
        _count: { select: { tickets: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'event.update',
        details: `Updated event: ${event.name}`,
      },
    });

    return corsResponse({ event });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { id } = await params;

    const existingEvent = await db.event.findUnique({ where: { id } });
    if (!existingEvent) {
      return corsResponse({ error: 'Event not found' }, 404);
    }

    // Soft delete
    const event = await db.event.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        _count: { select: { tickets: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'event.delete',
        details: `Cancelled event: ${event.name}`,
      },
    });

    return corsResponse({ event });
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
