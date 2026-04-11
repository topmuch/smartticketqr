import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requireTenantRole } from '@/lib/api-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    // Verify ticket belongs to tenant's org via event relation
    const ticket = await db.ticket.findFirst({
      where: {
        id,
        event: { organizationId: tenant.organizationId },
      },
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
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;
    const body = await request.json();

    // Verify ticket belongs to tenant's org via event relation
    const existingTicket = await db.ticket.findFirst({
      where: {
        id,
        event: { organizationId: tenant.organizationId },
      },
    });
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
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'ticket.update',
        details: `Updated ticket ${ticket.ticketCode}`,
      },
    });

    return corsResponse({ ticket });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    // Verify ticket belongs to tenant's org via event relation
    const existingTicket = await db.ticket.findFirst({
      where: {
        id,
        event: { organizationId: tenant.organizationId },
      },
    });
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

    // Create refund transaction with organizationId
    await db.transaction.create({
      data: {
        eventId: ticket.eventId,
        ticketId: ticket.id,
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        amount: -ticket.price,
        currency: ticket.currency,
        status: 'refunded',
        paymentMethod: 'cash',
        description: `Refund for cancelled ticket ${ticket.ticketCode}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'ticket.cancel',
        details: `Cancelled ticket ${ticket.ticketCode} for ${ticket.event.name}`,
      },
    });

    return corsResponse({ ticket });
  });
}

export async function OPTIONS() { return handleCors(); }
