import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, corsResponse, withErrorHandler, parsePagination, corsHeaders, encryptTicketData } from '@/lib/api-helper';
import { generateTicketCode } from '@/lib/auth';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (eventId) where.eventId = eventId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { holderName: { contains: search } },
        { holderEmail: { contains: search } },
        { ticketCode: { contains: search } },
      ];
    }

    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        include: {
          event: { select: { id: true, name: true, type: true, startDate: true, endDate: true, location: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ticket.count({ where }),
    ]);

    return corsResponse({
      data: tickets,
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

    const body = await request.json();
    const { eventId, ticketType, holderName, holderEmail, holderPhone, seatNumber, price, currency } = body;

    if (!eventId || !holderName || !holderEmail) {
      return corsResponse({ error: 'Event ID, holder name, and holder email are required' }, 400);
    }

    // Verify event exists and is active
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return corsResponse({ error: 'Event not found' }, 404);
    }
    if (event.status === 'cancelled') {
      return corsResponse({ error: 'Cannot create tickets for a cancelled event' }, 400);
    }

    const ticketCode = generateTicketCode();

    const ticket = await db.ticket.create({
      data: {
        eventId,
        userId: user.userId,
        ticketCode,
        ticketType: ticketType || 'Standard',
        holderName,
        holderEmail,
        holderPhone,
        seatNumber,
        price: parseFloat(price) || event.price,
        currency: currency || event.currency,
        status: 'active',
        expiresAt: event.endDate,
      },
      include: {
        event: { select: { id: true, name: true, type: true, startDate: true, endDate: true, location: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Update sold tickets count
    await db.event.update({
      where: { id: eventId },
      data: { soldTickets: { increment: 1 } },
    });

    // Create transaction record
    const transaction = await db.transaction.create({
      data: {
        eventId,
        ticketId: ticket.id,
        userId: user.userId,
        amount: ticket.price,
        currency: ticket.currency,
        status: 'completed',
        paymentMethod: 'cash',
        description: `Ticket: ${ticket.ticketType} - ${ticketCode}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'ticket.create',
        details: `Created ticket ${ticketCode} for ${event.name}`,
      },
    });

    // Generate QR data
    const qrData = encryptTicketData(ticketCode, eventId);

    return corsResponse({
      ticket,
      transaction,
      qrData,
    }, 201);
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
