import { NextRequest } from 'next/server';
import {
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';
import { refreshOrgStats } from '@/lib/stats-manager';
import { logAudit } from '@/lib/audit-logger';

/**
 * POST /api/stats/refresh — Force-refresh the organization stats cache.
 * Admin+ only. Logs the action as a data export event.
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

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
