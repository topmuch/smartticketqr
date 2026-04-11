import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { ticketCode } = body;

    if (!ticketCode) {
      return corsResponse({ error: 'Ticket code is required' }, 400);
    }

    const ticket = await db.ticket.findUnique({
      where: { ticketCode },
      include: {
        event: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      // Log invalid scan with organizationId
      await db.scan.create({
        data: {
          ticketId: 'unknown',
          eventId: 'unknown',
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: 'invalid',
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
        },
      });

      return corsResponse({
        valid: false,
        ticket: null,
        message: 'Ticket not found. Invalid ticket code.',
      });
    }

    // Verify ticket belongs to tenant's organization
    if (ticket.event.organizationId !== tenant.organizationId) {
      await db.scan.create({
        data: {
          ticketId: 'unknown',
          eventId: 'unknown',
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: 'invalid',
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
        },
      });

      return corsResponse({
        valid: false,
        ticket: null,
        message: 'Ticket not found. Invalid ticket code.',
      });
    }

    // Check if already used
    if (ticket.status === 'used') {
      await db.scan.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: 'already_used',
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
        },
      });

      return corsResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          ticketType: ticket.ticketType,
          holderName: ticket.holderName,
          event: { name: ticket.event.name },
        },
        message: 'Ticket has already been used.',
      });
    }

    // Check if cancelled
    if (ticket.status === 'cancelled') {
      await db.scan.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: 'invalid',
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
        },
      });

      return corsResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          ticketType: ticket.ticketType,
          holderName: ticket.holderName,
          event: { name: ticket.event.name },
        },
        message: 'Ticket has been cancelled.',
      });
    }

    // Check if expired
    if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) {
      await db.ticket.update({
        where: { id: ticket.id },
        data: { status: 'expired' },
      });

      await db.scan.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: 'expired',
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
        },
      });

      return corsResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          ticketType: ticket.ticketType,
          holderName: ticket.holderName,
          event: { name: ticket.event.name },
        },
        message: 'Ticket has expired.',
      });
    }

    // Valid ticket - mark as used
    const now = new Date();
    const [updatedTicket] = await Promise.all([
      db.ticket.update({
        where: { id: ticket.id },
        data: { status: 'used', validatedAt: now },
      }),
      db.scan.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: 'valid',
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
        },
      }),
    ]);

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'scan.validate',
        details: `Validated ticket ${ticket.ticketCode} for ${ticket.event.name}`,
      },
    });

    return corsResponse({
      valid: true,
      ticket: {
        id: updatedTicket.id,
        ticketCode: updatedTicket.ticketCode,
        ticketType: updatedTicket.ticketType,
        holderName: updatedTicket.holderName,
        holderEmail: updatedTicket.holderEmail,
        holderPhone: updatedTicket.holderPhone,
        seatNumber: updatedTicket.seatNumber,
        validatedAt: now,
        event: {
          id: ticket.event.id,
          name: ticket.event.name,
          type: ticket.event.type,
          location: ticket.event.location,
          startDate: ticket.event.startDate,
        },
      },
      message: 'Ticket validated successfully!',
    });
  });
}

export async function OPTIONS() { return handleCors(); }
