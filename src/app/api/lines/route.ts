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

// ─── GET /api/lines ────────────────────────────────────────────────────────
// Liste toutes les lignes de transport de l'organisation authentifiée
// avec leurs horaires associés.

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const lines = await db.transportLine.findMany({
      where: { organizationId: tenant.organizationId },
      include: {
        schedules: {
          orderBy: [{ type: 'asc' }, { time: 'asc' }],
        },
        _count: { select: { schedules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return corsResponse({ data: lines });
  });
}

// ─── POST /api/lines ───────────────────────────────────────────────────────
// Crée une nouvelle ligne de transport (admin/super_admin uniquement).

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { name, origin, destination, vehicleType, color } = body;

    if (!name || !origin || !destination) {
      return corsResponse(
        { error: 'Le nom, l\'origine et la destination sont requis' },
        400
      );
    }

    const validVehicleTypes = ['bus', 'boat', 'ferry', 'train'];
    const vType = vehicleType || 'bus';
    if (!validVehicleTypes.includes(vType)) {
      return corsResponse(
        { error: `Le type de véhicule doit être l'un des suivants : ${validVehicleTypes.join(', ')}` },
        400
      );
    }

    const line = await db.transportLine.create({
      data: {
        name,
        origin,
        destination,
        vehicleType: vType,
        color: color || '#059669',
        organizationId: tenant.organizationId,
      },
      include: {
        schedules: true,
      },
    });

    // Journal d'activité
    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'line.create',
        details: `Ligne de transport créée : ${line.name}`,
      },
    });

    return corsResponse({ data: line }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
