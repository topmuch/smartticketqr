import { db } from '@/lib/db';

// ============================================================
// 📊 STATS MANAGER — Cached KPI computation for dashboards
// ============================================================
// Computes aggregate statistics per organization and caches them
// in the OrgStatsCache table. Cache auto-refreshes when older
// than 5 minutes to keep dashboards responsive.
// ============================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Force-compute all KPIs for an organization and upsert the cache.
 * This performs multiple parallel DB queries to aggregate data.
 */
export async function refreshOrgStats(orgId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    revenueMonthResult,
    ticketsSoldMonthResult,
    scansToday,
    scansWeek,
    totalTicketsAll,
    activeEvents,
    validationRateResult,
  ] = await Promise.all([
    // Total revenue this month (completed transactions)
    db.transaction.aggregate({
      where: {
        status: 'completed',
        organizationId: orgId,
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),

    // Tickets sold this month
    db.ticket.count({
      where: {
        event: { organizationId: orgId },
        status: { not: 'cancelled' },
        createdAt: { gte: monthStart },
      },
    }),

    // Scans today
    db.scan.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: todayStart },
      },
    }),

    // Scans this week
    db.scan.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: weekAgo },
      },
    }),

    // Total tickets ever
    db.ticket.count({
      where: {
        event: { organizationId: orgId },
      },
    }),

    // Active events
    db.event.count({
      where: {
        status: 'active',
        organizationId: orgId,
      },
    }),

    // Validation rate: used / (used + active non-cancelled)
    db.$queryRawUnsafe<Array<{ rate: number | null }>>(`
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN 0.0
          ELSE CAST(SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)
        END as rate
      FROM "Ticket"
      WHERE "eventId" IN (SELECT id FROM "Event" WHERE "organizationId" = ?)
        AND status IN ('active', 'used')
    `, orgId),
  ]);

  const stats = {
    totalRevenueMonth: revenueMonthResult._sum.amount ?? 0,
    totalTicketsSoldMonth: ticketsSoldMonthResult,
    totalScansToday: scansToday,
    totalScansWeek: scansWeek,
    totalTicketsAll,
    totalActiveEvents: activeEvents,
    validationRate: validationRateResult[0]?.rate ?? 0,
  };

  // Upsert cache
  const cache = await db.orgStatsCache.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      ...stats,
      lastUpdated: now,
    },
    update: {
      ...stats,
      lastUpdated: now,
    },
  });

  return cache;
}

/**
 * Get cached stats for an organization. Auto-refreshes if cache is
 * older than 5 minutes or doesn't exist yet.
 */
export async function getOrgStats(orgId: string, forceRefresh = false) {
  if (forceRefresh) {
    return refreshOrgStats(orgId);
  }

  const cached = await db.orgStatsCache.findUnique({
    where: { organizationId: orgId },
  });

  if (!cached) {
    return refreshOrgStats(orgId);
  }

  const age = Date.now() - cached.lastUpdated.getTime();
  if (age > CACHE_TTL_MS) {
    return refreshOrgStats(orgId);
  }

  return cached;
}

/**
 * Daily revenue breakdown for the last N days.
 */
export async function getDailyRevenue(
  orgId: string,
  days = 7
): Promise<Array<{ date: string; revenue: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db.$queryRawUnsafe<Array<{ date: string; revenue: number }>>(`
    SELECT DATE(createdAt) as date, COALESCE(SUM(amount), 0) as revenue
    FROM "Transaction"
    WHERE "organizationId" = ?
      AND status = 'completed'
      AND createdAt >= ?
    GROUP BY DATE(createdAt)
    ORDER BY date ASC
  `, orgId, startDate.toISOString());

  // Fill in zero-revenue days
  const result: Array<{ date: string; revenue: number }> = [];
  const resultMap = new Map(rows.map((r) => [r.date, r.revenue]));

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      revenue: resultMap.get(dateStr) ?? 0,
    });
  }

  return result;
}

/**
 * Validation rate = used tickets / (used + active tickets).
 */
export async function getValidationRate(orgId: string): Promise<number> {
  const result = await db.$queryRawUnsafe<Array<{ rate: number | null }>>(`
    SELECT
      CASE
        WHEN COUNT(*) = 0 THEN 0.0
        ELSE CAST(SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)
      END as rate
    FROM "Ticket"
    WHERE "eventId" IN (SELECT id FROM "Event" WHERE "organizationId" = ?)
      AND status IN ('active', 'used')
  `, orgId);

  return result[0]?.rate ?? 0;
}

/**
 * Top events by revenue, tickets sold, and scan count.
 */
export async function getTopEvents(
  orgId: string,
  limit = 5
): Promise<Array<{ id: string; name: string; revenue: number; ticketsSold: number; scans: number }>> {
  const events = await db.event.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      soldTickets: true,
      _count: { select: { scans: true } },
      transactions: {
        where: { status: 'completed' },
        select: { amount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // fetch more, then sort by revenue
  });

  const enriched = events.map((e) => ({
    id: e.id,
    name: e.name,
    revenue: e.transactions.reduce((sum, t) => sum + t.amount, 0),
    ticketsSold: e.soldTickets,
    scans: e._count.scans,
  }));

  enriched.sort((a, b) => b.revenue - a.revenue);

  return enriched.slice(0, limit);
}

/**
 * Hourly scan traffic for a given date (default: today).
 * Returns 24-hour buckets (0-23).
 */
export async function getHourlyTraffic(
  orgId: string,
  date?: Date
): Promise<Array<{ hour: number; scans: number }>> {
  const targetDate = date ?? new Date();
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

  const rows = await db.$queryRawUnsafe<Array<{ hour: number; scans: bigint }>>(`
    SELECT
      CAST(strftime('%H', createdAt) AS INTEGER) as hour,
      COUNT(*) as scans
    FROM "Scan"
    WHERE "organizationId" = ?
      AND createdAt >= ?
      AND createdAt <= ?
    GROUP BY strftime('%H', createdAt)
    ORDER BY hour ASC
  `, orgId, dayStart.toISOString(), dayEnd.toISOString());

  // Fill in zero-scan hours
  const resultMap = new Map(rows.map((r) => [r.hour, Number(r.scans)]));
  const result: Array<{ hour: number; scans: number }> = [];

  for (let h = 0; h < 24; h++) {
    result.push({
      hour: h,
      scans: resultMap.get(h) ?? 0,
    });
  }

  return result;
}

/**
 * Ticket type distribution for an organization.
 */
export async function getTicketTypeDistribution(
  orgId: string
): Promise<Array<{ type: string; count: number }>> {
  const rows = await db.$queryRawUnsafe<Array<{ type: string; count: bigint }>>(`
    SELECT ticketType as type, COUNT(*) as count
    FROM "Ticket"
    WHERE "eventId" IN (SELECT id FROM "Event" WHERE "organizationId" = ?)
    GROUP BY ticketType
    ORDER BY count DESC
  `, orgId);

  return rows.map((r) => ({
    type: r.type,
    count: Number(r.count),
  }));
}

/**
 * Weekly revenue breakdown for the last N weeks.
 * Each "week" is labeled by the Monday start date.
 */
export async function getWeeklyRevenue(
  orgId: string,
  weeks = 8
): Promise<Array<{ week: string; revenue: number; tickets: number }>> {
  const startDate = new Date();
  // Go back to (weeks-1) weeks ago Monday
  const dayOfWeek = startDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startDate.setDate(startDate.getDate() - daysToMonday - (weeks - 1) * 7);
  startDate.setHours(0, 0, 0, 0);

  const revenueRows = await db.$queryRawUnsafe<Array<{ weekStart: string; revenue: number }>>(`
    SELECT
      DATE(createdAt, 'weekday 0', '-6 days') as weekStart,
      COALESCE(SUM(amount), 0) as revenue
    FROM "Transaction"
    WHERE "organizationId" = ?
      AND status = 'completed'
      AND createdAt >= ?
    GROUP BY weekStart
    ORDER BY weekStart ASC
  `, orgId, startDate.toISOString());

  const ticketRows = await db.$queryRawUnsafe<Array<{ weekStart: string; tickets: bigint }>>(`
    SELECT
      DATE(createdAt, 'weekday 0', '-6 days') as weekStart,
      COUNT(*) as tickets
    FROM "Ticket"
    WHERE "eventId" IN (SELECT id FROM "Event" WHERE "organizationId" = ?)
      AND createdAt >= ?
    GROUP BY weekStart
    ORDER BY weekStart ASC
  `, orgId, startDate.toISOString());

  const revenueMap = new Map(revenueRows.map((r) => [r.weekStart, r.revenue]));
  const ticketMap = new Map(ticketRows.map((r) => [r.weekStart, Number(r.tickets)]));

  const result: Array<{ week: string; revenue: number; tickets: number }> = [];
  for (let w = 0; w < weeks; w++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + w * 7);
    const weekStr = d.toISOString().split('T')[0];
    result.push({
      week: weekStr,
      revenue: revenueMap.get(weekStr) ?? 0,
      tickets: ticketMap.get(weekStr) ?? 0,
    });
  }

  return result;
}
