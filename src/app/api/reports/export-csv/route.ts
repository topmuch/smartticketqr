import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  withErrorHandler,
  handleCors,
  corsHeaders,
} from '@/lib/api-helper';

/**
 * GET /api/reports/export-csv — Export tickets as CSV with BOM for Excel.
 *
 * Same filters as /api/reports/tickets:
 *   event, status, type, from, to, search
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);

    const eventId = searchParams.get('event');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');

    // Build where clause
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

    // Fetch all matching tickets (no pagination for export)
    const tickets = await db.ticket.findMany({
      where,
      include: {
        event: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // CSV headers
    const headers = [
      'Ticket Code',
      'Event',
      'Holder Name',
      'Holder Email',
      'Phone',
      'Ticket Type',
      'Price',
      'Currency',
      'Status',
      'Issued At',
      'Validated At',
    ];

    // Escape CSV field: wrap in quotes if it contains comma, quote, or newline
    function escapeCsvField(value: string | null | undefined): string {
      if (value == null) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = tickets.map((t) => [
      escapeCsvField(t.ticketCode),
      escapeCsvField(t.event?.name),
      escapeCsvField(t.holderName),
      escapeCsvField(t.holderEmail),
      escapeCsvField(t.holderPhone),
      escapeCsvField(t.ticketType),
      t.price.toFixed(2),
      escapeCsvField(t.currency),
      escapeCsvField(t.status),
      escapeCsvField(t.issuedAt?.toISOString()),
      escapeCsvField(t.validatedAt?.toISOString()),
    ]);

    // Build CSV with BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const today = new Date().toISOString().split('T')[0];
    const filename = `rapport_tickets_${today}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...corsHeaders,
      },
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
