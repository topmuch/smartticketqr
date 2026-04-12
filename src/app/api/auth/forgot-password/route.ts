import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

/**
 * POST /api/auth/forgot-password
 * Requests a password reset link for the given email.
 *
 * Security:
 *  - Rate limited: 3 requests per hour per IP
 *  - Generic success message (prevents email enumeration)
 *  - Logs the request for audit
 *
 * TODO: In production, integrate with an email service (Resend, SendGrid)
 * to actually send the reset link. For now, this logs the request.
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // Rate limiting: 3 per hour per IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rateKey = `forgot-pw:ip:${clientIp}`;
    const rate = checkRateLimit(rateKey, 3, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rate) }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || email.length > 200) {
      return corsResponse({ error: 'A valid email address is required' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsResponse({ error: 'Invalid email format' }, 400);
    }

    // Check if user exists (but don't reveal the result)
    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true },
    });

    if (user) {
      // TODO: Generate reset token, store in DB with expiry, send email
      console.log('[Forgot Password] Reset requested for:', {
        userId: user.id,
        email: email.toLowerCase(),
        ip: clientIp,
        timestamp: new Date().toISOString(),
      });
    }

    // Always return success to prevent email enumeration
    return corsResponse({
      success: true,
      message: 'Si un compte existe avec cette adresse email, vous recevrez un lien de r\u00e9initialisation sous quelques minutes.',
    });
  });
}

export async function OPTIONS() { return handleCors(); }
