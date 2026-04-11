import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Paths that should bypass the middleware entirely (internal Next.js routes)
// ---------------------------------------------------------------------------
const SKIP_PATHS = [
  /^\/_next\//,       // Next.js static assets & internals
  /^\/api\//,         // API routes (handle their own headers)
  /^\/__nextjs/,      // Next.js development helpers
];

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // 3. Build the response with security headers
  // -----------------------------------------------------------------------
  const response = NextResponse.next();

  const isProduction = process.env.NODE_ENV === 'production';

  // --- Content-Security-Policy ---
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

  // --- X-Content-Type-Options ---
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // --- X-Frame-Options ---
  response.headers.set('X-Frame-Options', 'DENY');

  // --- X-XSS-Protection ---
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // --- Referrer-Policy ---
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // --- Permissions-Policy ---
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)',
  );

  // --- Strict-Transport-Security (production only) ---
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  // --- Server-Timing (performance monitoring) ---
  const startMs = Date.now();
  // We record the start time so downstream handlers (or a trailing
  // instrumentation hook) can compute the elapsed duration.
  response.headers.set('Server-Timing', `middleware;desc="Middleware Start";dur=${startMs}`);

  // --- X-Powered-By (non-production only) ---
  if (!isProduction) {
    response.headers.set('X-Powered-By', 'SmartTicketQR');
  }

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
