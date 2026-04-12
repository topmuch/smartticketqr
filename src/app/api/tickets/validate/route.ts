// ============================================================
// 🎫 ENHANCED TICKET VALIDATION API
// ============================================================
// Features:
// - HMAC-SHA256 QR signature verification (Phase 3)
// - Fallback to ticket code lookup (backward compat)
// - Geolocation anti-fraud check (Haversine)
// - Rate limiting (5 req/sec/IP)
// - Transactional scan marking
// - sound_hint field for scanner audio feedback
// - Geo alert logging
// - ScanLog creation (Phase 3 audit trail)
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requirePermission } from '@/lib/api-helper';
import { validateQRPayload, validateTicketCode } from '@/lib/ticket-generator';
import { validateScanLocation } from '@/lib/geo-validator';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // Step 1: Rate limiting (max 5 validations/sec/IP)
    const clientIP =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimitKey = `validate:${clientIP}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 1000);

    if (!rateCheck.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded. Please slow down.', retryAfter: 1 }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1',
            ...getRateLimitHeaders(rateCheck),
          },
        }
      );
    }

    // Step 2: Tenant resolution
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    // Step 2.5: RBAC - Only admin and controleur can validate tickets
    const permCheck = requirePermission(tenant, 'scanner.use');
    if (isErrorResponse(permCheck)) return permCheck;

    // Step 3: Parse request body
    const body = await request.json();
    const { ticketCode, qrPayload, latitude, longitude } = body;

    if (!ticketCode && !qrPayload) {
      return corsResponse({ error: 'Ticket code or QR payload is required' }, 400);
    }

    // Step 4: Get organization settings
    const org = await db.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { settings: true, uuid: true, name: true },
    });

    // Step 5: Resolve ticket - try QR payload first, fall back to code
    let resolvedTicketCode = ticketCode?.trim().toUpperCase();
    let qrVerified = false;

    if (qrPayload) {
      // HMAC-SHA256 verification
      const qrResult = await validateQRPayload(qrPayload, tenant.organizationId);
      if (!qrResult.valid) {
        // Log invalid QR attempt
        await createScanLog({
          organizationId: tenant.organizationId,
          ticketId: 'unknown',
          eventId: 'unknown',
          operatorId: tenant.userId,
          status: 'invalid',
          latitude: latitude || null,
          longitude: longitude || null,
          deviceUA: request.headers.get('user-agent') || null,
          geoAlert: false,
        });

        return corsResponse({
          success: false,
          status: 'invalid',
          sound_hint: 'error',
          message: qrResult.error || 'QR code verification failed',
          ticket: null,
        });
      }

      // Use the ticket code from the verified QR payload
      resolvedTicketCode = qrResult.payload!.tc;
      qrVerified = true;
    } else if (resolvedTicketCode) {
      // Manual entry - basic code validation
      const codeCheck = validateTicketCode(resolvedTicketCode);
      if (!codeCheck.valid) {
        return corsResponse({
          success: false,
          status: 'invalid',
          sound_hint: 'error',
          message: 'Invalid ticket code format',
          ticket: null,
        });
      }
      resolvedTicketCode = codeCheck.clean;
    }

    // Step 6: Find ticket in DB
    const ticket = await db.ticket.findUnique({
      where: { ticketCode: resolvedTicketCode },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
            startDate: true,
            latitude: true,
            longitude: true,
            organizationId: true,
          },
        },
        user: { select: { id: true, name: true } },
        fareType: { select: { id: true, name: true, slug: true, emoji: true, priceModifier: true } },
        promoCode: { select: { id: true, code: true, type: true, value: true } },
        scans: { select: { id: true, createdAt: true, result: true } }, // kept for backward compat audit trail
        ticketItems: {
          include: {
            extra: { select: { id: true, name: true, slug: true, emoji: true, pricingType: true } },
          },
        },
      },
    });

    if (!ticket || ticket.event.organizationId !== tenant.organizationId) {
      await createScanLog({
        organizationId: tenant.organizationId,
        ticketId: 'unknown',
        eventId: 'unknown',
        operatorId: tenant.userId,
        status: 'invalid',
        latitude: latitude || null,
        longitude: longitude || null,
        deviceUA: request.headers.get('user-agent') || null,
        geoAlert: false,
      });

      return corsResponse({
        success: false,
        status: 'invalid',
        sound_hint: 'error',
        message: 'Ticket not found or does not belong to your organization',
        ticket: null,
        qr_verified: qrVerified,
      });
    }

    // Step 7: Check ticket status (with round-trip support via maxScans/usageCount)
    let scanStatus: 'valid' | 'used' | 'expired' | 'invalid' = 'valid';
    let statusMessage = 'Ticket validated successfully!';
    const maxScans = ticket.maxScans || 1;
    const currentUsage = ticket.usageCount || 0;
    const isRoundTrip = maxScans > 1;

    if (ticket.status === 'used' || ticket.status === 'completed') {
      scanStatus = 'used';
      statusMessage = isRoundTrip
        ? 'Billet aller-retour déjà complété'
        : 'Ticket has already been used';
    } else if (ticket.status === 'cancelled') {
      scanStatus = 'invalid';
      statusMessage = 'Ticket has been cancelled';
    } else if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) {
      scanStatus = 'expired';
      statusMessage = 'Ticket has expired';
      // Auto-update status
      await db.ticket.update({
        where: { id: ticket.id },
        data: { status: 'expired' },
      });
    } else if (currentUsage >= maxScans) {
      // Ticket already used up all scans
      scanStatus = 'used';
      statusMessage = isRoundTrip
        ? 'Billet aller-retour déjà complété (2/2)'
        : 'Ticket has already been used';
    }

    // Step 8: Geolocation check
    const geoCheck = validateScanLocation(
      latitude || null,
      longitude || null,
      ticket.event.latitude,
      ticket.event.longitude,
      org?.settings
    );

    // Step 9: Create scan log (Phase 3 audit trail)
    const scanLog = await createScanLog({
      organizationId: tenant.organizationId,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      operatorId: tenant.userId,
      status: scanStatus,
      latitude: latitude || null,
      longitude: longitude || null,
      deviceUA: request.headers.get('user-agent') || null,
      geoAlert: !geoCheck.withinThreshold,
      geoDistance: geoCheck.distance,
    });

    // Step 10: If valid, record scan (transactional)
    const isFinalScan = scanStatus === 'valid'
      ? (currentUsage + 1 >= maxScans)
      : false;

    if (scanStatus === 'valid') {
      const now = new Date();

      await db.$transaction(async (tx) => {
        // For final scan: mark as 'used' + increment usageCount. For non-final: keep 'active' + increment.
        if (isFinalScan) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: 'used', validatedAt: now, usageCount: { increment: 1 } },
          });
        } else {
          // Non-final scan (e.g. 1st leg of round-trip): keep status 'active', increment usageCount
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { validatedAt: now, usageCount: { increment: 1 } },
          });
        }

        // Create legacy scan record
        await tx.scan.create({
          data: {
            ticketId: ticket.id,
            eventId: ticket.eventId,
            scannedBy: tenant.userId,
            organizationId: tenant.organizationId,
            result: 'valid',
            deviceInfo: request.headers.get('user-agent') || 'Unknown',
            location: ticket.event.location || null,
            latitude: latitude || null,
            longitude: longitude || null,
            geoAlert: !geoCheck.withinThreshold,
            isSynced: true,
          },
        });
      });

      // Log activity
      await db.activityLog.create({
        data: {
          userId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'scan.validate',
          details: `Validated ticket ${ticket.ticketCode} for ${ticket.event.name}`,
        },
      });
    } else {
      // Create legacy scan record for non-valid scans
      await db.scan.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          scannedBy: tenant.userId,
          organizationId: tenant.organizationId,
          result: scanStatus,
          deviceInfo: request.headers.get('user-agent') || 'Unknown',
          location: ticket.event.location || null,
          latitude: latitude || null,
          longitude: longitude || null,
          geoAlert: !geoCheck.withinThreshold,
          isSynced: true,
        },
      });
    }

    // Step 11: Build response
    const response = {
      success: scanStatus === 'valid',
      status: scanStatus,
      sound_hint: scanStatus === 'valid' ? 'success' : 'error',
      message: isRoundTrip && scanStatus === 'valid'
        ? isFinalScan
          ? `Retour validé — Billet aller-retour complété (2/2)`
          : `Aller validé (${currentUsage + 1}/${maxScans}) — Reste le retour`
        : statusMessage,
      qr_verified: qrVerified,
      scan_id: scanLog.id,
      geo: geoCheck.hasGeoData
        ? {
            within_threshold: geoCheck.withinThreshold,
            distance: geoCheck.distance,
            max_distance: geoCheck.maxDistance,
            alert: geoCheck.alertMessage || null,
          }
        : null,
      ticket:
        scanStatus !== 'invalid' || ticket
          ? {
              id: ticket.id,
              ticketCode: ticket.ticketCode,
              ticketType: ticket.ticketType,
              holderName: ticket.holderName,
              holderEmail: ticket.holderEmail,
              holderPhone: ticket.holderPhone,
              seatNumber: ticket.seatNumber,
              price: ticket.price,
              basePrice: ticket.basePrice,
              extrasTotal: ticket.extrasTotal,
              discountAmount: ticket.discountAmount,
              currency: ticket.currency,
              validatedAt: scanStatus === 'valid' ? new Date().toISOString() : ticket.validatedAt?.toISOString() || null,
              event: {
                id: ticket.event.id,
                name: ticket.event.name,
                type: ticket.event.type,
                location: ticket.event.location,
                startDate: ticket.event.startDate,
              },
              fareType: ticket.fareType || null,
              promoCode: ticket.promoCode || null,
              isRoundTrip,
              usageCount: currentUsage,
              maxScans,
              roundTripRemaining: Math.max(0, maxScans - currentUsage - 1),
              vehiclePlate: ticket.vehiclePlate || null,
              vehicleType: ticket.vehicleType || null,
              idProofNumber: ticket.idProofNumber || null,
              extras: (ticket.ticketItems || []).map((ti) => ({
                name: ti.extra.name,
                slug: ti.extra.slug,
                emoji: ti.extra.emoji,
                quantity: ti.quantity,
                unitPrice: ti.unitPrice,
                subtotal: Math.round(ti.unitPrice * ti.quantity * 100) / 100,
                details: ti.details || '',
              })),
            }
          : null,
    };

    return corsResponse(response);
  });
}

// ============================================================
// HELPER: Create Scan Log
// ============================================================

async function createScanLog(params: {
  organizationId: string;
  ticketId: string;
  eventId: string;
  operatorId: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  deviceUA: string | null;
  geoAlert: boolean;
  geoDistance?: number | null;
}) {
  return db.scanLog.create({
    data: {
      organizationId: params.organizationId,
      ticketId: params.ticketId,
      eventId: params.eventId,
      operatorId: params.operatorId,
      status: params.status,
      latitude: params.latitude,
      longitude: params.longitude,
      deviceUA: params.deviceUA,
      isSynced: true,
      geoAlert: params.geoAlert,
      geoDistance: params.geoDistance || null,
    },
  });
}

export async function OPTIONS() { return handleCors(); }
