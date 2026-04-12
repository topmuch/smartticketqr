// ============================================================
// 🎫 PUBLIC API v1 — Ticket by Code (Get & Validate)
// ============================================================
// GET:  Get ticket details by ticket code
// POST: Validate ticket (requires "write" permission)
//       Body: { operatorInfo?, latitude?, longitude?, deviceInfo? }
//       Checks status (active, not expired, not already validated),
//       creates Scan record, updates ticket to "validated",
//       dispatches webhook event ticket.validated
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveApiKey,
  isApiKeyError,
  extractRateLimitHeaders,
  publicHandleCors,
} from '@/lib/api-key-auth';

// ============================================================
// GET — Ticket Details by Code
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const context = await resolveApiKey(request);
    if (isApiKeyError(context)) return context;

    const { organizationId } = context;
    const rateHeaders = extractRateLimitHeaders(context);

    const { code } = await params;
    const ticketCode = code.trim().toUpperCase();

    // Find ticket — verify it belongs to the organization via event relation
    const ticket = await db.ticket.findUnique({
      where: { ticketCode },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            location: true,
            startDate: true,
            endDate: true,
            organizationId: true,
          },
        },
        scans: {
          select: {
            id: true,
            result: true,
            createdAt: true,
            location: true,
            deviceInfo: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!ticket || ticket.event.organizationId !== organizationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ticket not found or does not belong to your organization.',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          ticketType: ticket.ticketType,
          holderName: ticket.holderName,
          holderEmail: ticket.holderEmail,
          holderPhone: ticket.holderPhone,
          seatNumber: ticket.seatNumber,
          price: ticket.price,
          currency: ticket.currency,
          status: ticket.status,
          validatedAt: ticket.validatedAt,
          issuedAt: ticket.issuedAt,
          expiresAt: ticket.expiresAt,
          createdAt: ticket.createdAt,
          event: ticket.event,
          recentScans: ticket.scans,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...rateHeaders,
        },
      }
    );
  } catch (error) {
    console.error('[Public API v1 Ticket by Code GET Error]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// POST — Validate Ticket
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const context = await resolveApiKey(request);
    if (isApiKeyError(context)) return context;

    const { organizationId, permissions, apiKeyId } = context;
    const rateHeaders = extractRateLimitHeaders(context);

    // Check write permission
    if (!permissions.includes('write')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Write permission required to validate tickets.',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    const { code } = await params;
    const ticketCode = code.trim().toUpperCase();

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { operatorInfo, latitude, longitude, deviceInfo } = body as {
      operatorInfo?: string;
      latitude?: number;
      longitude?: number;
      deviceInfo?: string;
    };

    // Find ticket with tenant verification
    const ticket = await db.ticket.findUnique({
      where: { ticketCode },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
            startDate: true,
            endDate: true,
            organizationId: true,
          },
        },
      },
    });

    if (!ticket || ticket.event.organizationId !== organizationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ticket not found or does not belong to your organization.',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    // Step 1: Check ticket status
    if (ticket.status === 'validated' || ticket.status === 'used') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ticket has already been validated.',
          data: {
            ticketCode: ticket.ticketCode,
            status: ticket.status,
            validatedAt: ticket.validatedAt?.toISOString() || null,
          },
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    if (ticket.status === 'cancelled') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ticket has been cancelled.',
          data: {
            ticketCode: ticket.ticketCode,
            status: 'cancelled',
          },
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    // Step 2: Check expiry
    if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) {
      // Auto-update status to expired
      await db.ticket.update({
        where: { id: ticket.id },
        data: { status: 'expired' },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ticket has expired.',
          data: {
            ticketCode: ticket.ticketCode,
            status: 'expired',
            expiresAt: ticket.expiresAt.toISOString(),
          },
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    // Step 3: Validate the ticket (transactional)
    const now = new Date();

    await db.$transaction(async (tx) => {
      // Update ticket status
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'validated',
          validatedAt: now,
        },
      });

      // Create Scan record
      await tx.scan.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          scannedBy: apiKeyId, // Use API key ID as scanner identity
          organizationId,
          result: 'valid',
          deviceInfo: deviceInfo || operatorInfo || 'Public API',
          location: ticket.event.location || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          geoAlert: false,
          isSynced: true,
        },
      });
    });

    // Step 4: Log activity
    await db.activityLog.create({
      data: {
        organizationId,
        action: 'ticket.validate',
        details: `API validation: ticket ${ticketCode} for ${ticket.event.name} (key: ${context.keyName})`,
        userAgent: deviceInfo || 'Public API v1',
      },
    });

    // Step 5: Dispatch webhook event: ticket.validated
    dispatchWebhook(organizationId, 'ticket.validated', {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      ticketType: ticket.ticketType,
      holderName: ticket.holderName,
      eventId: ticket.eventId,
      eventName: ticket.event.name,
      validatedAt: now.toISOString(),
      operatorInfo: operatorInfo || null,
      apiKeyId,
      keyName: context.keyName,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    }).catch((err) => console.error('[Webhook dispatch failed]', err));

    // Step 6: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ticketCode: ticket.ticketCode,
          status: 'validated',
          validatedAt: now.toISOString(),
          event: {
            id: ticket.event.id,
            name: ticket.event.name,
            type: ticket.event.type,
            location: ticket.event.location,
          },
          holder: {
            name: ticket.holderName,
            email: ticket.holderEmail,
            phone: ticket.holderPhone,
          },
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...rateHeaders,
        },
      }
    );
  } catch (error) {
    console.error('[Public API v1 Ticket Validate POST Error]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// WEBHOOK DISPATCHER (fire-and-forget)
// ============================================================

async function dispatchWebhook(organizationId: string, eventType: string, payload: Record<string, unknown>) {
  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: { organizationId, isActive: true },
    });

    for (const endpoint of endpoints) {
      let subscribedEvents: string[] = [];
      try {
        subscribedEvents = JSON.parse(endpoint.events);
      } catch {
        continue;
      }
      if (!subscribedEvents.includes(eventType)) continue;

      const crypto = await import('crypto');
      const payloadStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(payloadStr)
        .digest('hex');

      fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
        },
        body: payloadStr,
      })
        .then(async (res) => {
          const responseBody = await res.text().catch(() => '');
          await db.webhookLog.create({
            data: {
              organizationId,
              endpointId: endpoint.id,
              eventType,
              payload: payloadStr,
              httpStatus: res.status,
              responseBody: responseBody.slice(0, 5000),
              attempts: 1,
              status: res.ok ? 'delivered' : 'failed',
            },
          });
        })
        .catch(async () => {
          await db.webhookLog.create({
            data: {
              organizationId,
              endpointId: endpoint.id,
              eventType,
              payload: payloadStr,
              attempts: 1,
              status: 'failed',
              nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
            },
          }).catch(() => {});
        });
    }
  } catch (err) {
    console.error('[Webhook dispatch error]', err);
  }
}

export async function OPTIONS() {
  return publicHandleCors();
}
