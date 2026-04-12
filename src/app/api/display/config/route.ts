import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';

// Types pour les configurations d'affichage
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

// Clé utilisée dans Organization.settings
const SETTINGS_KEY = 'displayConfigs';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Génère un UUID simple pour les configurations */
function generateId(): string {
  return crypto.randomUUID();
}

/** Lecture sécurisée des settings JSON de l'organisation */
function parseOrgSettings(settingsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(settingsJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Récupère les configurations d'affichage depuis les settings org */
function getDisplayConfigs(settingsJson: string): DisplayConfig[] {
  const settings = parseOrgSettings(settingsJson);
  const configs = settings[SETTINGS_KEY];
  if (Array.isArray(configs)) return configs as DisplayConfig[];
  return [];
}

/** Sérialise les settings avec les nouvelles configs */
function setDisplayConfigs(
  settingsJson: string,
  configs: DisplayConfig[]
): string {
  const settings = parseOrgSettings(settingsJson);
  settings[SETTINGS_KEY] = configs;
  return JSON.stringify(settings);
}

/** Valide le template fourni */
function isValidTemplate(template: string): template is DisplayTemplate {
  return (VALID_TEMPLATES as readonly string[]).includes(template);
}

/**
 * GET /api/display/config
 *
 * Liste toutes les configurations d'affichage de l'organisation.
 * Accès restreint aux administrateurs.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const org = await db.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return corsResponse({ error: 'Organisation non trouvée' }, 404);
    }

    const configs = getDisplayConfigs(org.settings);
    return corsResponse({ configs });
  });
}

/**
 * POST /api/display/config
 *
 * Crée une nouvelle configuration d'affichage.
 * Accès restreint aux administrateurs.
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();

    // Validation du template
    const template = String(body.template || '').toLowerCase();
    if (!template || !isValidTemplate(template)) {
      return corsResponse(
        {
          error: `Template invalide. Valeurs acceptées : ${VALID_TEMPLATES.join(', ')}`,
        },
        400
      );
    }

    // Validation du nom
    const name = String(body.name || '').trim();
    if (!name) {
      return corsResponse({ error: 'Le nom de la configuration est requis' }, 400);
    }

    // Récupérer les settings actuels
    const org = await db.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return corsResponse({ error: 'Organisation non trouvée' }, 404);
    }

    const existingConfigs = getDisplayConfigs(org.settings);

    // Limiter le nombre de configs par organisation (max 20)
    if (existingConfigs.length >= 20) {
      return corsResponse(
        { error: 'Limite de 20 configurations atteinte pour cette organisation' },
        400
      );
    }

    // Vérifier l'unicité du nom
    if (existingConfigs.some((c) => c.name === name)) {
      return corsResponse(
        { error: 'Une configuration avec ce nom existe déjà' },
        409
      );
    }

    // Construire la nouvelle configuration
    const newConfig: DisplayConfig = {
      id: generateId(),
      name,
      eventId: body.eventId ?? null,
      template,
      cycleInterval: typeof body.cycleInterval === 'number'
        ? Math.max(3, Math.min(60, body.cycleInterval))
        : 8,
      accentColor: typeof body.accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.accentColor)
        ? body.accentColor
        : '#059669',
      showStats: typeof body.showStats === 'boolean' ? body.showStats : true,
      showOrganization: typeof body.showOrganization === 'boolean' ? body.showOrganization : true,
      autoRefresh: typeof body.autoRefresh === 'boolean' ? body.autoRefresh : true,
      isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : true,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      createdAt: new Date().toISOString(),
    };

    // Sauvegarder
    const updatedConfigs = [...existingConfigs, newConfig];
    await db.organization.update({
      where: { id: tenant.organizationId },
      data: { settings: setDisplayConfigs(org.settings, updatedConfigs) },
    });

    return corsResponse({ config: newConfig }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
