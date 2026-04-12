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
          fareType: { select: { id: true, name: true, slug: true, emoji: true, priceModifier: true, requiresProof: true, maxScans: true } },
          promoCode: { select: { id: true, code: true, type: true, value: true } },
          ticketItems: {
            include: {
              extra: { select: { id: true, name: true, slug: true, emoji: true } },
            },
          },
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

    const permCheck = requirePermission(tenant, 'tickets.sell');
    if (isErrorResponse(permCheck)) return permCheck;

    const body = await request.json();
    const {
      eventId, ticketType, holderName, holderEmail, holderPhone, seatNumber,
      price, currency,
      fareTypeId, extras, promoCode: promoCodeInput,
      vehiclePlate, vehicleType, idProofNumber,
    } = body;

    if (!eventId || !holderName || !holderEmail) {
      return corsResponse({ error: 'Event ID, holder name, and holder email are required' }, 400);
    }

    // ── Vehicle validation ────────────────────────────────────
    if ((vehicleType && !vehiclePlate) || (!vehicleType && vehiclePlate)) {
      return corsResponse({ error: 'Both vehicleType and vehiclePlate must be provided together' }, 400);
    }
    if (vehicleType && vehicleType.trim() === '') {
      return corsResponse({ error: 'vehicleType must not be empty' }, 400);
    }
    if (vehiclePlate && vehiclePlate.trim() === '') {
      return corsResponse({ error: 'vehiclePlate must not be empty' }, 400);
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

    // ── Pricing calculation ────────────────────────────────────
    const basePrice = parseFloat(price) || event.price;
    let fareModifier = 1.0;
    let fareTypeName = 'Standard';

    // Apply fare type modifier
    let ticketMaxScans = 1; // default
    let fareTypeRequiresProof = false;
    let fareTypeProofLabel = '';

    if (fareTypeId) {
      const fareType = await db.fareType.findFirst({
        where: { id: fareTypeId, organizationId: tenant.organizationId, isActive: true },
      });
      if (fareType) {
        fareModifier = fareType.priceModifier;
        fareTypeName = fareType.name;
        ticketMaxScans = fareType.maxScans;
        fareTypeRequiresProof = fareType.requiresProof;
        fareTypeProofLabel = fareType.proofLabel;
      }
    }

    // ── ID proof validation ────────────────────────────────────
    if (fareTypeRequiresProof && (!idProofNumber || idProofNumber.trim() === '')) {
      return corsResponse({ error: `This fare type requires proof of eligibility. Please provide your ${fareTypeProofLabel || 'ID proof number'}.` }, 400);
    }

    const modifiedPrice = Math.round(basePrice * fareModifier * 100) / 100;

    // Calculate extras total
    let extrasTotal = 0;
    const ticketItemsData: Array<{
      extraId: string;
      quantity: number;
      unitPrice: number;
      details: string;
    }> = [];

    if (Array.isArray(extras) && extras.length > 0) {
      for (const item of extras) {
        const extra = await db.ticketExtra.findFirst({
          where: { id: item.extraId, organizationId: tenant.organizationId, isActive: true },
        });
        if (!extra) continue;

        const quantity = Math.max(1, Math.min(item.quantity || 1, extra.maxPerTicket));
        const unitPrice = extra.basePrice;
        const subtotal = Math.round(unitPrice * quantity * 100) / 100;
        extrasTotal += subtotal;

        ticketItemsData.push({
          extraId: extra.id,
          quantity,
          unitPrice,
          details: item.details || '',
        });
      }
    }

    const subtotal = Math.round((modifiedPrice + extrasTotal) * 100) / 100;

    // Apply promo code
    let discountAmount = 0;
    let usedPromoCodeId: string | null = null;

    if (promoCodeInput && promoCodeInput.trim()) {
      const promo = await db.promoCode.findUnique({
        where: { organizationId_code: { organizationId: tenant.organizationId, code: promoCodeInput.trim().toUpperCase() } },
      });

      if (promo && promo.isActive) {
        const now = new Date();
        const validDateRange = (!promo.validFrom || promo.validFrom <= now) && (!promo.validUntil || promo.validUntil >= now);
        const validUsage = !promo.maxUses || promo.usedCount < promo.maxUses;

        if (validDateRange && validUsage) {
          if (promo.type === 'percent') {
            discountAmount = Math.round(subtotal * (promo.value / 100) * 100) / 100;
          } else {
            discountAmount = Math.min(promo.value, subtotal);
          }
          usedPromoCodeId = promo.id;

          // Increment promo usage counter
          await db.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Determine ticket type label
    const finalTicketType = ticketType || fareTypeName || 'Standard';

    // ── Create ticket ──────────────────────────────────────────
    const ticket = await db.ticket.create({
      data: {
        eventId,
        userId: tenant.userId,
        ticketCode,
        ticketType: finalTicketType,
        holderName,
        holderEmail,
        holderPhone,
        seatNumber,
        price: total,
        currency: currency || event.currency,
        status: 'active',
        expiresAt: event.endDate,
        fareTypeId: fareTypeId || null,
        promoCodeId: usedPromoCodeId,
        basePrice,
        extrasTotal,
        discountAmount,
        maxScans: ticketMaxScans,
        usageCount: 0,
        vehiclePlate: vehiclePlate && vehiclePlate.trim() ? vehiclePlate.trim() : null,
        vehicleType: vehicleType && vehicleType.trim() ? vehicleType.trim() : null,
        idProofNumber: idProofNumber && idProofNumber.trim() ? idProofNumber.trim() : null,
        ticketItems: {
          create: ticketItemsData,
        },
      },
      include: {
        event: { select: { id: true, name: true, type: true, startDate: true, endDate: true, location: true } },
        user: { select: { id: true, name: true, email: true } },
        fareType: { select: { id: true, name: true, slug: true, emoji: true, priceModifier: true, requiresProof: true, maxScans: true } },
        promoCode: { select: { id: true, code: true, type: true, value: true } },
        ticketItems: {
          include: { extra: { select: { id: true, name: true, slug: true, emoji: true } } },
        },
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
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        amount: total,
        currency: ticket.currency,
        status: 'completed',
        paymentMethod: 'cash',
        description: `Ticket: ${finalTicketType} - ${ticketCode}${fareTypeId ? ` (${fareTypeName})` : ''}${discountAmount > 0 ? ` [-${discountAmount}]` : ''}`,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'ticket.create',
        details: `Created ticket ${ticketCode} for ${event.name} (${finalTicketType}, ${total} ${ticket.currency})`,
      },
    });

    // Generate QR data
    const { encryptTicketData } = await import('@/lib/crypto');
    const qrData = encryptTicketData(ticketCode, eventId);

    return corsResponse({
      ticket,
      transaction,
      qrData,
      pricing: {
        basePrice,
        fareModifier,
        modifiedPrice,
        extrasTotal,
        discountAmount,
        total,
      },
    }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
