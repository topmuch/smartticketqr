// ============================================================
// 📤 POST /api/scanner/flush — Upload offline scan queue
// ============================================================
// Accepts a batch of scans that were queued while offline.
// Each scan is validated server-side (double check for fraud
// prevention — offline scans could be tampered with).
//
// RBAC: Only roles with `scanner.use` permission can flush.
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  requirePermission,
  handleCors,
} from '@/lib/api-helper';

interface QueuedScan {
  id?: number;
  ticketCode: string;
  scannedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  synced?: boolean;
}

interface FlushResult {
  ticketCode: string;
  success: boolean;
  status: string;
  holderName?: string;
  eventName?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // ── Auth + RBAC ──
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'scanner.use');
    if (isErrorResponse(permCheck)) return permCheck;

    // ── Parse body ──
    const body = await request.json();
    const { scans } = body as { scans: QueuedScan[] };

    if (!scans || !Array.isArray(scans) || scans.length === 0) {
      return corsResponse({ error: 'No scans provided' }, 400);
    }

    if (scans.length > 200) {
      return corsResponse({ error: 'Maximum 200 scans per flush batch' }, 400);
    }

    // ── Process each scan ──
    const results: FlushResult[] = [];
    let syncedCount = 0;

    for (const scan of scans) {
      try {
        const code = scan.ticketCode?.trim().toUpperCase();
        if (!code) {
          results.push({ ticketCode: scan.ticketCode, success: false, status: 'invalid', error: 'Empty code' });
          continue;
        }

        // Find ticket
        const ticket = await db.ticket.findUnique({
          where: { ticketCode: code },
          include: {
            event: { select: { id: true, name: true, organizationId: true } },
          },
        });

        // Security: verify ticket belongs to this org
        if (!ticket || ticket.event.organizationId !== tenant.organizationId) {
          results.push({ ticketCode: scan.ticketCode, success: false, status: 'invalid', error: 'Not found or wrong org' });
          continue;
        }

        // Determine status
        let status: 'valid' | 'used' | 'expired' | 'invalid' = 'valid';

        if (ticket.status === 'used' || ticket.status === 'completed') {
          status = 'used';
        } else if (ticket.status === 'cancelled') {
          status = 'invalid';
        } else if (ticket.expiresAt && new Date(ticket.expiresAt) < new Date()) {
          status = 'expired';
        } else if ((ticket.usageCount || 0) >= (ticket.maxScans || 1)) {
          status = 'used';
        }

        // Create scan log (audit trail)
        await db.scanLog.create({
          data: {
            organizationId: tenant.organizationId,
            ticketId: ticket.id,
            eventId: ticket.eventId,
            operatorId: tenant.userId,
            status,
            latitude: scan.latitude ?? null,
            longitude: scan.longitude ?? null,
            deviceUA: 'Offline Flush',
            isSynced: true,
          },
        });

        // If valid, mark ticket and create scan record
        if (status === 'valid') {
          const isFinalScan = (ticket.usageCount || 0) + 1 >= (ticket.maxScans || 1);

          await db.$transaction(async (tx) => {
            if (isFinalScan) {
              await tx.ticket.update({
                where: { id: ticket.id },
                data: { status: 'used', validatedAt: new Date(scan.scannedAt), usageCount: { increment: 1 } },
              });
            } else {
              await tx.ticket.update({
                where: { id: ticket.id },
                data: { validatedAt: new Date(scan.scannedAt), usageCount: { increment: 1 } },
              });
            }

            await tx.scan.create({
              data: {
                ticketId: ticket.id,
                eventId: ticket.eventId,
                scannedBy: tenant.userId,
                organizationId: tenant.organizationId,
                result: 'valid',
                deviceInfo: 'Offline Flush',
                isSynced: true,
                latitude: scan.latitude ?? null,
                longitude: scan.longitude ?? null,
                createdAt: new Date(scan.scannedAt),
              },
            });
          });

          syncedCount++;
        } else {
          // Create failed scan record
          await db.scan.create({
            data: {
              ticketId: ticket.id,
              eventId: ticket.eventId,
              scannedBy: tenant.userId,
              organizationId: tenant.organizationId,
              result: status,
              deviceInfo: 'Offline Flush',
              isSynced: true,
              createdAt: new Date(scan.scannedAt),
            },
          });
        }

        results.push({
          ticketCode: scan.ticketCode,
          success: status === 'valid',
          status,
          holderName: ticket.holderName,
          eventName: ticket.event.name,
        });
      } catch (err) {
        results.push({
          ticketCode: scan.ticketCode,
          success: false,
          status: 'error',
          error: err instanceof Error ? err.message : 'Processing error',
        });
      }
    }

    return corsResponse({
      message: `Flushed ${syncedCount}/${results.length} scans`,
      synced: syncedCount,
      failed: results.length - syncedCount,
      total: results.length,
      results,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
