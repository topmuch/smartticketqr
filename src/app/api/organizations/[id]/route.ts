import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, PLAN_LIMITS } from '@/lib/api-helper';

/**
 * GET /api/organizations/[id] — Get organization details.
 * super_admin can view any org; others only their own.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    if (tenant.role !== 'super_admin' && tenant.organizationId !== id) {
      return corsResponse({ error: 'Not authorized to view this organization' }, 403);
    }

    const organization = await db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        uuid: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        email: true,
        phone: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        maxEvents: true,
        maxTicketsPerEvent: true,
        maxUsers: true,
        settings: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            events: true,
            tickets: true,
            scans: true,
            transactions: true,
          },
        },
      },
    });

    if (!organization) {
      return corsResponse({ error: 'Organization not found' }, 404);
    }

    return corsResponse({ organization });
  });
}

/**
 * PUT /api/organizations/[id] — Update organization settings.
 * super_admin or admin of the same org.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    if (tenant.role !== 'super_admin' && tenant.organizationId !== id) {
      return corsResponse({ error: 'Not authorized to update this organization' }, 403);
    }

    const existing = await db.organization.findUnique({ where: { id } });
    if (!existing) {
      return corsResponse({ error: 'Organization not found' }, 404);
    }

    const body = await request.json();
    const { name, email, phone, primaryColor, subscriptionPlan, subscriptionStatus, settings } = body;

    // If changing plan, update limits
    let maxEvents = existing.maxEvents;
    let maxTicketsPerEvent = existing.maxTicketsPerEvent;
    let maxUsers = existing.maxUsers;

    if (subscriptionPlan && subscriptionPlan !== existing.subscriptionPlan) {
      const limits = PLAN_LIMITS[subscriptionPlan] || PLAN_LIMITS.starter;
      maxEvents = limits.maxEvents;
      maxTicketsPerEvent = limits.maxTicketsPerEvent;
      maxUsers = limits.maxUsers;
    }

    const organization = await db.organization.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(primaryColor && { primaryColor }),
        ...(subscriptionPlan && { subscriptionPlan }),
        ...(subscriptionStatus && { subscriptionStatus }),
        ...(settings && { settings: JSON.stringify(settings) }),
        maxEvents,
        maxTicketsPerEvent,
        maxUsers,
      },
    });

    return corsResponse({ organization });
  });
}

/**
 * DELETE /api/organizations/[id] — Deactivate an organization.
 * super_admin only.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    if (tenant.role !== 'super_admin') {
      return corsResponse({ error: 'Only super admin can deactivate organizations' }, 403);
    }

    const { id } = await params;

    const existing = await db.organization.findUnique({ where: { id } });
    if (!existing) {
      return corsResponse({ error: 'Organization not found' }, 404);
    }

    const organization = await db.organization.update({
      where: { id },
      data: { isActive: false },
    });

    return corsResponse({ organization, message: 'Organization deactivated' });
  });
}

export async function OPTIONS() { return handleCors(); }
