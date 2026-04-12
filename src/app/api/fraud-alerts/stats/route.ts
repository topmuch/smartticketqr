import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';

// ============================================================
// GET /api/fraud-alerts/stats — Fraud statistics for org dashboard
// ============================================================
// Returns aggregated fraud alert statistics:
//   - Total alerts, alerts by status
//   - Alerts by severity
//   - Alerts by rule type
//   - Recent alerts count (last 7 days, last 30 days)
//
// Query params:
//   ?days=30 — lookback period in days (default: 30)
//
// Tenant-isolated by organizationId.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)));

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const orgWhere = { organizationId: tenant.organizationId };

    // Total counts and aggregates
    const [totalAll, totalPeriod, byStatus, bySeverity, byRuleType] = await Promise.all([
      // Total alerts ever
      db.fraudAlert.count({ where: orgWhere }),

      // Total alerts in period
      db.fraudAlert.count({
        where: { ...orgWhere, createdAt: { gte: sinceDate } },
      }),

      // By status (all time)
      db.fraudAlert.groupBy({
        by: ['status'],
        where: orgWhere,
        _count: true,
      }),

      // By severity (all time)
      db.fraudAlert.groupBy({
        by: ['severity'],
        where: orgWhere,
        _count: true,
      }),

      // By ruleType (all time)
      db.fraudAlert.groupBy({
        by: ['ruleType'],
        where: orgWhere,
        _count: true,
      }),
    ]);

    // Recent period counts (7 days and 30 days)
    const since7d = new Date();
    since7d.setDate(since7d.getDate() - 7);

    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);

    const [last7Days, last30Days] = await Promise.all([
      db.fraudAlert.count({
        where: { ...orgWhere, createdAt: { gte: since7d } },
      }),
      db.fraudAlert.count({
        where: { ...orgWhere, createdAt: { gte: since30d } },
      }),
    ]);

    // Unresolved (flagged) count
    const unresolvedCount = await db.fraudAlert.count({
      where: { ...orgWhere, status: 'flagged' },
    });

    return corsResponse({
      success: true,
      data: {
        totalAlerts: totalAll,
        alertsInPeriod: totalPeriod,
        unresolvedAlerts: unresolvedCount,
        last7Days,
        last30Days,
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count])),
        byRuleType: Object.fromEntries(byRuleType.map((r) => [r.ruleType, r._count])),
      },
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
