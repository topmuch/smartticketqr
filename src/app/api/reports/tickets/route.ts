import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

/**
 * GET /api/reports/tickets — Paginated, filterable ticket report.
 *
 * Query params:
 *   event    — filter by eventId
 *   status   — filter by ticket status
 *   type     — filter by ticketType
 *   from     — date range start (createdAt >= from)
 *   to       — date range end (createdAt <= to)
 *   search   — search holderName or ticketCode
 *   page     — pagination page (default: 1)
 *   limit    — pagination limit (default: 10)
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const eventId = searchParams.get('event');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');

    // Build where clause — always filter by organization via event relation
    const where: Record<string, unknown> = {
      event: { organizationId: tenant.organizationId },
    };

    if (eventId) where.eventId = eventId;
    if (status) where.status = status;
    if (type) where.ticketType = type;

    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }

    if (search) {
      where.OR = [
        { holderName: { contains: search } },
        { ticketCode: { contains: search } },
      ];
    }

    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        include: {
          event: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ticket.count({ where }),
    ]);

    return corsResponse({
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
