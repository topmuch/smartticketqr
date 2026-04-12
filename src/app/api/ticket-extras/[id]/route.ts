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
    const { isActive, name, emoji, pricingType, basePrice, requiresDetails, detailLabel, maxPerTicket } = body;

    // Verify the extra belongs to the tenant's org
    const existing = await db.ticketExtra.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Ticket extra not found' }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (name !== undefined) updateData.name = name;
    if (emoji !== undefined) updateData.emoji = emoji;
    if (pricingType !== undefined) updateData.pricingType = pricingType;
    if (basePrice !== undefined) updateData.basePrice = parseFloat(basePrice) || 0;
    if (requiresDetails !== undefined) updateData.requiresDetails = !!requiresDetails;
    if (detailLabel !== undefined) updateData.detailLabel = detailLabel;
    if (maxPerTicket !== undefined) updateData.maxPerTicket = parseInt(maxPerTicket) || 5;

    const extra = await db.ticketExtra.update({
      where: { id },
      data: updateData,
    });

    return corsResponse({ data: extra });
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

    // Verify the extra belongs to the tenant's org
    const existing = await db.ticketExtra.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Ticket extra not found' }, 404);
    }

    await db.ticketExtra.delete({ where: { id } });

    return corsResponse({ success: true });
  });
}

export async function OPTIONS() { return handleCors(); }
