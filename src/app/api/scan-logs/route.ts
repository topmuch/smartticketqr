import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, parsePagination } from '@/lib/api-helper';

/**
 * GET /api/scan-logs - List scan logs for the current organization
 * Query params: page, limit, status, startDate, endDate, operatorId
 *
 * Note: ScanLog has ticketId/eventId as plain strings (not Prisma relations),
 * so we fetch tickets and events separately and join in-memory.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const operatorId = searchParams.get('operatorId');

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    if (status) where.status = status;
    if (operatorId) where.operatorId = operatorId;
    if (startDate || endDate) {
      where.scannedAt = {};
      if (startDate) (where.scannedAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.scannedAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      db.scanLog.findMany({
        where,
        orderBy: { scannedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.scanLog.count({ where }),
    ]);

    // Fetch related tickets, events, and operators in parallel
    const ticketIds = [...new Set(data.map((l) => l.ticketId).filter(Boolean))];
    const eventIds = [...new Set(data.map((l) => l.eventId).filter(Boolean))];
    const operatorIds = [...new Set(data.map((l) => l.operatorId).filter(Boolean))];

    const [tickets, events, operators] = await Promise.all([
      ticketIds.length > 0
        ? db.ticket.findMany({
            where: { id: { in: ticketIds } },
            select: { id: true, ticketCode: true, holderName: true, ticketType: true },
          })
        : [],
      eventIds.length > 0
        ? db.event.findMany({
            where: { id: { in: eventIds } },
            select: { id: true, name: true, type: true },
          })
        : [],
      operatorIds.length > 0
        ? db.user.findMany({
            where: { id: { in: operatorIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const ticketMap = new Map(tickets.map((t) => [t.id, t] as [string, typeof t]));
    const eventMap = new Map(events.map((e) => [e.id, e] as [string, typeof e]));
    const operatorMap = new Map(operators.map((o) => [o.id, o.name] as [string, string]));

    const enrichedData = data.map((log) => ({
      id: log.id,
      ticketId: log.ticketId,
      eventId: log.eventId,
      operatorId: log.operatorId,
      operatorName: operatorMap.get(log.operatorId) || 'Unknown',
      scannedAt: log.scannedAt,
      status: log.status,
      latitude: log.latitude,
      longitude: log.longitude,
      deviceUA: log.deviceUA,
      isSynced: log.isSynced,
      geoAlert: log.geoAlert,
      geoDistance: log.geoDistance,
      ticket: ticketMap.get(log.ticketId) || null,
      event: eventMap.get(log.eventId) || null,
    }));

    return corsResponse({
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function OPTIONS() { return handleCors(); }
