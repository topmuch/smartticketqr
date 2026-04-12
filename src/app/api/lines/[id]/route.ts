import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  requireTenantRole,
} from '@/lib/api-helper';

// ─── GET /api/lines/[id] ───────────────────────────────────────────────────
// Récupère une ligne de transport avec ses horaires (scoped à l'organisation).

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    const line = await db.transportLine.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: {
        schedules: {
          orderBy: [{ type: 'asc' }, { time: 'asc' }],
        },
      },
    });

    if (!line) {
      return corsResponse({ error: 'Ligne de transport introuvable' }, 404);
    }

    return corsResponse({ data: line });
  });
}

// ─── PUT /api/lines/[id] ───────────────────────────────────────────────────
// Met à jour les champs d'une ligne (admin/super_admin uniquement).

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;
    const body = await request.json();

    // Vérifier que la ligne appartient à l'organisation
    const existing = await db.transportLine.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) {
      return corsResponse({ error: 'Ligne de transport introuvable' }, 404);
    }

    const { name, origin, destination, vehicleType, color, isActive } = body;

    // Validation du type de véhicule si fourni
    if (vehicleType) {
      const validVehicleTypes = ['bus', 'boat', 'ferry', 'train'];
      if (!validVehicleTypes.includes(vehicleType)) {
        return corsResponse(
          { error: `Le type de véhicule doit être l'un des suivants : ${validVehicleTypes.join(', ')}` },
          400
        );
      }
    }

    const line = await db.transportLine.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(origin && { origin }),
        ...(destination && { destination }),
        ...(vehicleType && { vehicleType }),
        ...(color && { color }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        schedules: {
          orderBy: [{ type: 'asc' }, { time: 'asc' }],
        },
      },
    });

    // Journal d'activité
    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'line.update',
        details: `Ligne de transport mise à jour : ${line.name}`,
      },
    });

    return corsResponse({ data: line });
  });
}

// ─── DELETE /api/lines/[id] ────────────────────────────────────────────────
// Supprime une ligne et ses horaires (cascade) — super_admin uniquement.

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { id } = await params;

    // Vérifier que la ligne appartient à l'organisation
    const existing = await db.transportLine.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { _count: { select: { schedules: true } } },
    });
    if (!existing) {
      return corsResponse({ error: 'Ligne de transport introuvable' }, 404);
    }

    // Suppression en cascade — les horaires sont supprimés automatiquement
    // grâce à onDelete: Cascade sur la relation LineSchedule -> TransportLine
    await db.transportLine.delete({
      where: { id },
    });

    // Journal d'activité
    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'line.delete',
        details: `Ligne de transport supprimée : ${existing.name} (${existing._count.schedules} horaire(s) supprimé(s))`,
      },
    });

    return corsResponse({
      data: { id, deleted: true },
      message: `Ligne « ${existing.name} » et ses ${existing._count.schedules} horaire(s) supprimés avec succès`,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
