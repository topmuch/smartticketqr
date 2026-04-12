import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  tenantWhereWith,
} from '@/lib/api-helper';

/**
 * GET /api/display/stats?eventId=xxx
 *
 * Statistiques d'affichage pour les écrans kiosques.
 * Si eventId est fourni, les stats sont scoped à l'événement, sinon organisation-wide.
 * Utilise OrgStatsCache si disponible, sinon calcule depuis les Scan.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const orgId = tenant.organizationId;

    if (eventId) {
      // Statistiques par événement — toujours calculées en temps réel
      return corsResponse(await computeEventStats(orgId, eventId));
    }

    // Statistiques org-wide — essayer le cache d'abord
    const cached = await db.orgStatsCache.findUnique({
      where: { organizationId: orgId },
    });

    if (cached) {
      // Compléter les données manquantes du cache avec des requêtes ciblées
      const lastScan = await db.scan.findFirst({
        where: tenantWhereWith(orgId, {}),
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      // Compter les scans rejetés pour compléter le cache
      const rejectedScans = await db.scan.count({
        where: tenantWhereWith(orgId, { result: { not: 'valid' } }),
      });

      const validScans = await db.scan.count({
        where: tenantWhereWith(orgId, { result: 'valid' }),
      });
      const totalScans = validScans + rejectedScans;
      const validationRate = totalScans > 0 ? Math.round((validScans / totalScans) * 1000) / 10 : 0;

      return corsResponse({
        totalScans,
        validScans,
        rejectedScans,
        validationRate,
        activeTickets: cached.totalTicketsAll,
        eventCapacity: cached.totalActiveEvents > 0 ? cached.totalActiveEvents * 500 : 0, // Estimation
        occupancyRate: cached.totalTicketsAll > 0
          ? Math.round((cached.totalTicketsAll / Math.max(1, cached.totalActiveEvents * 500)) * 1000) / 10
          : 0,
        lastScanAt: lastScan?.createdAt ?? null,
      });
    }

    // Pas de cache — calcul complet
    return corsResponse(await computeOrgStats(orgId));
  });
}

/**
 * Calcule les statistiques pour un événement spécifique.
 */
async function computeEventStats(orgId: string, eventId: string) {
  const [totalScans, validScans, rejectedScans, lastScan, event] = await Promise.all([
    db.scan.count({
      where: tenantWhereWith(orgId, { eventId }),
    }),
    db.scan.count({
      where: tenantWhereWith(orgId, { eventId, result: 'valid' }),
    }),
    db.scan.count({
      where: tenantWhereWith(orgId, { eventId, result: { not: 'valid' } }),
    }),
    db.scan.findFirst({
      where: tenantWhereWith(orgId, { eventId }),
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    db.event.findFirst({
      where: { id: eventId, organizationId: orgId },
      select: {
        totalTickets: true,
        soldTickets: true,
      },
    }),
  ]);

  const validationRate = totalScans > 0
    ? Math.round((validScans / totalScans) * 1000) / 10
    : 0;

  const eventCapacity = event?.totalTickets ?? 0;
  const activeTickets = event?.soldTickets ?? 0;
  const occupancyRate = eventCapacity > 0
    ? Math.round((activeTickets / eventCapacity) * 1000) / 10
    : 0;

  return {
    totalScans,
    validScans,
    rejectedScans,
    validationRate,
    activeTickets,
    eventCapacity,
    occupancyRate,
    lastScanAt: lastScan?.createdAt ?? null,
  };
}

/**
 * Calcule les statistiques org-wide à partir des données brutes.
 */
async function computeOrgStats(orgId: string) {
  const [totalScans, validScans, rejectedScans, lastScan, totalTickets, activeEvents] = await Promise.all([
    db.scan.count({
      where: tenantWhereWith(orgId, {}),
    }),
    db.scan.count({
      where: tenantWhereWith(orgId, { result: 'valid' }),
    }),
    db.scan.count({
      where: tenantWhereWith(orgId, { result: { not: 'valid' } }),
    }),
    db.scan.findFirst({
      where: tenantWhereWith(orgId, {}),
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    db.ticket.count({
      where: { event: { organizationId: orgId }, status: 'active' },
    }),
    db.event.count({
      where: tenantWhereWith(orgId, { status: 'active' }),
    }),
  ]);

  const validationRate = totalScans > 0
    ? Math.round((validScans / totalScans) * 1000) / 10
    : 0;

  const eventCapacity = activeEvents * 500; // Estimation moyenne
  const occupancyRate = eventCapacity > 0
    ? Math.round((totalTickets / eventCapacity) * 1000) / 10
    : 0;

  return {
    totalScans,
    validScans,
    rejectedScans,
    validationRate,
    activeTickets: totalTickets,
    eventCapacity,
    occupancyRate,
    lastScanAt: lastScan?.createdAt ?? null,
  };
}

export async function OPTIONS() {
  return handleCors();
}
