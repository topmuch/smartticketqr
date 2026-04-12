import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requirePermission } from '@/lib/api-helper';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'settings.edit');
    if (isErrorResponse(permCheck)) return permCheck;

    const { id } = await params;
    const body = await request.json();
    const { isActive, code, type, value, minTickets, validFrom, validUntil, maxUses } = body;

    // Verify the promo code belongs to the tenant's org
    const existing = await db.promoCode.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Promo code not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (type !== undefined) {
      // Normalize: accept both 'percentage' and 'percent', store as 'percent'
      updateData.type = type === 'percentage' ? 'percent' : type;
    }
    if (value !== undefined) updateData.value = parseFloat(value) || 0;
    if (minTickets !== undefined) updateData.minTickets = parseInt(minTickets) || 1;
    if (validFrom !== undefined) updateData.validFrom = validFrom ? new Date(validFrom) : null;
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (maxUses !== undefined) updateData.maxUses = maxUses ? parseInt(maxUses) : null;

    const promo = await db.promoCode.update({
      where: { id },
      data: updateData,
    });

    return corsResponse({ data: promo });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const permCheck = requirePermission(tenant, 'settings.edit');
    if (isErrorResponse(permCheck)) return permCheck;

    const { id } = await params;

    // Verify the promo code belongs to the tenant's org
    const existing = await db.promoCode.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Promo code not found' }, 404);
    }

    await db.promoCode.delete({ where: { id } });

    return corsResponse({ success: true });
  });
}

export async function OPTIONS() { return handleCors(); }
