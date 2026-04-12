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

// ─── Types ─────────────────────────────────────────────────────────────────

const VALID_TYPES = ['departure', 'arrival'] as const;
const VALID_STATUSES = ['on_time', 'delayed', 'cancelled'] as const;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ─── GET /api/lines/[id]/schedules ─────────────────────────────────────────
// Liste tous les horaires d'une ligne (scoped à l'organisation).

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { id } = await params;

    // Vérifier que la ligne appartient à l'organisation
    const line = await db.transportLine.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!line) {
      return corsResponse({ error: 'Ligne de transport introuvable' }, 404);
    }

    const schedules = await db.lineSchedule.findMany({
      where: { lineId: id },
      orderBy: [{ type: 'asc' }, { time: 'asc' }],
    });

    return corsResponse({ data: schedules });
  });
}

// ─── POST /api/lines/[id]/schedules ────────────────────────────────────────
// Crée un nouvel horaire pour une ligne (admin/super_admin uniquement).

export async function POST(
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
    const { type, time, status, delayMinutes, note } = body;

    // Vérifier que la ligne appartient à l'organisation
    const line = await db.transportLine.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!line) {
      return corsResponse({ error: 'Ligne de transport introuvable' }, 404);
    }

    // Validations
    if (!type || !VALID_TYPES.includes(type)) {
      return corsResponse(
        { error: `Le type doit être l'un des suivants : ${VALID_TYPES.join(', ')}` },
        400
      );
    }

    if (!time || !TIME_REGEX.test(time)) {
      return corsResponse(
        { error: 'L\'heure doit être au format HH:MM (ex: 08:30)' },
        400
      );
    }

    const sStatus = status || 'on_time';
    if (!VALID_STATUSES.includes(sStatus as typeof VALID_STATUSES[number])) {
      return corsResponse(
        { error: `Le statut doit être l'un des suivants : ${VALID_STATUSES.join(', ')}` },
        400
      );
    }

    const schedule = await db.lineSchedule.create({
      data: {
        lineId: id,
        type,
        time,
        status: sStatus,
        delayMinutes: typeof delayMinutes === 'number' ? delayMinutes : 0,
        note: note ?? null,
      },
    });

    return corsResponse({ data: schedule }, 201);
  });
}

// ─── PUT /api/lines/[id]/schedules ─────────────────────────────────────────
// Mise à jour groupée de plusieurs horaires (bulk update).
// Body : { schedules: [{ id, type, time, status, delayMinutes, note }] }

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
    const { schedules } = body as {
      schedules: Array<{
        id: string;
        type?: string;
        time?: string;
        status?: string;
        delayMinutes?: number;
        note?: string | null;
      }>;
    };

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return corsResponse(
        { error: 'Un tableau d\'horaires est requis' },
        400
      );
    }

    // Vérifier que la ligne appartient à l'organisation
    const line = await db.transportLine.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!line) {
      return corsResponse({ error: 'Ligne de transport introuvable' }, 404);
    }

    // Vérifier que tous les horaires appartiennent à cette ligne
    const scheduleIds = schedules.map((s) => s.id);
    const existingSchedules = await db.lineSchedule.findMany({
      where: { id: { in: scheduleIds }, lineId: id },
      select: { id: true },
    });
    const existingIds = new Set(existingSchedules.map((s) => s.id));

    const invalidIds = scheduleIds.filter((sid) => !existingIds.has(sid));
    if (invalidIds.length > 0) {
      return corsResponse(
        { error: `${invalidIds.length} horaire(s) introuvable(s) sur cette ligne` },
        400
      );
    }

    // Mise à jour en parallèle avec Prisma transaction
    const updated = await db.$transaction(
      schedules.map((schedule) => {
        const updateData: Record<string, unknown> = {};

        if (schedule.type !== undefined) {
          if (!VALID_TYPES.includes(schedule.type as typeof VALID_TYPES[number])) {
            throw new Error(`Type invalide : ${schedule.type}`);
          }
          updateData.type = schedule.type;
        }

        if (schedule.time !== undefined) {
          if (!TIME_REGEX.test(schedule.time)) {
            throw new Error(`Heure invalide : ${schedule.time}. Format attendu : HH:MM`);
          }
          updateData.time = schedule.time;
        }

        if (schedule.status !== undefined) {
          if (!VALID_STATUSES.includes(schedule.status as typeof VALID_STATUSES[number])) {
            throw new Error(`Statut invalide : ${schedule.status}`);
          }
          updateData.status = schedule.status;
        }

        if (schedule.delayMinutes !== undefined) {
          updateData.delayMinutes = schedule.delayMinutes;
        }

        if (schedule.note !== undefined) {
          updateData.note = schedule.note;
        }

        return db.lineSchedule.update({
          where: { id: schedule.id },
          data: updateData,
        });
      })
    );

    // Journal d'activité
    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'schedule.bulk_update',
        details: `${updated.length} horaire(s) mis à jour pour la ligne : ${line.name}`,
      },
    });

    return corsResponse({
      data: updated,
      message: `${updated.length} horaire(s) mis à jour avec succès`,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
