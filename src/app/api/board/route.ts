import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

// ─── Limitation de débit (rate limiting) ──────────────────────────────────
// 60 requêtes par minute par adresse IP — même pattern que les écrans d'affichage.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Nettoyage périodique de la carte (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

// ─── Types de réponse ─────────────────────────────────────────────────────

interface BoardEntry {
  id: string;
  lineName: string;
  lineColor: string;
  vehicleType: string;
  origin: string;
  destination: string;
  time: string;
  status: string;
  delayMinutes: number;
  note: string | null;
  // Enhanced fields for passenger board
  availableSeats: number;
  totalSeats: number;
  company: string;
  transportType: string;
}

// ─── Mock seat data generator (deterministic from schedule id) ────────────
// Produces consistent seat counts per schedule for demo purposes.
// Real integration would query Event.soldTickets vs Event.totalTickets.

function generateMockSeats(scheduleId: string): { available: number; total: number } {
  let hash = 0;
  for (let i = 0; i < scheduleId.length; i++) {
    const char = scheduleId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const total = 40 + (Math.abs(hash) % 30); // 40-69 seats
  const sold = Math.abs(hash >> 4) % (total + 1);
  return { available: total - sold, total };
}

// ─── GET /api/board?orgSlug=xxx&org=xxx&type=departure&limit=20 ──────────
// Tableau d'affichage public des départs et arrivées.
// AUCUNE authentification requise — accès public en lecture seule.
// Rate limité à 60 requêtes/minute par IP.

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    // Rate limiting par IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';
    if (isRateLimited(ip)) {
      return corsResponse(
        { error: 'Trop de requêtes — réessayez dans une minute' },
        429
      );
    }

    const { searchParams } = new URL(request.url);
    // Accept both `org` and `orgSlug` params
    const orgSlug = searchParams.get('org') || searchParams.get('orgSlug');
    const type = searchParams.get('type'); // 'departure' | 'arrival' | undefined (both)
    const limit = searchParams.get('limit');

    if (!orgSlug) {
      return corsResponse(
        { error: 'Le paramètre org ou orgSlug est requis' },
        400
      );
    }

    // Trouver l'organisation par slug
    const organization = await db.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: {
        id: true,
        name: true,
        primaryColor: true,
        logoUrl: true,
        settings: true,
      },
    });

    if (!organization) {
      return corsResponse(
        { error: 'Organisation introuvable' },
        404
      );
    }

    // Build schedule type filter
    const scheduleFilter: Record<string, unknown> = {};
    if (type === 'departure' || type === 'arrival') {
      scheduleFilter.type = type;
    }

    // Récupérer toutes les lignes actives avec leurs horaires
    const lines = await db.transportLine.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
      include: {
        schedules: {
          where: scheduleFilter,
          orderBy: { time: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Construire les listes de départs et d'arrivées triées par heure
    const departures: BoardEntry[] = [];
    const arrivals: BoardEntry[] = [];

    for (const line of lines) {
      for (const schedule of line.schedules) {
        const seats = generateMockSeats(schedule.id);
        const entry: BoardEntry = {
          id: schedule.id,
          lineName: line.name,
          lineColor: line.color,
          vehicleType: line.vehicleType,
          origin: line.origin,
          destination: line.destination,
          time: schedule.time,
          status: schedule.status,
          delayMinutes: schedule.delayMinutes,
          note: schedule.note,
          availableSeats: seats.available,
          totalSeats: seats.total,
          company: organization.name,
          transportType: line.vehicleType,
        };

        if (schedule.type === 'departure') {
          departures.push(entry);
        } else if (schedule.type === 'arrival') {
          arrivals.push(entry);
        }
      }
    }

    // Trier par heure croissante
    departures.sort((a, b) => a.time.localeCompare(b.time));
    arrivals.sort((a, b) => a.time.localeCompare(b.time));

    // Apply limit if provided
    const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : null;
    const finalDepartures = parsedLimit ? departures.slice(0, parsedLimit) : departures;
    const finalArrivals = parsedLimit ? arrivals.slice(0, parsedLimit) : arrivals;

    // Parse organization settings for audio configuration
    let audioSettings: Record<string, string | undefined> = {};
    try {
      const parsedSettings = JSON.parse(organization.settings || '{}');
      audioSettings = parsedSettings.audio || {};
    } catch {
      // Invalid JSON in settings — use empty defaults
    }

    // Fetch global active audio library
    const audioLibrary = await db.audioLibrary.findMany({
      where: { isGlobal: true, isActive: true },
    });

    return corsResponse({
      organization: {
        name: organization.name,
        primaryColor: organization.primaryColor,
        logoUrl: organization.logoUrl,
      },
      lines: lines.map((line) => ({
        id: line.id,
        name: line.name,
        origin: line.origin,
        destination: line.destination,
        vehicleType: line.vehicleType,
        color: line.color,
        scheduleCount: line.schedules.length,
      })),
      departures: finalDepartures,
      arrivals: finalArrivals,
      audioSettings,
      audioLibrary,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
