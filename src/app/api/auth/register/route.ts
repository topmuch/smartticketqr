import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, tenantWhere } from '@/lib/api-helper';

/**
 * Register a new user within an organization.
 *
 * Two modes:
 *  1. Tenant-scoped (normal): requires valid JWT + X-Organization-Id header.
 *     Only admin/super_admin can register users. First user of an org becomes super_admin.
 *  2. Self-service: if no Authorization header but body has `organizationId`,
 *     allow creating the first user of a new org (the registrant becomes super_admin).
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { name, email, password, role } = body;
    const orgIdFromBody = body.organizationId;

    if (!name || !email || !password) {
      return corsResponse({ error: 'Name, email, and password are required' }, 400);
    }

    // --- Self-service mode: create first user of a new org ---
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ') && !orgIdFromBody) {
      return corsResponse({ error: 'Organization ID is required for registration' }, 400);
    }

    // Determine the target organization
    let organizationId: string;
    let userRole: string;

    if (!authHeader?.startsWith('Bearer ')) {
      // Self-service: verify the org exists
      const org = await db.organization.findUnique({ where: { id: orgIdFromBody } });
      if (!org) {
        return corsResponse({ error: 'Organization not found' }, 404);
      }
      if (!org.isActive) {
        return corsResponse({ error: 'Organization is not active' }, 403);
      }
      organizationId = org.id;

      // Check if this would be the first user of the org
      const existingUserCount = await db.user.count({
        where: { organizationId },
      });
      if (existingUserCount === 0) {
        userRole = 'super_admin';
      } else {
        return corsResponse({ error: 'This organization already has users. Please log in instead.' }, 400);
      }
    } else {
      // Tenant-scoped: resolve tenant from JWT + header
      const tenant = resolveTenant(request);
      if (isErrorResponse(tenant)) return tenant;

      if (!['super_admin', 'admin'].includes(tenant.role)) {
        return corsResponse({ error: 'Only admins can register new users' }, 403);
      }

      organizationId = tenant.organizationId;

      // Check subscription plan user limit
      const org = await db.organization.findUnique({ where: { id: organizationId } });
      if (org) {
        const currentUsers = await db.user.count({ where: { organizationId } });
        const { PLAN_LIMITS } = await import('@/lib/api-helper');
        const limits = PLAN_LIMITS[org.subscriptionPlan] || PLAN_LIMITS.starter;
        if (currentUsers >= limits.maxUsers) {
          return corsResponse({ error: `User limit (${limits.maxUsers}) reached for your plan` }, 403);
        }
      }

      userRole = role || 'operator';
    }

    // Check if user already exists in THIS organization
    const existingUser = await db.user.findFirst({
      where: { email, organizationId },
    });
    if (existingUser) {
      return corsResponse({ error: 'Email already registered in this organization' }, 409);
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        organizationId,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: 'user.register',
        details: `New user registered: ${user.email} with role ${userRole}`,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    const { password: _, ...userWithoutPassword } = user;
    return corsResponse({ user: userWithoutPassword, token }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
