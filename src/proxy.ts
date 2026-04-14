import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// ---------------------------------------------------------------------------
// Supported locales for i18n
// ---------------------------------------------------------------------------
const SUPPORTED_LOCALES = ['fr', 'en', 'pt', 'es'] as const;
const DEFAULT_LOCALE = 'fr';

// ---------------------------------------------------------------------------
// API paths that are PUBLIC (no JWT required)
// ---------------------------------------------------------------------------
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/seed',
  '/api/ticket/public',
  '/api/v1/',
  '/api/i18n',           // i18n translations (read-only)
  '/api/contact',
  '/api/display/',
  '/api/board',
  '/api/subscription-plans',
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname.startsWith(p));
}

// ---------------------------------------------------------------------------
// Paths that should bypass the proxy entirely (internal Next.js routes)
// ---------------------------------------------------------------------------
const SKIP_PATHS = [
  /^\/_next\//,       // Next.js static assets & internals
  /^\/__nextjs/,      // Next.js development helpers
];

// ---------------------------------------------------------------------------
// Detect locale from Accept-Language header
// ---------------------------------------------------------------------------
function detectLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const lang = acceptLanguage.toLowerCase().split(',')[0]?.trim() || '';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('pt')) return 'pt';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Common bot / attack paths that should be blocked outright
// ---------------------------------------------------------------------------
const BLOCKED_PATHS = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.env.development',
  '/.env.backup',
  '/wp-admin',
  '/wp-login.php',
  '/wp-config.php',
  '/wp-content',
  '/wp-includes',
  '/phpmyadmin',
  '/pma',
  '/config.php',
  '/.git',
  '/.git/config',
  '/.git/HEAD',
  '/.gitignore',
  '/.svn',
  '/.svn/entries',
  '/.hg',
  '/.DS_Store',
  '/server-status',
  '/server-info',
  '/.htaccess',
  '/.htpasswd',
  '/wp-cron.php',
  '/xmlrpc.php',
  '/cgi-bin/',
  '/console/',
  '/actuator/',
  '/admin',
  '/phpinfo.php',
  '/.bash_history',
  '/.mysql_history',
  '/web.config',
];

// ---------------------------------------------------------------------------
// JWT Secret resolver (Edge-compatible)
// ---------------------------------------------------------------------------
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET not set');
    }
    return new TextEncoder().encode('dev-only-insecure-key-do-not-use-in-production');
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// SECURITY HEADERS — applied to all responses
// ---------------------------------------------------------------------------
function applySecurityHeaders(response: NextResponse, isProduction: boolean): void {
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)',
  );

  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  const startMs = Date.now();
  response.headers.set('Server-Timing', `proxy;desc="Proxy Start";dur=${startMs}`);

  if (!isProduction) {
    response.headers.set('X-Powered-By', 'SmartTicketQR');
  }
}

// ---------------------------------------------------------------------------
// MAIN PROXY FUNCTION
// ---------------------------------------------------------------------------
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';

  // -----------------------------------------------------------------------
  // 1. Skip internal Next.js routes
  // -----------------------------------------------------------------------
  if (SKIP_PATHS.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }

  // -----------------------------------------------------------------------
  // 2. Block common bot / attack paths
  // -----------------------------------------------------------------------
  const normalised = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  if (BLOCKED_PATHS.some((blocked) => normalised === blocked || normalised.startsWith(blocked + '/'))) {
    return new NextResponse(null, { status: 404, statusText: 'Not Found' });
  }

  // -----------------------------------------------------------------------
  // 3. Handle API routes — JWT verification + IDOR prevention
  // -----------------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    // Block seed in production even at proxy level
    if (pathname.startsWith('/api/auth/seed') && isProduction) {
      const res = NextResponse.json(
        { error: 'Seed endpoint is disabled in production' },
        { status: 403 }
      );
      applySecurityHeaders(res, isProduction);
      return res;
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      const res = new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
      return res;
    }

    // Public API endpoints — pass through without JWT
    if (isPublicApiPath(pathname)) {
      return NextResponse.next();
    }

    // Protected API endpoints — verify JWT
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      const res = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
      applySecurityHeaders(res, isProduction);
      return res;
    }

    const token = authHeader.substring(7);

    try {
      const secret = getJwtSecret();
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      const userId = payload.userId as string | undefined;
      const organizationId = payload.organizationId as string | undefined;
      const role = payload.role as string | undefined;

      if (!userId || !organizationId) {
        const res = NextResponse.json(
          { error: 'Token missing required claims' },
          { status: 401 }
        );
        applySecurityHeaders(res, isProduction);
        return res;
      }

      // ── IDOR PREVENTION: Strip client-supplied org headers ──
      const requestHeaders = new Headers(request.headers);
      requestHeaders.delete('x-organization-id');
      requestHeaders.delete('x-org-id');

      // ── INJECT server-verified headers from JWT ──
      requestHeaders.set('x-verified-user-id', userId);
      requestHeaders.set('x-verified-org-id', organizationId);
      if (role) {
        requestHeaders.set('x-verified-role', role);
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (err) {
      console.warn(
        `[Proxy] JWT verification failed for ${pathname}:`,
        err instanceof Error ? err.message : err
      );

      const res = NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
      applySecurityHeaders(res, isProduction);
      return res;
    }
  }

  // -----------------------------------------------------------------------
  // 4. Page routes — security headers + i18n locale detection
  // -----------------------------------------------------------------------
  const response = NextResponse.next();
  applySecurityHeaders(response, isProduction);

  // --- i18n locale detection (cookie → Accept-Language → default) ---
  const localeCookie = request.cookies.get('smartticket-lang')?.value;
  let detectedLocale: string;

  if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie as typeof SUPPORTED_LOCALES[number])) {
    detectedLocale = localeCookie;
  } else {
    detectedLocale = detectLocaleFromHeader(request.headers.get('Accept-Language'));
    response.cookies.set('smartticket-lang', detectedLocale, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
  }

  response.headers.set('X-Detected-Locale', detectedLocale);

  return response;
}

// ---------------------------------------------------------------------------
// Matcher — run on every request except Next.js internals
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Match all pathnames except:
     *  - /_next/static (static files)
     *  - /_next/image (image optimisation)
     *  - /favicon.ico
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
