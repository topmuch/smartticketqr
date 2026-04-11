import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, corsResponse, withErrorHandler, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    // Run all queries in parallel
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
      // Total tickets
      db.ticket.count(),

      // Sold tickets (non-cancelled)
      db.ticket.count({ where: { status: { not: 'cancelled' } } }),

      // Used tickets
      db.ticket.count({ where: { status: 'used' } }),

      // Total revenue
      db.transaction.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),

      // Tickets by status
      db.ticket.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Revenue by event
      db.transaction.groupBy({
        by: ['eventId'],
        where: { status: 'completed' },
        _sum: { amount: true },
        having: { amount: { _sum: { gt: 0 } } },
      }),

      // Scans today
      db.scan.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // Scans this week
      db.scan.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent activity (last 20)
      db.activityLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),

      // Active events count
      db.event.count({ where: { status: 'active' } }),

      // Total users
      db.user.count({ where: { isActive: true } }),
    ]);

    // Fetch event names for revenue by event
    const eventIds = revenueByEvent.map(r => r.eventId);
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

    // Daily scans for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyScans = await db.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM "Scan"
      WHERE createdAt >= ?
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, sevenDaysAgo.toISOString());

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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
