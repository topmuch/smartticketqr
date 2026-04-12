import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requirePermission } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };
    if (activeOnly) where.isActive = true;

    const fareTypes = await db.fareType.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return corsResponse({ data: fareTypes });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'settings.edit');
    if (isErrorResponse(permCheck)) return permCheck;

    const body = await request.json();
    const { slug, name, emoji, priceModifier, requiresProof, proofLabel, ageMin, ageMax, maxPerBooking, maxScans } = body;

    if (!slug || !name) {
      return corsResponse({ error: 'slug and name are required' }, 400);
    }

    // Check uniqueness
    const existing = await db.fareType.findUnique({
      where: { organizationId_slug: { organizationId: tenant.organizationId, slug } },
    });
    if (existing) {
      return corsResponse({ error: `Fare type with slug "${slug}" already exists` }, 409);
    }

    const fareType = await db.fareType.create({
      data: {
        organizationId: tenant.organizationId,
        slug,
        name,
        emoji: emoji || '🎫',
        priceModifier: parseFloat(priceModifier) || 1.0,
        requiresProof: !!requiresProof,
        proofLabel: proofLabel || '',
        ageMin: ageMin ? parseInt(ageMin) : null,
        ageMax: ageMax ? parseInt(ageMax) : null,
        maxPerBooking: parseInt(maxPerBooking) || 10,
        maxScans: parseInt(maxScans) || 1,
      },
    });

    return corsResponse({ data: fareType }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
