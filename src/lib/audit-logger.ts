import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

// ============================================================
// 🔐 AUDIT LOGGER — Security-relevant action logging
// ============================================================
// Records security-sensitive operations (logins, permission
// changes, data exports, etc.) into the AuditLog table with
// IP, User-Agent, severity, and structured details.
// ============================================================

export type AuditAction =
  | 'LOGIN_FAIL'
  | 'LOGIN_SUCCESS'
  | 'PRICE_CHANGE'
  | 'TICKET_DELETE'
  | 'EVENT_UPDATE'
  | 'USER_DEACTIVATE'
  | 'USER_CREATE'
  | 'PERMISSION_CHANGE'
  | 'SUBSCRIPTION_CHANGE'
  | 'WEBHOOK_RECEIVED'
  | 'DATA_EXPORT'
  | 'SETTINGS_UPDATE';

export type Severity = 'info' | 'warning' | 'critical';

export interface LogAuditParams {
  organizationId: string;
  userId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  severity?: Severity;
  request?: NextRequest;
}

/**
 * Log a security-relevant audit event.
 *
 * Extracts IP and User-Agent from the request when provided.
 * Stores details as a JSON string in the database.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const {
    organizationId,
    userId,
    action,
    targetType,
    targetId,
    details,
    severity = 'info',
    request,
  } = params;

  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  if (request) {
    ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    userAgent = request.headers.get('user-agent') || undefined;
  }

  await db.auditLog.create({
    data: {
      organizationId,
      userId,
      action,
      targetType,
      targetId,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
      severity,
    },
  });
}

/**
 * Convenience helper: log a failed login attempt.
 */
export async function logLoginFail(
  organizationId: string,
  userId: string,
  request?: NextRequest,
  extra?: Record<string, unknown>
) {
  return logAudit({
    organizationId,
    userId,
    action: 'LOGIN_FAIL',
    severity: 'warning',
    request,
    details: extra,
  });
}

/**
 * Convenience helper: log a successful login.
 */
export async function logLoginSuccess(
  organizationId: string,
  userId: string,
  request?: NextRequest,
  extra?: Record<string, unknown>
) {
  return logAudit({
    organizationId,
    userId,
    action: 'LOGIN_SUCCESS',
    severity: 'info',
    request,
    details: extra,
  });
}

/**
 * Convenience helper: log a data export event.
 */
export async function logDataExport(
  organizationId: string,
  userId: string,
  request?: NextRequest,
  extra?: Record<string, unknown>
) {
  return logAudit({
    organizationId,
    userId,
    action: 'DATA_EXPORT',
    severity: 'info',
    request,
    details: extra,
  });
}

/**
 * Convenience helper: log a critical security event.
 */
export async function logCritical(
  organizationId: string,
  userId: string,
  action: AuditAction,
  request?: NextRequest,
  extra?: Record<string, unknown>
) {
  return logAudit({
    organizationId,
    userId,
    action,
    severity: 'critical',
    request,
    details: extra,
  });
}
