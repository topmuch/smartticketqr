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
  validateAudioUrl,
  SLUG_REGEX,
  VALID_CATEGORIES,
  LANGUAGE_OPTIONS,
  convertGoogleDriveUrl,
} from '@/lib/audio-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/audio-library/[id] ────────────────────────────────────────────
// Get a single audio file by ID.

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const tenant = resolveTenant(_request);
    if (isErrorResponse(tenant)) return tenant;

    const audio = await db.audioLibrary.findUnique({ where: { id } });

    if (!audio) {
      return corsResponse({ error: 'Audio not found' }, 404);
    }

    // Non-super_admin can only see global+active items
    if (tenant.role !== 'super_admin') {
      if (!audio.isGlobal || !audio.isActive) {
        return corsResponse({ error: 'Audio not found' }, 404);
      }
    }

    return corsResponse({ data: audio });
  });
}

// ─── PUT /api/audio-library/[id] ────────────────────────────────────────────
// Update an audio file (super_admin only).

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    // Check existence
    const existing = await db.audioLibrary.findUnique({ where: { id } });
    if (!existing) {
      return corsResponse({ error: 'Audio not found' }, 404);
    }

    const body = await request.json();
    const { name, slug, audioUrl, category, language, isGlobal, isActive } = body;

    // Validate slug uniqueness (exclude self)
    if (slug && slug !== existing.slug) {
      if (!SLUG_REGEX.test(slug)) {
        return corsResponse(
          { error: 'Slug must only contain lowercase letters, numbers, hyphens, and underscores' },
          400
        );
      }
      const slugExists = await db.audioLibrary.findFirst({
        where: { slug, NOT: { id } },
      });
      if (slugExists) {
        return corsResponse({ error: 'Slug already in use by another audio' }, 409);
      }
    }

    // Validate URL if provided
    if (audioUrl && !validateAudioUrl(audioUrl)) {
      return corsResponse({ error: 'Invalid audio URL format' }, 400);
    }

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      return corsResponse(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        400
      );
    }

    // Validate language if provided
    if (language) {
      const validLanguages = LANGUAGE_OPTIONS.map((l) => l.value);
      if (!validLanguages.includes(language)) {
        return corsResponse(
          { error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` },
          400
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (slug !== undefined) updateData.slug = slug;
    if (audioUrl !== undefined) updateData.audioUrl = convertGoogleDriveUrl(audioUrl);
    if (category !== undefined) updateData.category = category;
    if (language !== undefined) updateData.language = language;
    if (isGlobal !== undefined) updateData.isGlobal = Boolean(isGlobal);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await db.audioLibrary.update({
      where: { id },
      data: updateData,
    });

    return corsResponse({ data: updated });
  });
}

// ─── DELETE /api/audio-library/[id] ─────────────────────────────────────────
// Delete an audio file (super_admin only).

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const existing = await db.audioLibrary.findUnique({ where: { id } });
    if (!existing) {
      return corsResponse({ error: 'Audio not found' }, 404);
    }

    await db.audioLibrary.delete({ where: { id } });

    return corsResponse({ data: { deleted: true, id } });
  });
}

// ─── OPTIONS handler ────────────────────────────────────────────────────────

export async function OPTIONS() {
  return handleCors();
}
