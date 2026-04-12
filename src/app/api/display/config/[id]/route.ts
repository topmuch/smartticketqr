import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';

// Types et constantes partagés avec config/route.ts
const VALID_TEMPLATES = ['kiosk', 'compact', 'full', 'queue', 'transport'] as const;
type DisplayTemplate = (typeof VALID_TEMPLATES)[number];

interface DisplayConfig {
  id: string;
  name: string;
  eventId: string | null;
  template: DisplayTemplate;
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

function setDisplayConfigs(
  settingsJson: string,
  configs: DisplayConfig[]
): string {
  const settings = parseOrgSettings(settingsJson);
  settings[SETTINGS_KEY] = configs;
  return JSON.stringify(settings);
}

function isValidTemplate(template: string): template is DisplayTemplate {
  return (VALID_TEMPLATES as readonly string[]).includes(template);
}

// ─── Route Handlers ───────────────────────────────────────────────────────

/**
 * GET /api/display/config/[id]
 *
 * Récupère une configuration d'affichage par son ID.
 * Accès restreint aux administrateurs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const org = await db.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return corsResponse({ error: 'Organisation non trouvée' }, 404);
    }

    const configs = getDisplayConfigs(org.settings);
    const config = configs.find((c) => c.id === id);

    if (!config) {
      return corsResponse({ error: 'Configuration non trouvée' }, 404);
    }

    return corsResponse({ config });
  });
}

/**
 * PUT /api/display/config/[id]
 *
 * Met à jour une configuration d'affichage.
 * Seuls les champs fournis sont modifiés (patch partiel).
 * Accès restreint aux administrateurs.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;
    const body = await request.json();

    // Récupérer les settings actuels
    const org = await db.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return corsResponse({ error: 'Organisation non trouvée' }, 404);
    }

    const configs = getDisplayConfigs(org.settings);
    const configIndex = configs.findIndex((c) => c.id === id);

    if (configIndex === -1) {
      return corsResponse({ error: 'Configuration non trouvée' }, 404);
    }

    const existing = configs[configIndex];

    // Validation du template si fourni
    if (body.template !== undefined) {
      const template = String(body.template).toLowerCase();
      if (!isValidTemplate(template)) {
        return corsResponse(
          {
            error: `Template invalide. Valeurs acceptées : ${VALID_TEMPLATES.join(', ')}`,
          },
          400
        );
      }
      existing.template = template;
    }

    // Validation du nom si fourni
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return corsResponse({ error: 'Le nom ne peut pas être vide' }, 400);
      }
      // Vérifier l'unicité du nom (exclure la config actuelle)
      const nameExists = configs.some(
        (c) => c.name === name && c.id !== id
      );
      if (nameExists) {
        return corsResponse(
          { error: 'Une configuration avec ce nom existe déjà' },
          409
        );
      }
      existing.name = name;
    }

    // Mise à jour conditionnelle des autres champs
    if (body.eventId !== undefined) {
      existing.eventId = body.eventId ?? null;
    }
    if (typeof body.cycleInterval === 'number') {
      existing.cycleInterval = Math.max(3, Math.min(60, body.cycleInterval));
    }
    if (typeof body.accentColor === 'string') {
      if (/^#[0-9A-Fa-f]{6}$/.test(body.accentColor)) {
        existing.accentColor = body.accentColor;
      }
    }
    if (typeof body.showStats === 'boolean') existing.showStats = body.showStats;
    if (typeof body.showOrganization === 'boolean') existing.showOrganization = body.showOrganization;
    if (typeof body.autoRefresh === 'boolean') existing.autoRefresh = body.autoRefresh;
    if (typeof body.isPublic === 'boolean') existing.isPublic = body.isPublic;
    if (typeof body.isActive === 'boolean') existing.isActive = body.isActive;

    // Sauvegarder
    configs[configIndex] = existing;
    await db.organization.update({
      where: { id: tenant.organizationId },
      data: { settings: setDisplayConfigs(org.settings, configs) },
    });

    return corsResponse({ config: existing });
  });
}

/**
 * DELETE /api/display/config/[id]
 *
 * Supprime une configuration d'affichage.
 * Accès restreint aux administrateurs.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    // Récupérer les settings actuels
    const org = await db.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return corsResponse({ error: 'Organisation non trouvée' }, 404);
    }

    const configs = getDisplayConfigs(org.settings);
    const configIndex = configs.findIndex((c) => c.id === id);

    if (configIndex === -1) {
      return corsResponse({ error: 'Configuration non trouvée' }, 404);
    }

    // Retirer la config du tableau
    const deleted = configs.splice(configIndex, 1)[0];

    // Sauvegarder
    await db.organization.update({
      where: { id: tenant.organizationId },
      data: { settings: setDisplayConfigs(org.settings, configs) },
    });

    return corsResponse({ deleted: true, config: deleted });
  });
}

export async function OPTIONS() {
  return handleCors();
}
