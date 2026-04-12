/**
 * SmartTicketQR — Service WebSocket d'Affichage Dynamique
 *
 * Serveur Socket.IO sur le port 3004 qui diffuse les événements de scan
 * de validation en temps réel aux écrans kiosques connectés.
 *
 * Salles (rooms) :
 *   - event:{eventId} — diffusion spécifique à un événement
 *   - org:{orgId}     — diffusion à l'échelle de l'organisation
 *
 * Événements client → serveur :
 *   - join  { eventId?, organizationId }  — rejoint les salles
 *   - leave { eventId?, organizationId }  — quitte les salles
 *
 * Événements serveur → client :
 *   - scan:validated  { ticket, scan, event } — nouvelle validation
 *   - display:stats   { stats }               — stats mises à jour (toutes les 30s)
 *
 * API HTTP interne :
 *   - POST /emit       — déclenche une diffusion de scan
 *   - POST /push-stats — pousse des stats à jour
 *   - GET  /health     — health check du service
 *
 * Usage :
 *   bun --hot index.ts   (développement avec rechargement à chaud)
 *   bun index.ts          (production)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { Server } from 'socket.io';

// ─── Configuration ────────────────────────────────────────────────────────

const PORT = 3004;
const STATS_INTERVAL_MS = 30_000;

// ─── Compteurs de connexion ───────────────────────────────────────────────

const connectedClients = new Set<string>();
const roomMembers = new Map<string, Set<string>>();

// ─── Stats en mémoire ─────────────────────────────────────────────────────

interface RoomStats {
  totalScans: number;
  validScans: number;
  rejectedScans: number;
  lastScanAt: string | null;
}

const roomStats = new Map<string, RoomStats>();

function getOrCreateRoomStats(room: string): RoomStats {
  let stats = roomStats.get(room);
  if (!stats) {
    stats = { totalScans: 0, validScans: 0, rejectedScans: 0, lastScanAt: null };
    roomStats.set(room, stats);
  }
  return stats;
}

function computeValidationRate(stats: RoomStats): number {
  if (stats.totalScans === 0) return 0;
  return Math.round((stats.validScans / stats.totalScans) * 1000) / 10;
}

function updateStatsForScan(organizationId: string, eventId: string | undefined, result: string) {
  const now = new Date().toISOString();
  const isValid = result === 'valid';

  const orgStats = getOrCreateRoomStats(`org:${organizationId}`);
  orgStats.totalScans++;
  if (isValid) orgStats.validScans++;
  else orgStats.rejectedScans++;
  orgStats.lastScanAt = now;

  if (eventId) {
    const eventStats = getOrCreateRoomStats(`event:${eventId}`);
    eventStats.totalScans++;
    if (isValid) eventStats.validScans++;
    else eventStats.rejectedScans++;
    eventStats.lastScanAt = now;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function jsonResponse(res: ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

function readRequestBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

function joinRoom(socketId: string, room: string) {
  if (!roomMembers.has(room)) roomMembers.set(room, new Set());
  roomMembers.get(room)!.add(socketId);
}

function leaveAllRooms(socketId: string): string[] {
  const leftRooms: string[] = [];
  for (const [room, members] of roomMembers) {
    if (members.has(socketId)) {
      members.delete(socketId);
      leftRooms.push(room);
      if (members.size === 0) roomMembers.delete(room);
    }
  }
  return leftRooms;
}

function buildStatsPayload(stats: RoomStats) {
  return {
    totalScans: stats.totalScans,
    validScans: stats.validScans,
    rejectedScans: stats.rejectedScans,
    validationRate: computeValidationRate(stats),
    lastScanAt: stats.lastScanAt,
  };
}

// ─── Serveur HTTP + Socket.IO avec routage personnalisé ────────────────────
// Socket.IO utilise path:'/' pour le routage Caddy, mais cela fait que
// Engine.IO intercepte TOUTES les requêtes HTTP. Pour gérer nos endpoints
// REST, on capture les listeners de Socket.IO et on les invoque
// manuellement uniquement pour les requêtes non gérées.

const httpServer = createServer();

const io = new Server(httpServer, {
  path: '/',
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Capturer les listeners existants de Socket.IO/Engine.IO
// puis les remplacer par notre routeur personnalisé
type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;
const originalListeners = httpServer.listeners('request') as RequestListener[];
httpServer.removeAllListeners('request');

// Notre routeur : REST en priorité, sinon délègue à Socket.IO
httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';

  // ── POST /emit ─────────────────────────────────────────────────────────
  if (method === 'POST' && url === '/emit') {
    try {
      const body = await readRequestBody(req);
      const { organizationId, eventId, scan, ticket, event } = body;

      if (!organizationId) {
        jsonResponse(res, { error: 'organizationId est requis' }, 400);
        return;
      }

      const scanResult = (scan as Record<string, unknown> | undefined)?.result as string ?? 'valid';
      updateStatsForScan(organizationId as string, eventId as string | undefined, scanResult);

      const payload = {
        ticket: ticket ?? null,
        scan: scan ?? null,
        event: event ?? null,
        timestamp: new Date().toISOString(),
      };

      let recipients = 0;

      const orgRoom = `org:${organizationId}`;
      const orgMembers = roomMembers.get(orgRoom);
      if (orgMembers && orgMembers.size > 0) {
        io.to(orgRoom).emit('scan:validated', payload);
        recipients += orgMembers.size;
      }

      if (eventId) {
        const eventRoom = `event:${eventId}`;
        const eventMembers = roomMembers.get(eventRoom);
        if (eventMembers && eventMembers.size > 0) {
          io.to(eventRoom).emit('scan:validated', payload);
          recipients += eventMembers.size;
        }
      }

      console.log(
        `[Display WS] scan:validated — org:${organizationId}${eventId ? ` event:${eventId}` : ''} → ${recipients} clients`
      );

      jsonResponse(res, { success: true, recipients });
    } catch (error) {
      console.error('[Display WS] Erreur /emit:', error);
      jsonResponse(res, { error: 'Erreur interne' }, 500);
    }
    return;
  }

  // ── POST /push-stats ───────────────────────────────────────────────────
  if (method === 'POST' && url === '/push-stats') {
    try {
      const body = await readRequestBody(req);
      const { organizationId, eventId, stats } = body;

      if (!organizationId || !stats) {
        jsonResponse(res, { error: 'organizationId et stats requis' }, 400);
        return;
      }

      const receivedStats = stats as Record<string, unknown>;
      const orgRoom = `org:${organizationId}`;
      const currentStats = getOrCreateRoomStats(orgRoom);
      currentStats.totalScans = (receivedStats.totalScans as number) ?? currentStats.totalScans;
      currentStats.validScans = (receivedStats.validScans as number) ?? currentStats.validScans;
      currentStats.rejectedScans = (receivedStats.rejectedScans as number) ?? currentStats.rejectedScans;
      if (receivedStats.lastScanAt) currentStats.lastScanAt = receivedStats.lastScanAt as string;

      let recipients = 0;
      const orgMembers = roomMembers.get(orgRoom);
      if (orgMembers && orgMembers.size > 0) {
        io.to(orgRoom).emit('display:stats', {
          stats: buildStatsPayload(currentStats),
          organizationId,
          eventId: eventId ?? null,
        });
        recipients += orgMembers.size;
      }

      jsonResponse(res, { success: true, recipients });
    } catch (error) {
      console.error('[Display WS] Erreur /push-stats:', error);
      jsonResponse(res, { error: 'Erreur interne' }, 500);
    }
    return;
  }

  // ── GET /health ────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/health') {
    const roomsSnapshot: Record<string, RoomStats> = {};
    for (const [key, value] of roomStats) roomsSnapshot[key] = { ...value };
    jsonResponse(res, {
      status: 'ok',
      connectedClients: connectedClients.size,
      rooms: roomsSnapshot,
      uptime: process.uptime(),
    });
    return;
  }

  // ── OPTIONS (CORS preflight) ────────────────────────────────────────────
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // ── Délèguer à Socket.IO/Engine.IO ─────────────────────────────────────
  for (const listener of originalListeners) {
    listener(req, res);
  }
});

// ─── Gestionnaire de connexion Socket.IO ──────────────────────────────────

io.on('connection', (socket) => {
  const clientId = socket.id;
  connectedClients.add(clientId);
  console.log(`[Display WS] Client connecté: ${clientId} (${connectedClients.size} connectés)`);

  socket.on('join', (data: { eventId?: string; organizationId?: string }) => {
    const { eventId, organizationId } = data;

    if (!organizationId) {
      socket.emit('error', { message: 'organizationId est requis' });
      return;
    }

    const orgRoom = `org:${organizationId}`;
    socket.join(orgRoom);
    joinRoom(clientId, orgRoom);

    if (eventId) {
      const eventRoom = `event:${eventId}`;
      socket.join(eventRoom);
      joinRoom(clientId, eventRoom);
    }

    // Stats initiales
    const stats = getOrCreateRoomStats(orgRoom);
    socket.emit('display:stats', {
      stats: buildStatsPayload(stats),
      organizationId,
      eventId: eventId ?? null,
    });

    console.log(`[Display WS] ${clientId} → org:${organizationId}${eventId ? ` + event:${eventId}` : ''}`);
  });

  socket.on('leave', (data: { eventId?: string; organizationId?: string }) => {
    const { eventId, organizationId } = data;
    if (organizationId) socket.leave(`org:${organizationId}`);
    if (eventId) socket.leave(`event:${eventId}`);
  });

  socket.on('disconnect', (reason) => {
    connectedClients.delete(clientId);
    leaveAllRooms(clientId);
    console.log(`[Display WS] Client déconnecté: ${clientId} (raison: ${reason}, ${connectedClients.size} restants)`);
  });

  socket.on('error', (error) => {
    console.error(`[Display WS] Erreur socket (${clientId}):`, error);
  });
});

// ─── Diffusion périodique des stats (30s) ─────────────────────────────────

setInterval(() => {
  for (const room of roomMembers.keys()) {
    if (!room.startsWith('org:')) continue;
    const orgId = room.replace('org:', '');
    const stats = getOrCreateRoomStats(room);
    io.to(room).emit('display:stats', {
      stats: buildStatsPayload(stats),
      organizationId: orgId,
      eventId: null,
    });
  }
}, STATS_INTERVAL_MS);

// ─── Démarrage ────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log('');
  console.log('🖥️  SmartTicketQR Display WebSocket Service');
  console.log(`   Port: ${PORT}`);
  console.log(`   Stats interval: ${STATS_INTERVAL_MS / 1000}s`);
  console.log(`   Endpoints: POST /emit, POST /push-stats, GET /health`);
  console.log('');
});

function shutdown(signal: string) {
  console.log(`\n[Display WS] Signal ${signal} reçu, fermeture...`);
  io.close();
  httpServer.close(() => {
    console.log('[Display WS] Serveur fermé');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
