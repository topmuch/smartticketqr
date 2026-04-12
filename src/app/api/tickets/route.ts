import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, parsePagination, requirePermission } from '@/lib/api-helper';
import { generateTicketCode } from '@/lib/auth';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Tenant filter through event's organizationId
    const where: Record<string, unknown> = {
      event: { organizationId: tenant.organizationId },
    };

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
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    // RBAC: Only admin and caisse can create/sell tickets
    const permCheck = requirePermission(tenant, 'tickets.sell');
    if (isErrorResponse(permCheck)) return permCheck;

    const body = await request.json();
    const { eventId, ticketType, holderName, holderEmail, holderPhone, seatNumber, price, currency } = body;

    if (!eventId || !holderName || !holderEmail) {
      return corsResponse({ error: 'Event ID, holder name, and holder email are required' }, 400);
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

    const ticketCode = generateTicketCode();

    const ticket = await db.ticket.create({
      data: {
        eventId,
        userId: tenant.userId,
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

    // Create transaction record with organizationId
    const transaction = await db.transaction.create({
      data: {
        eventId,
        ticketId: ticket.id,
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        amount: ticket.price,
        currency: ticket.currency,
        status: 'completed',
        paymentMethod: 'cash',
        description: `Ticket: ${ticket.ticketType} - ${ticketCode}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'ticket.create',
        details: `Created ticket ${ticketCode} for ${event.name}`,
      },
    });

    // Generate QR data
    const { encryptTicketData } = await import('@/lib/crypto');
    const qrData = encryptTicketData(ticketCode, eventId);

    return corsResponse({
      ticket,
      transaction,
      qrData,
    }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
