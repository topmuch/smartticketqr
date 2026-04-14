import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  requireTenantRole,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

// ============================================================
// GET /api/fraud-alerts — List fraud alerts for org
// ============================================================
// Query params:
//   ?page=1&limit=20
//   ?status=flagged|reviewed|dismissed|blocked
//   ?severity=low|medium|high|critical
//   ?ruleType=multi_scan_rapid|geo_inconsistent|suspicious_ip|device_mismatch
//
// Tenant-isolated by organizationId.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    // Filter by status
    const status = searchParams.get('status');
    if (status && ['flagged', 'reviewed', 'dismissed', 'blocked'].includes(status)) {
      where.status = status;
    }

    // Filter by severity
    const severity = searchParams.get('severity');
    if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
      where.severity = severity;
    }

    // Filter by ruleType
    const ruleType = searchParams.get('ruleType');
    if (ruleType && ['multi_scan_rapid', 'geo_inconsistent', 'suspicious_ip', 'device_mismatch'].includes(ruleType)) {
      where.ruleType = ruleType;
    }

    const [alerts, total] = await Promise.all([
      db.fraudAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.fraudAlert.count({ where }),
    ]);

    return corsResponse({
      success: true,
      data: alerts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}

// ============================================================
// POST /api/fraud-alerts — Create fraud alert (manually)
// ============================================================
// Body:
//   { ticketId?: string, userId?: string, ruleType: string,
//     severity?: string, details?: string }
//
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // Only admin and super_admin can create fraud alerts
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { ticketId, userId, ruleType, severity, details } = body;

    // Validate ruleType
    const validRuleTypes = ['multi_scan_rapid', 'geo_inconsistent', 'suspicious_ip', 'device_mismatch', 'manual'];
    if (!ruleType || !validRuleTypes.includes(ruleType)) {
      return corsResponse({
        error: `ruleType is required. Allowed: ${validRuleTypes.join(', ')}`,
      }, 400);
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const parsedSeverity = severity && validSeverities.includes(severity)
      ? severity
      : 'medium';

    // Validate ticketId if provided
    if (ticketId) {
      const ticketExists = await db.ticket.findUnique({
        where: { id: ticketId },
      });
      if (!ticketExists) {
        return corsResponse({ error: 'Ticket not found' }, 400);
      }
    }

    // Validate userId if provided
    if (userId) {
      const userExists = await db.user.findFirst({
        where: {
          id: userId,
          organizationId: tenant.organizationId,
        },
      });
      if (!userExists) {
        return corsResponse({ error: 'User not found in this organization' }, 400);
      }
    }

    const alert = await db.fraudAlert.create({
      data: {
        organizationId: tenant.organizationId,
        ticketId: ticketId || null,
        userId: userId || null,
        ruleType,
        severity: parsedSeverity,
        details: typeof details === 'string' ? details : null,
        status: 'flagged',
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'fraud_alert.create',
        details: `Created fraud alert (${ruleType}/${parsedSeverity}): ${alert.id}`,
      },
    });

    return corsResponse({
      success: true,
      data: alert,
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
