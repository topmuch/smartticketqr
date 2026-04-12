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
    const { isActive, name, emoji, priceModifier, requiresProof, proofLabel, ageMin, ageMax, maxPerBooking } = body;

    // Verify the fare type belongs to the tenant's org
    const existing = await db.fareType.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Fare type not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (name !== undefined) updateData.name = name;
    if (emoji !== undefined) updateData.emoji = emoji;
    if (priceModifier !== undefined) updateData.priceModifier = parseFloat(priceModifier);
    if (requiresProof !== undefined) updateData.requiresProof = !!requiresProof;
    if (proofLabel !== undefined) updateData.proofLabel = proofLabel;
    if (ageMin !== undefined) updateData.ageMin = ageMin ? parseInt(ageMin) : null;
    if (ageMax !== undefined) updateData.ageMax = ageMax ? parseInt(ageMax) : null;
    if (maxPerBooking !== undefined) updateData.maxPerBooking = parseInt(maxPerBooking) || 10;

    const fareType = await db.fareType.update({
      where: { id },
      data: updateData,
    });

    return corsResponse({ data: fareType });
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

    // Verify the fare type belongs to the tenant's org
    const existing = await db.fareType.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Fare type not found' }, 404);
    }

    await db.fareType.delete({ where: { id } });

    return corsResponse({ success: true });
  });
}

export async function OPTIONS() { return handleCors(); }
