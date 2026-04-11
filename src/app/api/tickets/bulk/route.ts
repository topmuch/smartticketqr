import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { generateTicketCode } from '@/lib/auth';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { eventId, tickets: ticketList, count } = body;

    if (!eventId) {
      return corsResponse({ error: 'Event ID is required' }, 400);
    }

    // Verify event exists and belongs to tenant's org
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId: tenant.organizationId },
    });
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
      for (let i = 0; i < count; i++) {
        const ticketNum = event.soldTickets + i + 1;
        ticketsToCreate.push({
          eventId,
          userId: tenant.userId,
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
      for (const t of ticketList) {
        ticketsToCreate.push({
          eventId,
          userId: tenant.userId,
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

    // Fetch created tickets with relations (tenant-scoped)
    const allEventTickets = await db.ticket.findMany({
      where: {
        eventId,
        userId: tenant.userId,
        event: { organizationId: tenant.organizationId },
      },
      orderBy: { createdAt: 'desc' },
      take: ticketsToCreate.length,
      include: {
        event: { select: { id: true, name: true, type: true } },
      },
    });

    // Create transaction record with organizationId
    const totalAmount = ticketsToCreate.reduce((sum, t) => sum + t.price, 0);
    await db.transaction.create({
      data: {
        eventId,
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        amount: totalAmount,
        currency: event.currency,
        status: 'completed',
        paymentMethod: 'cash',
        description: `Bulk ticket creation: ${ticketsToCreate.length} tickets for ${event.name}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
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

export async function OPTIONS() { return handleCors(); }
