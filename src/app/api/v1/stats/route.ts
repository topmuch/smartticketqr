// ============================================================
// 📊 PUBLIC API v1 — Organization Statistics
// ============================================================
// GET: Returns comprehensive stats for the API key's organization.
// Uses OrgStatsCache when available for fast responses.
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getOrgStats } from '@/lib/stats-manager';
import {
  resolveApiKey,
  isApiKeyError,
  extractRateLimitHeaders,
  publicHandleCors,
} from '@/lib/api-key-auth';

export async function GET(request: NextRequest) {
  try {
    const context = await resolveApiKey(request);
    if (isApiKeyError(context)) return context;

    const { organizationId } = context;
    const rateHeaders = extractRateLimitHeaders(context);

    // Get cached stats (auto-refreshes if stale)
    const cachedStats = await getOrgStats(organizationId);

    // Fetch additional real-time counts that supplement the cache
    const [
      totalEvents,
      activeEvents,
      totalTickets,
      ticketsSold,
      recentActivity,
    ] = await Promise.all([
      // Total events ever created
      db.event.count({
        where: { organizationId },
      }),

      // Currently active events
      db.event.count({
        where: {
          organizationId,
          status: 'active',
          endDate: { gte: new Date() },
        },
      }),

      // Total tickets ever created
      db.ticket.count({
        where: { event: { organizationId } },
      }),

      // Non-cancelled tickets (sold)
      db.ticket.count({
        where: {
          event: { organizationId },
          status: { not: 'cancelled' },
        },
      }),

      // Recent activity (last 10 entries)
      db.activityLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    // Calculate total revenue from completed transactions
    const revenueResult = await db.transaction.aggregate({
      where: {
        organizationId,
        status: 'completed',
      },
      _sum: { amount: true },
    });

    const totalRevenue = revenueResult._sum.amount ?? 0;

    // Build response using cache + real-time data
    const validationRate = cachedStats
      ? Math.round((cachedStats.validationRate || 0) * 100 * 100) / 100
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          totalEvents,
          activeEvents,
          totalTickets,
          ticketsSold,
          totalRevenue,
          validationRate, // percentage (e.g., 67.5)
          recentActivity: recentActivity.map((log) => ({
            id: log.id,
            action: log.action,
            details: log.details,
            createdAt: log.createdAt,
            user: log.user,
          })),
          // Cached metrics (monthly/weekly/daily)
          cached: cachedStats
            ? {
                revenueThisMonth: cachedStats.totalRevenueMonth,
                ticketsSoldThisMonth: cachedStats.totalTicketsSoldMonth,
                scansToday: cachedStats.totalScansToday,
                scansThisWeek: cachedStats.totalScansWeek,
                activeEventsCached: cachedStats.totalActiveEvents,
                lastUpdated: cachedStats.lastUpdated,
              }
            : null,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...rateHeaders,
        },
      }
    );
  } catch (error) {
    console.error('[Public API v1 Stats Error]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function OPTIONS() {
  return publicHandleCors();
}
