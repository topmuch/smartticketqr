// ============================================================
// 📴 OFFLINE DB — IndexedDB for offline ticket scanning
// ============================================================
// Uses `idb` for a clean IndexedDB wrapper.
// Two stores:
//  1. `tickets` — Synced from server for offline validation
//  2. `scanQueue` — Pending scans to flush when back online
// ============================================================

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

// ── Types ────────────────────────────────────────────────────

interface OfflineTicket {
  id: string;
  ticketCode: string;
  ticketType: string;
  holderName: string;
  holderEmail: string;
  status: string; // 'active' | 'used' | 'expired' | 'cancelled'
  eventName: string;
  eventType: string;
  eventLocation: string | null;
  eventStartDate: string;
  price: number;
  currency: string;
  seatNumber: string | null;
  fareTypeName: string | null;
  fareTypeEmoji: string | null;
  organizationId: string;
  maxScans: number;
  usageCount: number;
  syncedAt: number;
}

export interface QueuedScan {
  id?: number; // auto-increment
  ticketCode: string;
  scannedAt: string;
  latitude: number | null;
  longitude: number | null;
  synced?: boolean;
}

interface ScannerDB extends DBSchema {
  tickets: {
    key: string; // ticketCode
    value: OfflineTicket;
    indexes: { 'by-org': string; 'by-status': string };
  };
  scanQueue: {
    key: number;
    value: QueuedScan;
    indexes: { 'by-synced': number };
  };
}

const DB_NAME = 'smartticket-offline-db';
const DB_VERSION = 2; // Bumped from old v1

// ── Database Singleton ──────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<ScannerDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ScannerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 → v2 migration: rename old stores if they exist
        if (oldVersion < 2) {
          // Delete old v1 store if it exists
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const names = Array.from(db.objectStoreNames) as any[];
          if (names.includes('scan-queue')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db as any).deleteObjectStore('scan-queue');
          }
        }

        // Create tickets store
        if (!db.objectStoreNames.contains('tickets')) {
          const ticketStore = db.createObjectStore('tickets', { keyPath: 'ticketCode' });
          ticketStore.createIndex('by-org', 'organizationId');
          ticketStore.createIndex('by-status', 'status');
        }

        // Create scanQueue store
        if (!db.objectStoreNames.contains('scanQueue')) {
          const queueStore = db.createObjectStore('scanQueue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('by-synced', 'synced');
        }
      },
      blocked() {
        console.warn('[OfflineDB] Database upgrade blocked — close other tabs');
      },
      blocking() {
        console.warn('[OfflineDB] This connection is blocking an upgrade');
      },
      terminated() {
        console.error('[OfflineDB] Database connection terminated');
        dbPromise = null; // Allow reconnection
      },
    });
  }
  return dbPromise;
}

// ── Ticket Sync (Download from server) ──────────────────────

export interface SyncResult {
  synced: number;
  total: number;
  orgId: string;
}

/**
 * Sync tickets from server for offline use.
 * Downloads all active/unused tickets for the organization.
 */
export async function syncTicketsFromServer(
  orgId: string,
  token: string
): Promise<SyncResult> {
  const db = await getDB();

  const res = await fetch('/api/scanner/sync', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error((err as { error?: string }).error || `Sync failed: ${res.status}`);
  }

  const tickets = (await res.json()) as OfflineTicket[];
  const now = Date.now();

  const tx = db.transaction('tickets', 'readwrite');
  for (const ticket of tickets) {
    await tx.store.put({ ...ticket, organizationId: orgId, syncedAt: now });
  }
  await tx.done;

  console.log(`[OfflineDB] Synced ${tickets.length} tickets for org ${orgId}`);
  return { synced: tickets.length, total: tickets.length, orgId };
}

/**
 * Get a ticket from local IndexedDB by ticket code.
 */
export async function getLocalTicket(ticketCode: string): Promise<OfflineTicket | undefined> {
  const db = await getDB();
  return db.get('tickets', ticketCode);
}

/**
 * Get all locally cached tickets.
 */
export async function getAllLocalTickets(): Promise<OfflineTicket[]> {
  const db = await getDB();
  return db.getAll('tickets');
}

/**
 * Get ticket count by organization.
 */
export async function getLocalTicketCount(orgId: string): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('tickets', 'by-org', orgId);
}

/**
 * Update a ticket status locally (e.g., mark as 'used' after offline scan).
 */
export async function updateLocalTicketStatus(
  ticketCode: string,
  status: string,
  usageCount: number
): Promise<void> {
  const db = await getDB();
  const ticket = await db.get('tickets', ticketCode);
  if (ticket) {
    await db.put('tickets', { ...ticket, status, usageCount });
  }
}

/**
 * Clear all cached tickets for an organization.
 */
export async function clearLocalTickets(orgId?: string): Promise<void> {
  const db = await getDB();
  if (orgId) {
    const tx = db.transaction('tickets', 'readwrite');
    const index = tx.store.index('by-org');
    let cursor = await index.openCursor(orgId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } else {
    await db.clear('tickets');
  }
}

// ── Scan Queue (Upload to server) ───────────────────────────

/**
 * Add a scan to the offline queue.
 */
export async function queueScan(scan: Omit<QueuedScan, 'id'>): Promise<void> {
  const db = await getDB();
  await db.add('scanQueue', { ...scan, synced: false });
}

/**
 * Get all pending (unsynced) scans from the queue.
 */
export async function getPendingScans(): Promise<QueuedScan[]> {
  const db = await getDB();
  return db.getAllFromIndex('scanQueue', 'by-synced', 0);
}

/**
 * Get total pending scan count.
 */
export async function getPendingScanCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('scanQueue', 'by-synced', 0);
}

/**
 * Flush all pending scans to the server.
 * Returns { synced, failed } counts.
 */
export async function flushScanQueue(token: string): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingScans();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  try {
    const res = await fetch('/api/scanner/flush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scans: pending }),
    });

    if (!res.ok) {
      console.warn('[OfflineDB] Flush failed:', res.status);
      return { synced: 0, failed: pending.length };
    }

    const data = await res.json() as { synced?: number; failed?: number };
    const syncedCount = data.synced ?? 0;

    // Remove successfully synced scans
    if (syncedCount > 0) {
      const db = await getDB();
      const tx = db.transaction('scanQueue', 'readwrite');
      // Mark synced scans
      for (const scan of pending) {
        if (scan.id !== undefined) {
          await tx.store.put({ ...scan, synced: true });
        }
      }
      await tx.done;

      // Clear synced entries
      const tx2 = db.transaction('scanQueue', 'readwrite');
      const index = tx2.store.index('by-synced');
      let cursor = await index.openCursor(1); // synced = true
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx2.done;
    }

    return {
      synced: syncedCount,
      failed: pending.length - syncedCount,
    };
  } catch (err) {
    console.warn('[OfflineDB] Flush error (offline?):', err);
    return { synced: 0, failed: pending.length };
  }
}

/**
 * Clear all queued scans.
 */
export async function clearScanQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('scanQueue');
}

// ── Network Listeners ───────────────────────────────────────

/**
 * Initialize auto-sync when coming back online.
 * Call this once from the scanner page.
 */
export function initOfflineAutoSync(getToken: () => string | null) {
  if (typeof window === 'undefined') return;

  const handler = async () => {
    const token = getToken();
    if (!token) return;

    console.log('[OfflineDB] Back online — flushing scan queue...');
    const result = await flushScanQueue(token);
    if (result.synced > 0) {
      console.log(`[OfflineDB] Flushed ${result.synced} scans`);
      // Dispatch a custom event so the UI can react
      window.dispatchEvent(new CustomEvent('offline-sync', {
        detail: result,
      }));
    }
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
