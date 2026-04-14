import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  corsResponse,
  withErrorHandler,
  handleCors,
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
} from '@/lib/api-helper';
import {
  convertGoogleDriveUrl,
  validateAudioUrl,
  SLUG_REGEX,
  VALID_CATEGORIES,
  LANGUAGE_OPTIONS,
} from '@/lib/audio-helper';

// ─── GET /api/audio-library?category=xxx ────────────────────────────────────
// List audio files. Super admin gets all; clients get only global+active.

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (tenant.role !== 'super_admin') {
      where.isGlobal = true;
      where.isActive = true;
    }

    if (category && VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
      where.category = category;
    }

    const audioFiles = await db.audioLibrary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return corsResponse({ data: audioFiles, total: audioFiles.length });
  });
}

// ─── POST /api/audio-library ────────────────────────────────────────────────
// Create new audio file (super_admin only).

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { name, slug, audioUrl, category, language, isGlobal, isActive } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return corsResponse({ error: 'Name is required' }, 400);
    }

    if (!audioUrl || typeof audioUrl !== 'string') {
      return corsResponse({ error: 'Audio URL is required' }, 400);
    }

    // Validate URL
    if (!validateAudioUrl(audioUrl)) {
      return corsResponse({ error: 'Invalid audio URL format' }, 400);
    }

    // Validate slug
    const finalSlug = slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!SLUG_REGEX.test(finalSlug)) {
      return corsResponse(
        { error: 'Slug must only contain lowercase letters, numbers, hyphens, and underscores' },
        400
      );
    }

    // Check slug uniqueness
    const existing = await db.audioLibrary.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      return corsResponse({ error: 'Slug already exists' }, 409);
    }

    // Validate category
    const finalCategory = category || 'alert';
    if (!VALID_CATEGORIES.includes(finalCategory)) {
      return corsResponse(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        400
      );
    }

    // Validate language
    const finalLanguage = language || 'fr';
    const validLanguages = LANGUAGE_OPTIONS.map((l) => l.value);
    if (!validLanguages.includes(finalLanguage)) {
      return corsResponse(
        { error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` },
        400
      );
    }

    // Convert Google Drive URL if needed
    const convertedUrl = convertGoogleDriveUrl(audioUrl);

    const audio = await db.audioLibrary.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        audioUrl: convertedUrl,
        category: finalCategory,
        language: finalLanguage,
        isGlobal: isGlobal === true,
        isActive: isActive !== false,
      },
    });

    return corsResponse({ data: audio }, 201);
  });
}

// ─── OPTIONS handler ────────────────────────────────────────────────────────

export async function OPTIONS() {
  return handleCors();
}
