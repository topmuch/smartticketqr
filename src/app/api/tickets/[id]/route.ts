import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    const { id } = await params;

    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        event: true,
        user: { select: { id: true, name: true, email: true } },
        scans: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        transactions: true,
      },
    });

    if (!ticket) {
      return corsResponse({ error: 'Ticket not found' }, 404);
    }

    return corsResponse({ ticket });
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    const { id } = await params;
    const body = await request.json();

    const existingTicket = await db.ticket.findUnique({ where: { id } });
    if (!existingTicket) {
      return corsResponse({ error: 'Ticket not found' }, 404);
    }

    if (existingTicket.status === 'used') {
      return corsResponse({ error: 'Cannot update a used ticket' }, 400);
    }

    const { holderName, holderEmail, holderPhone, seatNumber, ticketType } = body;

    const ticket = await db.ticket.update({
      where: { id },
      data: {
        ...(holderName && { holderName }),
        ...(holderEmail && { holderEmail }),
        ...(holderPhone !== undefined && { holderPhone }),
        ...(seatNumber !== undefined && { seatNumber }),
        ...(ticketType && { ticketType }),
      },
      include: {
        event: { select: { id: true, name: true, type: true, startDate: true, endDate: true, location: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'ticket.update',
        details: `Updated ticket ${ticket.ticketCode}`,
      },
    });

    return corsResponse({ ticket });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { id } = await params;

    const existingTicket = await db.ticket.findUnique({ where: { id } });
    if (!existingTicket) {
      return corsResponse({ error: 'Ticket not found' }, 404);
    }

    if (existingTicket.status === 'cancelled') {
      return corsResponse({ error: 'Ticket is already cancelled' }, 400);
    }

    const ticket = await db.ticket.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        event: { select: { id: true, name: true } },
      },
    });

    // Update sold tickets count
    await db.event.update({
      where: { id: ticket.eventId },
      data: { soldTickets: { decrement: 1 } },
    });

    // Create refund transaction
    await db.transaction.create({
      data: {
        eventId: ticket.eventId,
        ticketId: ticket.id,
        userId: user.userId,
        amount: -ticket.price,
        currency: ticket.currency,
        status: 'refunded',
        paymentMethod: 'cash',
        description: `Refund for cancelled ticket ${ticket.ticketCode}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'ticket.cancel',
        details: `Cancelled ticket ${ticket.ticketCode} for ${ticket.event.name}`,
      },
    });

    return corsResponse({ ticket });
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
