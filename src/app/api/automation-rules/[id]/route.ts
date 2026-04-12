import { NextRequest } from 'next/server';
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
// Allowed values (matching the create route)
// ============================================================
const ALLOWED_TRIGGER_EVENTS = [
  'ticket_created', 'ticket_reminder', 'ticket_validated',
  'ticket_cancelled', 'scan_failed', 'scan_duplicate',
  'subscription_expired', 'subscription_created',
] as const;

const ALLOWED_CHANNELS = ['whatsapp', 'sms', 'email'] as const;

// ============================================================
// GET /api/automation-rules/[id] — Get single automation rule
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const rule = await db.automationRule.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!rule) {
      return corsResponse({ error: 'Automation rule not found' }, 404);
    }

    return corsResponse({
      success: true,
      data: rule,
    });
  });
}

// ============================================================
// PUT /api/automation-rules/[id] — Update automation rule
// ============================================================
// Body:
//   { triggerEvent?: string, channel?: string, templateId?: string,
//     delayMinutes?: number, fallbackChannel?: string, isActive?: boolean }
//
// Requires admin or super_admin role.
// ============================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;
    const body = await request.json();
    const { triggerEvent, channel, templateId, delayMinutes, fallbackChannel, isActive } = body;

    const existing = await db.automationRule.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Automation rule not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};

    if (triggerEvent !== undefined) {
      if (!(ALLOWED_TRIGGER_EVENTS as readonly string[]).includes(triggerEvent)) {
        return corsResponse({
          error: `triggerEvent must be one of: ${ALLOWED_TRIGGER_EVENTS.join(', ')}`,
        }, 400);
      }
      updateData.triggerEvent = triggerEvent;
    }

    if (channel !== undefined) {
      if (!(ALLOWED_CHANNELS as readonly string[]).includes(channel)) {
        return corsResponse({
          error: `channel must be one of: ${ALLOWED_CHANNELS.join(', ')}`,
        }, 400);
      }
      updateData.channel = channel;
    }

    if (templateId !== undefined) {
      updateData.templateId = typeof templateId === 'string' ? templateId : null;
    }

    if (delayMinutes !== undefined) {
      if (typeof delayMinutes !== 'number' || delayMinutes < 0) {
        return corsResponse({ error: 'delayMinutes must be a non-negative number' }, 400);
      }
      updateData.delayMinutes = Math.min(delayMinutes, 10080);
    }

    if (fallbackChannel !== undefined) {
      if (fallbackChannel !== null && !(ALLOWED_CHANNELS as readonly string[]).includes(fallbackChannel)) {
        return corsResponse({
          error: `fallbackChannel must be one of: ${ALLOWED_CHANNELS.join(', ')}`,
        }, 400);
      }
      updateData.fallbackChannel = fallbackChannel;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return corsResponse({ error: 'isActive must be a boolean' }, 400);
      }
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return corsResponse({
        error: 'No fields to update. Provide triggerEvent, channel, templateId, delayMinutes, fallbackChannel, or isActive.',
      }, 400);
    }

    const updated = await db.automationRule.update({
      where: { id },
      data: updateData,
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'automation_rule.update',
        details: `Updated automation rule: ${existing.triggerEvent} → ${existing.channel}`,
      },
    });

    return corsResponse({
      success: true,
      data: updated,
    });
  });
}

// ============================================================
// DELETE /api/automation-rules/[id] — Delete automation rule
// ============================================================
// Requires admin or super_admin role.
// ============================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    const existing = await db.automationRule.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
    });

    if (!existing) {
      return corsResponse({ error: 'Automation rule not found' }, 404);
    }

    await db.automationRule.delete({
      where: { id },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'automation_rule.delete',
        details: `Deleted automation rule: ${existing.triggerEvent} → ${existing.channel}`,
      },
    });

    return corsResponse({
      success: true,
      message: 'Automation rule deleted',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
