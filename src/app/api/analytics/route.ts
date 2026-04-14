import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

/**
 * GET /api/analytics — Organization-scoped dashboard analytics.
 * All queries are filtered by the tenant's organizationId.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const orgId = tenant.organizationId;

    // Run all queries in parallel, filtered by organizationId
    const [
      totalTickets,
      soldTickets,
      usedTickets,
      revenueResult,
      ticketsByStatus,
      revenueByEvent,
      scansTodayResult,
      scansThisWeekResult,
      recentActivity,
      activeEvents,
      totalUsers,
    ] = await Promise.all([
      // Total tickets (via event organizationId)
      db.ticket.count({
        where: { event: { organizationId: orgId } },
      }),

      // Sold tickets (non-cancelled)
      db.ticket.count({
        where: {
          event: { organizationId: orgId },
          status: { not: 'cancelled' },
        },
      }),

      // Used tickets
      db.ticket.count({
        where: {
          event: { organizationId: orgId },
          status: 'used',
        },
      }),

      // Total revenue (transaction has direct organizationId)
      db.transaction.aggregate({
        where: { status: 'completed', organizationId: orgId },
        _sum: { amount: true },
      }),

      // Tickets by status (via event organizationId)
      db.ticket.groupBy({
        by: ['status'],
        where: { event: { organizationId: orgId } },
        _count: true,
      }),

      // Revenue by event (transaction has direct organizationId)
      db.transaction.groupBy({
        by: ['eventId'],
        where: { status: 'completed', organizationId: orgId },
        _sum: { amount: true },
        having: { amount: { _sum: { gt: 0 } } },
      }),

      // Scans today
      db.scan.count({
        where: {
          organizationId: orgId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // Scans this week
      db.scan.count({
        where: {
          organizationId: orgId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent activity (last 20)
      db.activityLog.findMany({
        where: { organizationId: orgId },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),

      // Active events count
      db.event.count({
        where: { status: 'active', organizationId: orgId },
      }),

      // Total users
      db.user.count({
        where: { isActive: true, organizationId: orgId },
      }),
    ]);

    // Fetch event names for revenue by event
    const eventIds = revenueByEvent.map(r => r.eventId).filter((id): id is string => Boolean(id));
    const events = eventIds.length > 0
      ? await db.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true },
        })
      : [];

    const eventMap = Object.fromEntries(events.map(e => [e.id, e.name]));
    const revenueByEventNamed = revenueByEvent
      .filter(r => r.eventId !== null)
      .map(r => ({
        eventId: r.eventId,
        eventName: eventMap[r.eventId!] || 'Unknown',
        revenue: r._sum.amount || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Format tickets by status
    const ticketsByStatusFormatted = ticketsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Daily scans for the last 7 days (raw SQL with organizationId filter)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyScans = await db.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM "Scan"
      WHERE createdAt >= ? AND organizationId = ?
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, sevenDaysAgo.toISOString(), orgId);

    return corsResponse({
      totalTickets,
      soldTickets,
      usedTickets,
      totalRevenue: revenueResult._sum.amount || 0,
      ticketsByStatus: ticketsByStatusFormatted,
      revenueByEvent: revenueByEventNamed,
      scansToday: scansTodayResult,
      scansThisWeek: scansThisWeekResult,
      recentActivity,
      activeEvents,
      totalUsers,
      dailyScans: dailyScans.map(d => ({
        date: d.date,
        count: Number(d.count),
      })),
    });
  });
}

export async function OPTIONS() { return handleCors(); }
