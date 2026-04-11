import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import {
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';

// ============================================================
// Allowed webhook event types
// ============================================================
const ALLOWED_EVENTS = [
  'ticket.created',
  'ticket.validated',
  'ticket.cancelled',
  'subscription.created',
  'subscription.expired',
  'user.created',
] as const;

type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

function isAllowedEvent(event: string): event is AllowedEvent {
  return (ALLOWED_EVENTS as readonly string[]).includes(event);
}

// ============================================================
// GET /api/webhooks/endpoints — List webhook endpoints for org
// ============================================================
// Returns all endpoints scoped to the tenant's organization.
// Secret is NEVER returned in list responses.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const endpoints = await db.webhookEndpoint.findMany({
      where: { organizationId: tenant.organizationId },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { logs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse events JSON for each endpoint
    const data = endpoints.map((ep) => {
      let parsedEvents: string[] = [];
      try {
        parsedEvents = JSON.parse(ep.events);
      } catch {
        parsedEvents = [];
      }
      return {
        id: ep.id,
        url: ep.url,
        events: parsedEvents,
        isActive: ep.isActive,
        createdAt: ep.createdAt,
        totalLogs: ep._count.logs,
      };
    });

    return corsResponse({ success: true, data });
  });
}

// ============================================================
// POST /api/webhooks/endpoints — Create a new webhook endpoint
// ============================================================
// Requires admin or super_admin role.
// Auto-generates a signing secret if not provided.
// Returns the secret ONLY once in the create response.
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { url, events, secret } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return corsResponse({ error: 'URL is required' }, 400);
    }

    if (!url.startsWith('https://')) {
      return corsResponse({ error: 'URL must use HTTPS' }, 400);
    }

    try {
      new URL(url);
    } catch {
      return corsResponse({ error: 'Invalid URL format' }, 400);
    }

    // Validate events array
    if (!Array.isArray(events) || events.length === 0) {
      return corsResponse({ error: 'At least one event type is required' }, 400);
    }

    const invalidEvents = events.filter((e: string) => !isAllowedEvent(e));
    if (invalidEvents.length > 0) {
      return corsResponse({
        error: `Invalid event types: ${invalidEvents.join(', ')}. Allowed: ${ALLOWED_EVENTS.join(', ')}`,
      }, 400);
    }

    // Auto-generate secret if not provided (32 random hex chars)
    const webhookSecret = secret && typeof secret === 'string' && secret.trim()
      ? secret.trim()
      : crypto.randomBytes(32).toString('hex');

    const endpoint = await db.webhookEndpoint.create({
      data: {
        organizationId: tenant.organizationId,
        url,
        events: JSON.stringify(events),
        secret: webhookSecret,
        isActive: true,
      },
    });

    return corsResponse({
      success: true,
      data: {
        id: endpoint.id,
        url: endpoint.url,
        events: JSON.parse(endpoint.events),
        secret: endpoint.secret,
      },
      message: 'Save this secret - it won\'t be shown again',
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
