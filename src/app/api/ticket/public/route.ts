import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import QRCode from 'qrcode';

/**
 * GET /api/ticket/public?code=TICKET_CODE&org=org-slug
 *
 * Public endpoint (no auth required) for viewing ticket details.
 * Used by the WhatsApp shared ticket link.
 * Returns ticket holder info, event details, and QR code image.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(request.url);
    const ticketCode = searchParams.get('code')?.trim().toUpperCase();
    const orgSlug = searchParams.get('org');

    if (!ticketCode || !orgSlug) {
      return corsResponse({ error: 'Ticket code and organization slug are required' }, 400);
    }

    // Find organization by slug
    const org = await db.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true, uuid: true, primaryColor: true, logoUrl: true, isActive: true },
    });

    if (!org || !org.isActive) {
      return corsResponse({ error: 'Organization not found' }, 404);
    }

    // Find ticket
    const ticket = await db.ticket.findFirst({
      where: {
        ticketCode,
        event: { organizationId: org.id },
      },
      include: {
        event: {
          select: { id: true, name: true, type: true, description: true, location: true, startDate: true, endDate: true, price: true, currency: true },
        },
      },
    });

    if (!ticket) {
      return corsResponse({ error: 'Ticket not found' }, 404);
    }

    // Generate QR code image
    const qrPayload = JSON.stringify({
      tc: ticket.ticketCode,
      ei: ticket.eventId,
      ts: Date.now(),
    });
    const qrImage = await QRCode.toDataURL(
      Buffer.from(qrPayload).toString('base64url'),
      { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } }
    );

    return corsResponse({
      ticket: {
        code: ticket.ticketCode,
        type: ticket.ticketType,
        holderName: ticket.holderName,
        status: ticket.status,
        price: ticket.price,
        currency: ticket.currency,
        seatNumber: ticket.seatNumber,
        expiresAt: ticket.expiresAt,
        issuedAt: ticket.issuedAt,
        validatedAt: ticket.validatedAt,
      },
      event: {
        name: ticket.event.name,
        type: ticket.event.type,
        description: ticket.event.description,
        location: ticket.event.location,
        startDate: ticket.event.startDate,
        endDate: ticket.event.endDate,
      },
      organization: {
        name: org.name,
        color: org.primaryColor,
        logo: org.logoUrl,
      },
      qrImage,
    });
  });
}

export async function OPTIONS() { return handleCors(); }
