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
// GET /api/webhooks/endpoints/[id] — Get single endpoint
// ============================================================
// Returns endpoint details with secret masked (first 8 chars + "...")
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const endpoint = await db.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      select: {
        id: true,
        url: true,
        events: true,
        secret: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { logs: true },
        },
      },
    });

    if (!endpoint) {
      return corsResponse({ error: 'Webhook endpoint not found' }, 404);
    }

    // Parse events JSON and mask the secret
    let parsedEvents: string[] = [];
    try {
      parsedEvents = JSON.parse(endpoint.events);
    } catch {
      parsedEvents = [];
    }

    const maskedSecret = endpoint.secret
      ? endpoint.secret.substring(0, 8) + '...'
      : '***';

    return corsResponse({
      success: true,
      data: {
        id: endpoint.id,
        url: endpoint.url,
        events: parsedEvents,
        secret: maskedSecret,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
        totalLogs: endpoint._count.logs,
      },
    });
  });
}

// ============================================================
// PUT /api/webhooks/endpoints/[id] — Update endpoint
// ============================================================
// Can update URL, events, isActive.
// Use { regenerateSecret: true } to generate a new secret.
// Requires admin or super_admin role.
// ============================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const existing = await db.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Webhook endpoint not found' }, 404);
    }

    const body = await request.json();
    const { url, events, isActive, regenerateSecret } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Update URL if provided
    if (url !== undefined) {
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        return corsResponse({ error: 'URL must be a valid HTTPS URL' }, 400);
      }
      try {
        new URL(url);
      } catch {
        return corsResponse({ error: 'Invalid URL format' }, 400);
      }
      updateData.url = url;
    }

    // Update events if provided
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return corsResponse({ error: 'At least one event type is required' }, 400);
      }
      const invalidEvents = events.filter((e: string) => !isAllowedEvent(e));
      if (invalidEvents.length > 0) {
        return corsResponse({
          error: `Invalid event types: ${invalidEvents.join(', ')}. Allowed: ${ALLOWED_EVENTS.join(', ')}`,
        }, 400);
      }
      updateData.events = JSON.stringify(events);
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // Regenerate secret if requested
    if (regenerateSecret === true) {
      updateData.secret = crypto.randomBytes(32).toString('hex');
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({ error: 'No fields to update' }, 400);
    }

    const updated = await db.webhookEndpoint.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        events: true,
        secret: regenerateSecret === true, // only return full secret if regenerated
        isActive: true,
        createdAt: true,
      },
    });

    let parsedEvents: string[] = [];
    try {
      parsedEvents = JSON.parse(updated.events);
    } catch {
      parsedEvents = [];
    }

    const responseData: Record<string, unknown> = {
      id: updated.id,
      url: updated.url,
      events: parsedEvents,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };

    if (regenerateSecret === true) {
      responseData.secret = updated.secret;
      responseData.message = 'Save this secret - it won\'t be shown again';
    } else {
      responseData.secret = updated.secret ? updated.secret.substring(0, 8) + '...' : '***';
    }

    return corsResponse({ success: true, data: responseData });
  });
}

// ============================================================
// DELETE /api/webhooks/endpoints/[id] — Hard delete endpoint
// ============================================================
// Also deletes all associated webhook logs (cascade).
// Requires admin or super_admin role.
// ============================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const existing = await db.webhookEndpoint.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Webhook endpoint not found' }, 404);
    }

    // Delete associated logs first (hard delete)
    await db.webhookLog.deleteMany({
      where: { endpointId: id },
    });

    // Delete the endpoint
    await db.webhookEndpoint.delete({
      where: { id },
    });

    return corsResponse({
      success: true,
      message: 'Webhook endpoint and associated logs deleted',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
