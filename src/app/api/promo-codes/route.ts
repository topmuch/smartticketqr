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

    const promos = await db.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return corsResponse({ data: promos });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'settings.edit');
    if (isErrorResponse(permCheck)) return permCheck;

    const body = await request.json();
    const { code, type, value, minTickets, validFrom, validUntil, maxUses } = body;

    if (!code || !type || value === undefined) {
      return corsResponse({ error: 'code, type, and value are required' }, 400);
    }

    // Normalize type: accept both 'percentage' and 'percent', store as 'percent'
    const normalizedType = type === 'percentage' ? 'percent' : type;

    const existing = await db.promoCode.findUnique({
      where: { organizationId_code: { organizationId: tenant.organizationId, code: code.toUpperCase() } },
    });
    if (existing) {
      return corsResponse({ error: `Promo code "${code.toUpperCase()}" already exists` }, 409);
    }

    const promo = await db.promoCode.create({
      data: {
        organizationId: tenant.organizationId,
        code: code.toUpperCase(),
        type: normalizedType, // 'percent' or 'fixed'
        value: parseFloat(value) || 0,
        minTickets: parseInt(minTickets) || 1,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        maxUses: maxUses ? parseInt(maxUses) : null,
      },
    });

    return corsResponse({ data: promo }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
