import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
} from '@/lib/api-helper';

// ============================================================
// GET /api/i18n — Get translations for a language
// ============================================================
// Query params:
//   ?lang=fr|en|wo  (defaults to "fr")
//
// Returns all translations for that language as a flat key-value object.
// Falls back to French if the requested language is not found.
//
// NOTE: Translations are global (not tenant-isolated) since they
// serve the entire platform UI.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    // i18n is public — no tenant required, but we still validate the request
    const { searchParams } = new URL(request.url);
    let lang = searchParams.get('lang') || 'fr';

    // Normalize lang code
    lang = lang.trim().toLowerCase();

    // Validate lang is a reasonable code (2-10 chars, alphanumeric + underscore)
    if (!/^[a-z]{2}(_[a-z]{2})?$/.test(lang)) {
      lang = 'fr';
    }

    // Fetch all translations for the requested language
    let translations = await db.translation.findMany({
      where: { langCode: lang },
      select: {
        translationKey: true,
        text: true,
      },
    });

    // Fallback to French if no translations found
    if (translations.length === 0 && lang !== 'fr') {
      translations = await db.translation.findMany({
        where: { langCode: 'fr' },
        select: {
          translationKey: true,
          text: true,
        },
      });
    }

    // Convert to flat key-value object
    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.translationKey] = t.text;
    }

    return corsResponse({
      success: true,
      data: result,
      lang: translations.length > 0 ? lang : 'fr',
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
