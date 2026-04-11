// ============================================================
// 🎫 PUBLIC API v1 — Tickets (List & Create)
// ============================================================
// GET:  List tickets with filters (?eventId, ?status, ?ticketCode, ?page, ?limit)
// POST: Create a ticket (requires "write" permission)
//       Body: { eventId, holderName, holderEmail, holderPhone?, ticketType?, seatNumber? }
//       Auto-assigns price from event, generates ticket code,
//       dispatches webhook event ticket.created
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generateTicketCode } from '@/lib/auth';
import {
  resolveApiKey,
  isApiKeyError,
  extractRateLimitHeaders,
  publicHandleCors,
} from '@/lib/api-key-auth';

// ============================================================
// GET — List Tickets
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const context = await resolveApiKey(request);
    if (isApiKeyError(context)) return context;

    const { organizationId } = context;
    const rateHeaders = extractRateLimitHeaders(context);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');
    const ticketCode = searchParams.get('ticketCode');

    // Build WHERE clause — tenant isolation via event relation
    const where: Record<string, unknown> = {
      event: { organizationId },
    };

    if (eventId) where.eventId = eventId;
    if (status) where.status = status;
    if (ticketCode) where.ticketCode = { contains: ticketCode.toUpperCase() };

    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        select: {
          id: true,
          ticketCode: true,
          ticketType: true,
          holderName: true,
          holderEmail: true,
          holderPhone: true,
          seatNumber: true,
          price: true,
          currency: true,
          status: true,
          validatedAt: true,
          issuedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          event: {
            select: {
              id: true,
              name: true,
              type: true,
              startDate: true,
              endDate: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ticket.count({ where }),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tickets,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
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
    console.error('[Public API v1 Tickets GET Error]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// POST — Create Ticket
// ============================================================

export async function POST(request: NextRequest) {
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
          error: 'Write permission required. Your API key only has read access.',
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

    // Parse request body
    const body = await request.json();
    const { eventId, holderName, holderEmail, holderPhone, ticketType, seatNumber } = body;

    if (!eventId || !holderName || !holderEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'eventId, holderName, and holderEmail are required.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    // Verify event belongs to the API key's organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Event not found or does not belong to your organization.',
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

    if (event.status === 'cancelled') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot create tickets for a cancelled event.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    // Check ticket capacity
    if (event.soldTickets >= event.totalTickets) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Event is sold out. No more tickets available.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...rateHeaders,
          },
        }
      );
    }

    // Generate ticket code and create ticket
    const ticketCode = generateTicketCode();

    const ticket = await db.ticket.create({
      data: {
        eventId,
        ticketCode,
        ticketType: ticketType || 'Standard',
        holderName,
        holderEmail,
        holderPhone: holderPhone || null,
        seatNumber: seatNumber || null,
        price: event.price, // Auto-assign from event
        currency: event.currency,
        status: 'active',
        expiresAt: event.endDate,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            type: true,
            startDate: true,
            endDate: true,
            location: true,
          },
        },
      },
    });

    // Update sold tickets count
    await db.event.update({
      where: { id: eventId },
      data: { soldTickets: { increment: 1 } },
    });

    // Create transaction record
    await db.transaction.create({
      data: {
        eventId,
        ticketId: ticket.id,
        organizationId,
        amount: ticket.price,
        currency: ticket.currency,
        status: 'completed',
        paymentMethod: 'api',
        description: `Ticket created via API: ${ticket.ticketType} - ${ticketCode}`,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        organizationId,
        action: 'ticket.create',
        details: `API ticket created: ${ticketCode} for ${event.name} (via key: ${context.keyName})`,
      },
    });

    // Dispatch webhook event: ticket.created
    dispatchWebhook(organizationId, 'ticket.created', {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      ticketType: ticket.ticketType,
      holderName: ticket.holderName,
      holderEmail: ticket.holderEmail,
      eventId: event.id,
      eventName: event.name,
      price: ticket.price,
      currency: ticket.currency,
      createdAt: ticket.createdAt.toISOString(),
      apiKeyId,
      keyName: context.keyName,
    }).catch((err) => console.error('[Webhook dispatch failed]', err));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ticket: {
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
            issuedAt: ticket.issuedAt,
            expiresAt: ticket.expiresAt,
            event: ticket.event,
          },
        },
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...rateHeaders,
        },
      }
    );
  } catch (error) {
    console.error('[Public API v1 Tickets POST Error]', error);
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
    // Find active webhook endpoints that listen for this event type
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    for (const endpoint of endpoints) {
      // Check if this endpoint subscribes to the event type
      let subscribedEvents: string[] = [];
      try {
        subscribedEvents = JSON.parse(endpoint.events);
      } catch {
        continue;
      }

      if (!subscribedEvents.includes(eventType)) continue;

      // Compute HMAC-SHA256 signature
      const crypto = await import('crypto');
      const payloadStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(payloadStr)
        .digest('hex');

      // Fire webhook (don't await — non-blocking)
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
          // Log delivery result
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
        .catch(async (fetchErr) => {
          // Log failed delivery
          await db.webhookLog.create({
            data: {
              organizationId,
              endpointId: endpoint.id,
              eventType,
              payload: payloadStr,
              attempts: 1,
              status: 'failed',
              nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // retry in 5 min
            },
          }).catch(() => {});
          console.error(
            `[Webhook delivery failed] ${endpoint.url}:`,
            fetchErr instanceof Error ? fetchErr.message : 'Unknown error'
          );
        });
    }
  } catch (err) {
    console.error('[Webhook dispatch error]', err);
  }
}

export async function OPTIONS() {
  return publicHandleCors();
}
