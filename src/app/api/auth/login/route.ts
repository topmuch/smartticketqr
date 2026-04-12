import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

/**
 * Login with email + password (+ optional organizationId).
 *
 * Security:
 *  - Rate limited: 5 attempts per 15 minutes per IP+email
 *  - Generic error messages to prevent email enumeration
 *  - Activity logging for audit trail
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // ─── Rate limiting: 5 attempts per 15 min per IP+email ───
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const body = await request.json();
    const { email, password, organizationId } = body;

    // Pre-check rate limit using IP alone (before we even validate the body)
    const ipRateKey = `login:ip:${clientIp}`;
    const ipRate = checkRateLimit(ipRateKey, 10, 15 * 60 * 1000); // 10 per 15 min per IP
    if (!ipRate.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(ipRate),
            'Retry-After': String(Math.ceil(ipRate.resetAt / 1000)),
          },
        }
      );
    }

    if (!email || !password) {
      return corsResponse({ error: 'Email and password are required' }, 400);
    }

    // Per-email rate limiting: 5 per 15 min
    const emailRateKey = `login:email:${email.toLowerCase()}`;
    const emailRate = checkRateLimit(emailRateKey, 5, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts for this email. Please try again later.' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(emailRate),
            'Retry-After': String(Math.ceil(emailRate.resetAt / 1000)),
          },
        }
      );
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

    // Generic "Invalid credentials" for both user-not-found and wrong password
    if (!user) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
    }

    if (!user.isActive) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
    }

    if (!user.organization.isActive) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
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
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
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
