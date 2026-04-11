import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

/**
 * Login with email + password (+ optional organizationId).
 *
 * Since email is only unique per organization, we need organizationId
 * to disambiguate. If no organizationId is provided, we try to find the
 * user across all orgs (first match wins).
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { email, password, organizationId } = body;

    if (!email || !password) {
      return corsResponse({ error: 'Email and password are required' }, 400);
    }

    // Find user: prefer scoped by organization, fall back to global
    let user;
    if (organizationId) {
      user = await db.user.findFirst({
        where: { email, organizationId },
        include: { organization: { select: { id: true, name: true, slug: true, primaryColor: true, subscriptionPlan: true, isActive: true } } },
      });
    } else {
      user = await db.user.findFirst({
        where: { email },
        include: { organization: { select: { id: true, name: true, slug: true, primaryColor: true, subscriptionPlan: true, isActive: true } } },
      });
    }

    if (!user) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
    }

    if (!user.isActive) {
      return corsResponse({ error: 'Account has been deactivated' }, 403);
    }

    if (!user.organization.isActive) {
      return corsResponse({ error: 'Organization has been deactivated' }, 403);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: 'user.login',
        details: `User logged in: ${user.email}`,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    const { password: _, organization, ...userWithoutPassword } = user;
    return corsResponse({
      user: { ...userWithoutPassword, organization },
      token,
    });
  });
}

export async function OPTIONS() { return handleCors(); }
