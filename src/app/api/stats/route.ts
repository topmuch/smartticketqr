import { NextRequest } from 'next/server';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';
import {
  getOrgStats,
  getDailyRevenue,
  getHourlyTraffic,
  getTopEvents,
  getTicketTypeDistribution,
} from '@/lib/stats-manager';

/**
 * GET /api/stats — Enhanced analytics endpoint.
 * Returns cached KPIs plus real-time computed breakdowns.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const orgId = tenant.organizationId;

    // Fetch cached KPIs + real-time breakdowns in parallel
    const [stats, dailyRevenue, hourlyTraffic, topEvents, ticketTypeDistribution] =
      await Promise.all([
        getOrgStats(orgId),
        getDailyRevenue(orgId, 7),
        getHourlyTraffic(orgId),
        getTopEvents(orgId, 5),
        getTicketTypeDistribution(orgId),
      ]);

    return corsResponse({
      // Cached KPIs
      kpis: {
        totalRevenueMonth: stats.totalRevenueMonth,
        totalTicketsSoldMonth: stats.totalTicketsSoldMonth,
        totalScansToday: stats.totalScansToday,
        totalScansWeek: stats.totalScansWeek,
        totalTicketsAll: stats.totalTicketsAll,
        totalActiveEvents: stats.totalActiveEvents,
        validationRate: stats.validationRate,
        lastUpdated: stats.lastUpdated,
      },
      // Real-time breakdowns
      dailyRevenue,
      hourlyTraffic,
      topEvents,
      ticketTypeDistribution,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
