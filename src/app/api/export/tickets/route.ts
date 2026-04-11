import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requireTenantRole, corsHeaders } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const format = searchParams.get('format') || 'csv';

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify event exists AND belongs to tenant's organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId: tenant.organizationId },
    });
    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch all tickets for the event (tenant-scoped)
    const tickets = await db.ticket.findMany({
      where: { eventId, event: { organizationId: tenant.organizationId } },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (format === 'csv') {
      const headers = [
        'Ticket Code',
        'Type',
        'Holder Name',
        'Holder Email',
        'Holder Phone',
        'Seat Number',
        'Price',
        'Currency',
        'Status',
        'Issued By',
        'Issued At',
        'Validated At',
        'Expires At',
      ];

      const rows = tickets.map(t => [
        t.ticketCode,
        t.ticketType,
        `"${t.holderName}"`,
        t.holderEmail,
        t.holderPhone || '',
        t.seatNumber || '',
        t.price.toFixed(2),
        t.currency,
        t.status,
        t.user?.name || 'System',
        t.issuedAt.toISOString(),
        t.validatedAt?.toISOString() || '',
        t.expiresAt?.toISOString() || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const filename = `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_tickets.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...corsHeaders,
        },
      });
    }

    // Default: return JSON
    return new Response(JSON.stringify({ event, tickets }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  });
}

export async function OPTIONS() { return handleCors(); }
