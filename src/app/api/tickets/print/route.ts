import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildEscPosTicket, encodeForRawBT, createReceipt, type EscPosTicketData } from '@/lib/escpos-commands';
import { resolveTenant, isErrorResponse, corsResponse, handleCors } from '@/lib/api-helper';

// ============================================================
// GET /api/tickets/print?id=<ticketId>&format=escpos|base64|rawbt
// ============================================================
// Returns thermal printer data for a ticket.
// Requires authenticated user with matching organization.
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Auth + tenant isolation check
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('id');
    const format = (searchParams.get('format') || 'escpos').toLowerCase();

    if (!ticketId) {
      return corsResponse({ error: 'Ticket ID is required' }, 400);
    }

    // Fetch ticket scoped to user's organization (IDOR protection)
    const ticket = await db.ticket.findFirst({
      where: {
        id: ticketId,
        event: { organizationId: tenant.organizationId },
      },
      include: {
        event: true,
        organization: true,
      },
    });

    if (!ticket) {
      return corsResponse({ error: 'Ticket not found' }, 404);
    }

    // Build ticket data
    const ticketData: EscPosTicketData = {
      orgName: ticket.organization?.name || 'SmartTicketQR',
      ticketCode: ticket.ticketCode,
      ticketType: ticket.ticketType,
      eventName: ticket.event?.name || 'Unknown Event',
      eventDate: ticket.event?.startDate
        ? new Date(ticket.event.startDate).toLocaleString('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : 'N/A',
      eventLocation: ticket.event?.location || undefined,
      holderName: ticket.holderName,
      holderEmail: ticket.holderEmail,
      holderPhone: ticket.holderPhone || undefined,
      seatNumber: ticket.seatNumber || undefined,
      price: ticket.price,
      currency: ticket.currency,
      status: ticket.status,
      issuedAt: ticket.issuedAt
        ? new Date(ticket.issuedAt).toLocaleDateString('fr-FR')
        : undefined,
      paperWidth: 80,
    };

    // Generate ESC/POS commands
    const escposBuffer = buildEscPosTicket(ticketData);

    switch (format) {
      case 'base64': {
        const base64 = encodeForRawBT(escposBuffer);
        return corsResponse({ base64, ticketCode: ticket.ticketCode });
      }

      case 'rawbt': {
        const base64 = encodeForRawBT(escposBuffer);
        const rawbtUri = `rawbt:base64,${base64}`;
        return corsResponse({ uri: rawbtUri, ticketCode: ticket.ticketCode });
      }

      case 'html': {
        const html = buildPrintHTML(ticketData);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `inline; filename="ticket-${ticket.ticketCode}.html"`,
          },
        });
      }

      case 'escpos':
      default: {
        return new Response(escposBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="ticket-${ticket.ticketCode}.bin"`,
            'Content-Length': String(escposBuffer.length),
          },
        });
      }
    }
  } catch (error) {
    console.error('[PrintAPI] Error:', error);
    return corsResponse({ error: 'Failed to generate print data' }, 500);
  }
}

export async function OPTIONS() {
  return handleCors();
}

// ============================================================
// HTML Print Template Builder
// ============================================================

function buildPrintHTML(data: EscPosTicketData): string {
  const statusLabel =
    data.status === 'used' ? 'UTILISE' :
    data.status === 'cancelled' ? 'ANNULE' :
    data.status === 'expired' ? 'EXPIRE' : 'ACTIF';

  const isStamped = data.status === 'used' || data.status === 'cancelled';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket - ${data.ticketCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      width: 80mm;
      max-width: 80mm;
    }
    @media print {
      body { width: 80mm; margin: 0; padding: 0; }
      @page { size: 80mm auto; margin: 0; }
    }
    .ticket { padding: 4mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #000; margin: 3mm 0; }
    .separator-solid { border-top: 1px solid #000; margin: 3mm 0; }
    .row { display: flex; justify-content: space-between; margin: 1mm 0; }
    .label { font-size: 10px; text-transform: uppercase; color: #333; }
    .value { font-weight: bold; }
    .big { font-size: 20px; font-weight: bold; }
    .footer { text-align: center; font-size: 8px; color: #333; margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #000; }
    .stamp {
      display: inline-block;
      border: 3px solid #000;
      padding: 2mm 6mm;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 4px;
      text-transform: uppercase;
      transform: rotate(-8deg);
      margin: 3mm 0;
    }
    .cut-line { text-align: center; border-top: 1px dashed #000; margin-top: 5mm; padding-top: 2mm; font-size: 10px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:5mm;">
    <button onclick="window.print()" style="padding:4mm 8mm;font-size:14px;cursor:pointer;">
      🖨️ Imprimer
    </button>
  </div>
  <div class="ticket">
    <div class="center">
      <div style="font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">
        ${data.orgName || 'SmartTicketQR'}
      </div>
      <div style="font-size:10px;font-weight:bold;border:1px solid #000;display:inline-block;padding:1mm 3mm;margin-top:1mm;">
        ${data.ticketType}
      </div>
    </div>
    <div class="separator-solid"></div>
    <div class="bold" style="font-size:14px;">${data.eventName}</div>
    <div style="font-size:10px;">Date : ${data.eventDate}</div>
    ${data.eventLocation ? `<div style="font-size:10px;">Lieu : ${data.eventLocation}</div>` : ''}
    <div class="separator"></div>
    <div class="label">Passager</div>
    <div class="bold" style="font-size:13px;">${data.holderName}</div>
    ${data.holderPhone ? `<div style="font-size:10px;">Tel : ${data.holderPhone}</div>` : ''}
    ${data.holderEmail ? `<div style="font-size:10px;">Email : ${data.holderEmail}</div>` : ''}
    ${data.seatNumber ? `<div style="font-size:10px;">Siege : ${data.seatNumber}</div>` : ''}
    <div class="separator"></div>
    <div class="row"><span class="label">Code</span><span class="value">${data.ticketCode}</span></div>
    <div class="row"><span class="label">Type</span><span class="value">${data.ticketType}</span></div>
    <div class="row"><span class="label">Statut</span><span class="value">${statusLabel}</span></div>
    ${data.issuedAt ? `<div class="row"><span class="label">Emis le</span><span class="value">${data.issuedAt}</span></div>` : ''}
    <div class="separator"></div>
    <div class="center big">${data.currency} ${data.price.toFixed(2)}</div>
    ${isStamped ? `<div class="center"><div class="stamp">${statusLabel}</div></div>` : ''}
    <div class="footer">
      Ce billet est non transferable.<br>
      Presentez-le a l'entree avec une piece d'identite.
    </div>
    <div class="cut-line">- - - - - - - - - - - - - - -</div>
  </div>
</body>
</html>`;
}
