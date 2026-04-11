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

// ============================================================
// GET /api/i18n/[key] — Get single translation
// ============================================================
// Query params:
//   ?lang=fr|en  (defaults to "fr")
//
// Returns the translation for a specific key in a given language.
// Falls back to French if not found in the requested language.
// ============================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return withErrorHandler(async () => {
    const { key } = await params;
    const { searchParams } = new URL(request.url);
    let lang = searchParams.get('lang') || 'fr';

    // Normalize lang code
    lang = lang.trim().toLowerCase();

    if (!/^[a-z]{2}(_[a-z]{2})?$/.test(lang)) {
      lang = 'fr';
    }

    // Try requested language first
    let translation = await db.translation.findUnique({
      where: {
        langCode_translationKey: {
          langCode: lang,
          translationKey: key,
        },
      },
    });

    // Fallback to French
    if (!translation && lang !== 'fr') {
      translation = await db.translation.findUnique({
        where: {
          langCode_translationKey: {
            langCode: 'fr',
            translationKey: key,
          },
        },
      });
    }

    if (!translation) {
      return corsResponse({
        success: true,
        data: null,
        key,
        message: 'Translation not found',
      });
    }

    return corsResponse({
      success: true,
      data: {
        key: translation.translationKey,
        langCode: translation.langCode,
        text: translation.text,
      },
    });
  });
}

// ============================================================
// PUT /api/i18n/[key] — Update translation text
// ============================================================
// Body:
//   { langCode: string, text: string }
//
// Creates or updates the translation.
// Requires admin or super_admin role.
// ============================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { key } = await params;
    const body = await request.json();
    const { langCode, text } = body;

    // Validate langCode
    if (!langCode || typeof langCode !== 'string') {
      return corsResponse({ error: 'langCode is required' }, 400);
    }

    const normalizedLang = langCode.trim().toLowerCase();
    if (!/^[a-z]{2}(_[a-z]{2})?$/.test(normalizedLang)) {
      return corsResponse({ error: 'Invalid langCode format. Use ISO format like "fr", "en", "wo"' }, 400);
    }

    // Validate text
    if (!text || typeof text !== 'string') {
      return corsResponse({ error: 'text is required' }, 400);
    }

    // Upsert translation
    const translation = await db.translation.upsert({
      where: {
        langCode_translationKey: {
          langCode: normalizedLang,
          translationKey: key,
        },
      },
      update: {
        text: text.trim(),
      },
      create: {
        langCode: normalizedLang,
        translationKey: key,
        text: text.trim(),
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'translation.update',
        details: `Updated translation [${normalizedLang}] ${key}`,
      },
    });

    return corsResponse({
      success: true,
      data: {
        key: translation.translationKey,
        langCode: translation.langCode,
        text: translation.text,
      },
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
