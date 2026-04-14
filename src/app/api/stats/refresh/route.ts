import { NextRequest, NextResponse } from 'next/server';
import {
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { refreshOrgStats } from '@/lib/stats-manager';
import { logAudit } from '@/lib/audit-logger';

/**
 * POST /api/stats/refresh — Force-refresh the organization stats cache.
 * Admin+ only. Logs the action as a data export event.
 * Rate limited: 5 refreshes per 5 minutes per org.
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    // Rate limit: 5 per 5 minutes per organization
    const rateKey = `stats-refresh:${tenant.organizationId}`;
    const rate = checkRateLimit(rateKey, 5, 5 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many refresh requests. Please wait a few minutes.' },
        { status: 429, headers: getRateLimitHeaders(rate) }
      );
    }

    const cache = await refreshOrgStats(tenant.organizationId);

    // Log the refresh as a data export action
    await logAudit({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      action: 'DATA_EXPORT',
      severity: 'info',
      request,
      details: {
        triggeredBy: 'stats_refresh',
        refreshedAt: new Date().toISOString(),
      },
    });

    return corsResponse({
      message: 'Stats cache refreshed successfully',
      stats: cache,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
