import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

// ============================================================
// 💰 PRICING ENGINE
// ============================================================
// Calculates: base × fare_modifier + extras_total - discount = total
// ============================================================

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { eventId, fareTypeId, extras, promoCode } = body;

    if (!eventId) {
      return corsResponse({ error: 'eventId is required' }, 400);
    }

    // 1. Get event to determine base price
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId: tenant.organizationId },
    });
    if (!event) {
      return corsResponse({ error: 'Event not found' }, 404);
    }

    const basePrice = event.price;
    let fareModifier = 1.0;
    let fareTypeName = 'Standard';
    let fareTypeEmoji = '🎫';

    // 2. Apply fare type modifier
    if (fareTypeId) {
      const fareType = await db.fareType.findFirst({
        where: { id: fareTypeId, organizationId: tenant.organizationId, isActive: true },
      });
      if (fareType) {
        fareModifier = fareType.priceModifier;
        fareTypeName = fareType.name;
        fareTypeEmoji = fareType.emoji;
      }
    }

    const modifiedPrice = Math.round(basePrice * fareModifier * 100) / 100;

    // 3. Calculate extras
    const extrasBreakdown: Array<{
      id: string;
      name: string;
      slug: string;
      emoji: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      details: string;
    }> = [];
    let extrasTotal = 0;

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

        extrasBreakdown.push({
          id: extra.id,
          name: extra.name,
          slug: extra.slug,
          emoji: extra.emoji,
          quantity,
          unitPrice,
          subtotal,
          details: item.details || '',
        });
      }
    }

    const subtotal = Math.round((modifiedPrice + extrasTotal) * 100) / 100;

    // 4. Apply promo code
    let promoDiscount = 0;
    let promoInfo: { code: string; type: string; value: number; discount: number } | null = null;

    if (promoCode && promoCode.trim()) {
      const promo = await db.promoCode.findUnique({
        where: { organizationId_code: { organizationId: tenant.organizationId, code: promoCode.trim().toUpperCase() } },
      });

      if (promo && promo.isActive) {
        const now = new Date();
        const validDateRange = (!promo.validFrom || promo.validFrom <= now) && (!promo.validUntil || promo.validUntil >= now);
        const validUsage = !promo.maxUses || promo.usedCount < promo.maxUses;

        if (validDateRange && validUsage) {
          if (promo.type === 'percent') {
            promoDiscount = Math.round(subtotal * (promo.value / 100) * 100) / 100;
          } else {
            promoDiscount = Math.min(promo.value, subtotal);
          }

          promoInfo = {
            code: promo.code,
            type: promo.type,
            value: promo.value,
            discount: promoDiscount,
          };
        }
      }
    }

    const total = Math.max(0, Math.round((subtotal - promoDiscount) * 100) / 100);

    return corsResponse({
      basePrice,
      fareModifier,
      fareTypeName,
      fareTypeEmoji,
      modifiedPrice,
      extras: extrasBreakdown,
      extrasTotal,
      subtotal,
      promo: promoInfo,
      total,
      currency: event.currency,
    });
  });
}

export async function OPTIONS() { return handleCors(); }
