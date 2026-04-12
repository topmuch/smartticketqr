import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, parsePagination, PLAN_LIMITS } from '@/lib/api-helper';

/**
 * GET /api/organizations — List organizations.
 * - super_admin (platform-level) sees all organizations.
 * - Other users see only their own organization.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    // Build where clause based on role
    let where: Record<string, unknown>;
    if (tenant.role === 'super_admin') {
      where = {};
    } else {
      where = { id: tenant.organizationId };
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
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
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              events: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.organization.count({ where }),
    ]);

    return corsResponse({
      data: organizations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
}

/**
 * POST /api/organizations — Create a new organization.
 * Requires super_admin role.
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    if (tenant.role !== 'super_admin') {
      return corsResponse({ error: 'Only super admin can create organizations' }, 403);
    }

    const body = await request.json();
    const { name, slug, email, phone, primaryColor, subscriptionPlan } = body;

    if (!name || !slug) {
      return corsResponse({ error: 'Name and slug are required' }, 400);
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return corsResponse({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
    }

    // Check slug uniqueness
    const existingOrg = await db.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      return corsResponse({ error: 'Organization slug already taken' }, 409);
    }

    const plan = subscriptionPlan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

    const organization = await db.organization.create({
      data: {
        uuid: crypto.randomUUID(),
        name,
        slug,
        email: email || null,
        phone: phone || null,
        primaryColor: primaryColor || '#059669',
        subscriptionPlan: plan,
        maxEvents: limits.maxEvents,
        maxTicketsPerEvent: limits.maxTicketsPerEvent,
        maxUsers: limits.maxUsers,
      },
    });

    return corsResponse({ organization }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
