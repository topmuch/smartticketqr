import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

// ============================================================
// Allowed trigger events for automation rules
// ============================================================
const ALLOWED_TRIGGER_EVENTS = [
  'ticket_created',
  'ticket_reminder',
  'ticket_validated',
  'ticket_cancelled',
  'scan_failed',
  'scan_duplicate',
  'subscription_expired',
  'subscription_created',
] as const;

const ALLOWED_CHANNELS = ['whatsapp', 'sms', 'email'] as const;

const ALLOWED_FALLBACK_CHANNELS = ['whatsapp', 'sms', 'email'] as const;

// ============================================================
// GET /api/automation-rules — List automation rules for org
// ============================================================
// Query params:
//   ?page=1&limit=10
//   ?triggerEvent=ticket_created
//   ?channel=whatsapp
//   ?isActive=true|false
//
// Tenant-isolated by organizationId.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    const triggerEvent = searchParams.get('triggerEvent');
    if (triggerEvent && (ALLOWED_TRIGGER_EVENTS as readonly string[]).includes(triggerEvent)) {
      where.triggerEvent = triggerEvent;
    }

    const channel = searchParams.get('channel');
    if (channel && (ALLOWED_CHANNELS as readonly string[]).includes(channel)) {
      where.channel = channel;
    }

    const isActive = searchParams.get('isActive');
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const [rules, total] = await Promise.all([
      db.automationRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.automationRule.count({ where }),
    ]);

    return corsResponse({
      success: true,
      data: rules,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}

// ============================================================
// POST /api/automation-rules — Create automation rule
// ============================================================
// Body:
//   { triggerEvent: string, channel: string, templateId?: string,
//     delayMinutes?: number, fallbackChannel?: string }
//
// Requires admin or super_admin role.
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { triggerEvent, channel, templateId, delayMinutes, fallbackChannel } = body;

    // Validate triggerEvent
    if (!triggerEvent || !(ALLOWED_TRIGGER_EVENTS as readonly string[]).includes(triggerEvent)) {
      return corsResponse({
        error: `triggerEvent is required. Allowed: ${ALLOWED_TRIGGER_EVENTS.join(', ')}`,
      }, 400);
    }

    // Validate channel
    if (!channel || !(ALLOWED_CHANNELS as readonly string[]).includes(channel)) {
      return corsResponse({
        error: `channel is required. Allowed: ${ALLOWED_CHANNELS.join(', ')}`,
      }, 400);
    }

    // Validate delayMinutes
    const parsedDelay = typeof delayMinutes === 'number'
      ? Math.max(0, Math.min(delayMinutes, 10080)) // max 7 days in minutes
      : 0;

    // Validate fallbackChannel
    if (fallbackChannel !== undefined && fallbackChannel !== null) {
      if (!(ALLOWED_FALLBACK_CHANNELS as readonly string[]).includes(fallbackChannel)) {
        return corsResponse({
          error: `fallbackChannel must be one of: ${ALLOWED_FALLBACK_CHANNELS.join(', ')}`,
        }, 400);
      }
    }

    // Prevent duplicate: same trigger + channel + org
    const existing = await db.automationRule.findFirst({
      where: {
        organizationId: tenant.organizationId,
        triggerEvent,
        channel,
      },
    });

    if (existing) {
      return corsResponse({
        error: `An automation rule for "${triggerEvent}" on "${channel}" already exists for this organization`,
      }, 409);
    }

    const rule = await db.automationRule.create({
      data: {
        organizationId: tenant.organizationId,
        triggerEvent,
        channel,
        templateId: templateId || null,
        delayMinutes: parsedDelay,
        fallbackChannel: fallbackChannel || null,
        isActive: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'automation_rule.create',
        details: `Created automation rule: ${triggerEvent} → ${channel}`,
      },
    });

    return corsResponse({
      success: true,
      data: rule,
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
