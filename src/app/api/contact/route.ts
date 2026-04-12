import { NextRequest } from 'next/server';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

/**
 * Contact form submission endpoint.
 * Validates input and stores for processing (email notification placeholder).
 *
 * Rate limited: 3 submissions per hour per IP.
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rateKey = `contact:ip:${clientIp}`;
    const rate = checkRateLimit(rateKey, 3, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rate) }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, subject, message } = body;

    // Input validation
    if (!firstName || !email || !message) {
      return corsResponse({ error: 'First name, email, and message are required' }, 400);
    }

    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsResponse({ error: 'Invalid email address' }, 400);
    }

    if (message.length < 10 || message.length > 5000) {
      return corsResponse({ error: 'Message must be between 10 and 5000 characters' }, 400);
    }

    if (subject && subject.length > 200) {
      return corsResponse({ error: 'Subject must be under 200 characters' }, 400);
    }

    // TODO: In production, send via email service (Resend, SendGrid, etc.)
    // For now, log the contact submission
    console.log('[Contact Form]', {
      firstName,
      lastName: lastName || '',
      email,
      subject: subject || 'No subject',
      messageLength: message.length,
      ip: clientIp,
      timestamp: new Date().toISOString(),
    });

    return corsResponse({
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons sous 24 heures.',
    }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
