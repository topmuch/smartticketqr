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
 * GET /api/display/validated?eventId=xxx&limit=50&since=timestamp
 *
 * Retourne les billets récemment validés pour un événement ou toute l'organisation.
 * Supporte le delta polling via le paramètre `since` (ISO timestamp).
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const sinceParam = searchParams.get('since');
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(100, Math.max(1, rawLimit));

    // Construction de la clause WHERE avec isolation locataire
    const where: Record<string, unknown> = tenantWhereWith(tenant.organizationId, {});

    // Filtrage par événement si spécifié
    if (eventId) {
      where.eventId = eventId;
    }

    // Filtrage delta : uniquement les scans après la date spécifiée
    if (sinceParam) {
      const sinceDate = new Date(sinceParam);
      if (!isNaN(sinceDate.getTime())) {
        where.createdAt = { gt: sinceDate };
      }
    }

    // Uniquement les validations réussies (résultat 'valid')
    where.result = 'valid';

    // Requête parallèle : scans + total
    const [scans, total] = await Promise.all([
      db.scan.findMany({
        where,
        include: {
          ticket: {
            select: {
              ticketCode: true,
              ticketType: true,
              holderName: true,
              validatedAt: true,
            },
          },
          event: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.scan.count({
        where: {
          ...tenantWhereWith(tenant.organizationId, {}),
          ...(eventId ? { eventId } : {}),
          result: 'valid',
        },
      }),
    ]);

    // Formattage de la réponse
    const tickets = scans.map((scan) => ({
      id: scan.id,
      ticketCode: scan.ticket.ticketCode,
      holderName: scan.ticket.holderName,
      ticketType: scan.ticket.ticketType,
      eventName: scan.event.name,
      isValid: scan.result === 'valid',
      validatedAt: scan.ticket.validatedAt ?? scan.createdAt,
      scannedBy: scan.user?.name ?? 'Opérateur inconnu',
      location: scan.location ?? null,
    }));

    return corsResponse({
      tickets,
      meta: {
        total,
        since: sinceParam ?? null,
        limit,
      },
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
