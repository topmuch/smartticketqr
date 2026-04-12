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
}

// ─── GET /api/board?orgSlug=xxx ───────────────────────────────────────────
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
    const orgSlug = searchParams.get('orgSlug');

    if (!orgSlug) {
      return corsResponse(
        { error: 'Le paramètre orgSlug est requis' },
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
      },
    });

    if (!organization) {
      return corsResponse(
        { error: 'Organisation introuvable' },
        404
      );
    }

    // Récupérer toutes les lignes actives avec leurs horaires
    const lines = await db.transportLine.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
      include: {
        schedules: {
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
      departures,
      arrivals,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
