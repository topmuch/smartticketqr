import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

// ─── Types ────────────────────────────────────────────────────────────────

const VALID_TEMPLATES = ['kiosk', 'compact', 'full', 'queue', 'transport'] as const;

interface DisplayConfig {
  id: string;
  name: string;
  eventId: string | null;
  template: (typeof VALID_TEMPLATES)[number];
  cycleInterval: number;
  accentColor: string;
  showStats: boolean;
  showOrganization: boolean;
  autoRefresh: boolean;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
}

const SETTINGS_KEY = 'displayConfigs';

// ─── Limitation de débit (rate limiting) ──────────────────────────────────
// 60 requêtes par minute par adresse IP pour les écrans kiosques.

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

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseOrgSettings(settingsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(settingsJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getDisplayConfigs(settingsJson: string): DisplayConfig[] {
  const settings = parseOrgSettings(settingsJson);
  const configs = settings[SETTINGS_KEY];
  if (Array.isArray(configs)) return configs as DisplayConfig[];
  return [];
}

/**
 * GET /api/display/screens?configId=xxx&token=yyy
 *
 * Point d'accès public pour les écrans kiosques.
 * Authentification NON requise — utilise le configId + vérification isPublic.
 * Rate limited à 60 requêtes/minute par IP.
 *
 * Retourne en une seule réponse : config + billets validés + statistiques.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    // Rate limiting par IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';
    if (isRateLimited(ip)) {
      return corsResponse(
        { error: 'Trop de requêtes — réessayez dans une minute' },
        429
      );
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');

    if (!configId) {
      return corsResponse(
        { error: 'Le paramètre configId est requis' },
        400
      );
    }

    // Chercher la configuration dans toutes les organisations
    // On ne peut pas filtrer par orgId sans auth, on scanne donc
    const organizations = await db.organization.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        settings: true,
        logoUrl: true,
        primaryColor: true,
      },
    });

    let foundConfig: DisplayConfig | null = null;
    let orgData: typeof organizations[0] | null = null;

    for (const org of organizations) {
      const configs = getDisplayConfigs(org.settings);
      const config = configs.find((c) => c.id === configId);
      if (config) {
        foundConfig = config;
        orgData = org;
        break;
      }
    }

    if (!foundConfig || !orgData) {
      return corsResponse({ error: 'Configuration non trouvée' }, 404);
    }

    // Vérifier que la config est publique et active
    if (!foundConfig.isPublic) {
      return corsResponse(
        { error: 'Cette configuration n\'est pas accessible publiquement' },
        403
      );
    }

    if (!foundConfig.isActive) {
      return corsResponse(
        { error: 'Cette configuration est désactivée' },
        403
      );
    }

    // Construire la réponse en parallèle
    const orgId = orgData.id;
    const eventId = foundConfig.eventId;

    const [tickets, stats] = await Promise.all([
      // Billets récemment validés
      (async () => {
        const where: Record<string, unknown> = {
          organizationId: orgId,
          result: 'valid',
        };
        if (eventId) where.eventId = eventId;

        const scans = await db.scan.findMany({
          where,
          include: {
            ticket: {
              select: {
                ticketCode: true,
                ticketType: true,
                holderName: true,
                validatedAt: true,
              },
            },
            event: {
              select: { name: true },
            },
            user: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        return scans.map((scan) => ({
          id: scan.id,
          ticketCode: scan.ticket.ticketCode,
          holderName: scan.ticket.holderName,
          ticketType: scan.ticket.ticketType,
          eventName: scan.event.name,
          isValid: scan.result === 'valid',
          validatedAt: scan.ticket.validatedAt ?? scan.createdAt,
          scannedBy: scan.user?.name ?? 'Opérateur',
          location: scan.location ?? null,
        }));
      })(),

      // Statistiques
      (async () => {
        const scanWhere: Record<string, unknown> = {
          organizationId: orgId,
        };
        if (eventId) scanWhere.eventId = eventId;

        const [totalScans, validScans, rejectedScans, lastScan] = await Promise.all([
          db.scan.count({ where: scanWhere }),
          db.scan.count({ where: { ...scanWhere, result: 'valid' } }),
          db.scan.count({ where: { ...scanWhere, result: { not: 'valid' } } }),
          db.scan.findFirst({
            where: scanWhere,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);

        const validationRate = totalScans > 0
          ? Math.round((validScans / totalScans) * 1000) / 10
          : 0;

        // Capacité et occupation
        let eventCapacity = 0;
        let activeTickets = 0;
        if (eventId) {
          const event = await db.event.findFirst({
            where: { id: eventId, organizationId: orgId },
            select: { totalTickets: true, soldTickets: true },
          });
          if (event) {
            eventCapacity = event.totalTickets;
            activeTickets = event.soldTickets;
          }
        } else {
          const [totalTickets, activeEvents] = await Promise.all([
            db.ticket.count({
              where: { event: { organizationId: orgId }, status: 'active' },
            }),
            db.event.count({
              where: { organizationId: orgId, status: 'active' },
            }),
          ]);
          activeTickets = totalTickets;
          eventCapacity = activeEvents * 500;
        }

        const occupancyRate = eventCapacity > 0
          ? Math.round((activeTickets / eventCapacity) * 1000) / 10
          : 0;

        return {
          totalScans,
          validScans,
          rejectedScans,
          validationRate,
          activeTickets,
          eventCapacity,
          occupancyRate,
          lastScanAt: lastScan?.createdAt ?? null,
        };
      })(),
    ]);

    return corsResponse({
      config: foundConfig,
      organization: {
        name: orgData.name,
        logoUrl: orgData.logoUrl,
        primaryColor: orgData.primaryColor,
      },
      tickets,
      stats,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
