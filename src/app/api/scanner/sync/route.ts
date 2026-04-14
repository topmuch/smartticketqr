// ============================================================
// 📲 GET /api/scanner/sync — Download tickets for offline use
// ============================================================
// Returns all active (non-cancelled) tickets for the authenticated
// organization. Used by the PWA scanner to build a local IndexedDB
// cache for offline validation.
//
// RBAC: Only roles with `scanner.use` permission can sync.
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  requirePermission,
  handleCors,
} from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    // ── Auth + RBAC ──
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'scanner.use');
    if (isErrorResponse(permCheck)) return permCheck;

    // ── Query: all non-cancelled tickets for this org ──
    const tickets = await db.ticket.findMany({
      where: {
        organizationId: tenant.organizationId,
        status: { in: ['active', 'used'] }, // Exclude cancelled/expired
      },
      select: {
        id: true,
        ticketCode: true,
        ticketType: true,
        holderName: true,
        holderEmail: true,
        status: true,
        price: true,
        currency: true,
        seatNumber: true,
        maxScans: true,
        usageCount: true,
        validatedAt: true,
        event: {
          select: {
            name: true,
            type: true,
            location: true,
            startDate: true,
          },
        },
        fareType: {
          select: {
            name: true,
            emoji: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit for mobile storage
    });

    // ── Format for client ──
    const formatted = tickets.map((t) => ({
      id: t.id,
      ticketCode: t.ticketCode,
      ticketType: t.ticketType,
      holderName: t.holderName,
      holderEmail: t.holderEmail,
      status: t.status,
      eventName: t.event.name,
      eventType: t.event.type,
      eventLocation: t.event.location,
      eventStartDate: t.event.startDate.toISOString(),
      price: t.price,
      currency: t.currency,
      seatNumber: t.seatNumber,
      fareTypeName: t.fareType?.name ?? null,
      fareTypeEmoji: t.fareType?.emoji ?? null,
      organizationId: tenant.organizationId,
      maxScans: t.maxScans,
      usageCount: t.usageCount,
    }));

    return corsResponse({
      count: formatted.length,
      syncedAt: new Date().toISOString(),
      tickets: formatted,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
