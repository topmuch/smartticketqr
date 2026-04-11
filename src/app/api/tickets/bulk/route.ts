import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, corsResponse, withErrorHandler, corsHeaders } from '@/lib/api-helper';
import { generateTicketCode } from '@/lib/auth';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    const body = await request.json();
    const { eventId, tickets: ticketList, count } = body;

    if (!eventId) {
      return corsResponse({ error: 'Event ID is required' }, 400);
    }

    // Verify event exists and is active
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return corsResponse({ error: 'Event not found' }, 404);
    }
    if (event.status === 'cancelled') {
      return corsResponse({ error: 'Cannot create tickets for a cancelled event' }, 400);
    }

    // Build list of tickets to create
    const ticketsToCreate: Array<{
      eventId: string;
      userId: string;
      ticketCode: string;
      ticketType: string;
      holderName: string;
      holderEmail: string;
      holderPhone?: string;
      seatNumber?: string;
      price: number;
      currency: string;
      status: string;
      expiresAt: Date;
    }> = [];

    if (count && count > 0) {
      // Auto-generate tickets
      for (let i = 0; i < count; i++) {
        const ticketNum = event.soldTickets + i + 1;
        ticketsToCreate.push({
          eventId,
          userId: user.userId,
          ticketCode: generateTicketCode(),
          ticketType: 'Standard',
          holderName: `Attendee ${ticketNum}`,
          holderEmail: `attendee${ticketNum}@bulk.generate`,
          price: event.price,
          currency: event.currency,
          status: 'active',
          expiresAt: event.endDate,
        });
      }
    } else if (ticketList && Array.isArray(ticketList)) {
      // Use provided ticket list
      for (const t of ticketList) {
        ticketsToCreate.push({
          eventId,
          userId: user.userId,
          ticketCode: generateTicketCode(),
          ticketType: t.ticketType || 'Standard',
          holderName: t.holderName || 'Unknown',
          holderEmail: t.holderEmail || '',
          holderPhone: t.holderPhone,
          seatNumber: t.seatNumber,
          price: parseFloat(t.price) || event.price,
          currency: t.currency || event.currency,
          status: 'active',
          expiresAt: event.endDate,
        });
      }
    } else {
      return corsResponse({ error: 'Either tickets array or count must be provided' }, 400);
    }

    // Create all tickets
    const createdTickets = await db.ticket.createMany({
      data: ticketsToCreate,
    });

    // Update sold tickets count
    await db.event.update({
      where: { id: eventId },
      data: { soldTickets: { increment: ticketsToCreate.length } },
    });

    // Fetch created tickets with relations
    const allEventTickets = await db.ticket.findMany({
      where: { eventId, userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: ticketsToCreate.length,
      include: {
        event: { select: { id: true, name: true, type: true } },
      },
    });

    // Create transaction records
    const totalAmount = ticketsToCreate.reduce((sum, t) => sum + t.price, 0);
    await db.transaction.create({
      data: {
        eventId,
        userId: user.userId,
        amount: totalAmount,
        currency: event.currency,
        status: 'completed',
        paymentMethod: 'cash',
        description: `Bulk ticket creation: ${ticketsToCreate.length} tickets for ${event.name}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'ticket.bulk_create',
        details: `Bulk created ${ticketsToCreate.length} tickets for ${event.name}`,
      },
    });

    return corsResponse({
      count: createdTickets.count,
      tickets: allEventTickets,
    }, 201);
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
