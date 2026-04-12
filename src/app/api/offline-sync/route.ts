import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { validateTicketCode } from '@/lib/ticket-generator';

/**
 * POST /api/offline-sync - Sync offline scan queue entries
 * Body: { scans: [{ ticketCode, scannedAt, latitude?, longitude? }] }
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { scans } = body as {
      scans: Array<{
        ticketCode: string;
        scannedAt: string;
        latitude?: number;
        longitude?: number;
      }>;
    };

    if (!scans || !Array.isArray(scans) || scans.length === 0) {
      return corsResponse({ error: 'No scans provided' }, 400);
    }

    if (scans.length > 100) {
      return corsResponse({ error: 'Maximum 100 scans per sync batch' }, 400);
    }

    const results = [];

    for (const scan of scans) {
      try {
        const codeCheck = validateTicketCode(scan.ticketCode);
        if (!codeCheck.valid) {
          results.push({ ticketCode: scan.ticketCode, success: false, status: 'invalid', error: 'Invalid ticket code format' });
          continue;
        }

        const ticket = await db.ticket.findUnique({
          where: { ticketCode: codeCheck.clean },
          include: { event: { select: { id: true, name: true, latitude: true, longitude: true, organizationId: true } } },
        });

        if (!ticket || ticket.event.organizationId !== tenant.organizationId) {
          results.push({ ticketCode: scan.ticketCode, success: false, status: 'invalid', error: 'Ticket not found' });
          continue;
        }

        let status: 'valid' | 'used' | 'expired' | 'invalid' = 'valid';
        if (ticket.status === 'used') status = 'used';
        else if (ticket.status === 'cancelled') status = 'invalid';
        else if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) status = 'expired';

        await db.scanLog.create({
          data: {
            organizationId: tenant.organizationId,
            ticketId: ticket.id,
            eventId: ticket.eventId,
            operatorId: tenant.userId,
            status,
            latitude: scan.latitude || null,
            longitude: scan.longitude || null,
            deviceUA: 'Offline Sync',
            isSynced: true,
          },
        });

        if (status === 'valid') {
          await db.$transaction(async (tx) => {
            await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'used', validatedAt: new Date(scan.scannedAt) } });
            await tx.scan.create({
              data: {
                ticketId: ticket.id, eventId: ticket.eventId, scannedBy: tenant.userId,
                organizationId: tenant.organizationId, result: 'valid', deviceInfo: 'Offline Sync',
                isSynced: true, latitude: scan.latitude || null, longitude: scan.longitude || null,
                createdAt: new Date(scan.scannedAt),
              },
            });
          });
        } else {
          await db.scan.create({
            data: {
              ticketId: ticket.id, eventId: ticket.eventId, scannedBy: tenant.userId,
              organizationId: tenant.organizationId, result: status, deviceInfo: 'Offline Sync',
              isSynced: true, createdAt: new Date(scan.scannedAt),
            },
          });
        }

        results.push({ ticketCode: scan.ticketCode, success: status === 'valid', status, holderName: ticket.holderName, eventName: ticket.event.name });
      } catch (error) {
        results.push({ ticketCode: scan.ticketCode, success: false, status: 'error', error: error instanceof Error ? error.message : 'Processing error' });
      }
    }

    const synced = results.filter((r) => r.success).length;
    return corsResponse({ message: `Synced ${synced}/${results.length} scans`, synced, failed: results.length - synced, total: results.length, results });
  });
}

export async function OPTIONS() { return handleCors(); }
