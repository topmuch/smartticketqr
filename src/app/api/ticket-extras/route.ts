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

    const extras = await db.ticketExtra.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return corsResponse({ data: extras });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'settings.edit');
    if (isErrorResponse(permCheck)) return permCheck;

    const body = await request.json();
    const { slug, name, emoji, pricingType, basePrice, requiresDetails, detailLabel, maxPerTicket } = body;

    if (!slug || !name) {
      return corsResponse({ error: 'slug and name are required' }, 400);
    }

    const existing = await db.ticketExtra.findUnique({
      where: { organizationId_slug: { organizationId: tenant.organizationId, slug } },
    });
    if (existing) {
      return corsResponse({ error: `Extra with slug "${slug}" already exists` }, 409);
    }

    const extra = await db.ticketExtra.create({
      data: {
        organizationId: tenant.organizationId,
        slug,
        name,
        emoji: emoji || '📦',
        pricingType: pricingType || 'fixed',
        basePrice: parseFloat(basePrice) || 0,
        requiresDetails: !!requiresDetails,
        detailLabel: detailLabel || '',
        maxPerTicket: parseInt(maxPerTicket) || 5,
      },
    });

    return corsResponse({ data: extra }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
