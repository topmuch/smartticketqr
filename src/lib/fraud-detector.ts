// ============================================================
// 🚨 FRAUD DETECTOR - Multi-rule fraud detection engine
// ============================================================
// Detects suspicious scan/ticket activity across multiple rules.
// NEVER auto-blocks — always flags + logs + allows admin review.
// Configurable thresholds per organization (stored in org settings JSON).
// ============================================================

import { db } from '@/lib/db';
import { haversineDistance } from '@/lib/geo-validator';

// ============================================================
// TYPES
// ============================================================

/** Parameters passed to the main detectFraud() entry point */
export interface FraudDetectionParams {
  /** The ticket being scanned */
  ticketId: string;
  /** The event the ticket belongs to */
  eventId: string;
  /** Organization that owns the ticket/event */
  organizationId: string;
  /** ID of the user performing the scan */
  scannedBy?: string;
  /** IP address of the scanner */
  ipAddress?: string;
  /** Device user-agent string */
  deviceInfo?: string;
  /** GPS latitude of the scan */
  latitude?: number;
  /** GPS longitude of the scan */
  longitude?: number;
}

/** Result returned from fraud detection */
export interface FraudDetectionResult {
  /** Whether any fraud rule was triggered */
  flagged: boolean;
  /** List of all alerts created during detection */
  alerts: FraudAlertDetail[];
}

/** Detail about a single fraud alert */
export interface FraudAlertDetail {
  /** The rule that triggered */
  ruleType: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable description */
  message: string;
  /** Structured details for admin review */
  details: Record<string, unknown>;
}

/** Aggregated fraud statistics for an organization */
export interface FraudStats {
  totalAlerts: number;
  flaggedCount: number;
  reviewedCount: number;
  dismissedCount: number;
  blockedCount: number;
  byRuleType: Record<string, number>;
  bySeverity: Record<string, number>;
  recentAlerts: {
    id: string;
    ruleType: string;
    severity: string;
    status: string;
    createdAt: Date;
    ticketId: string | null;
  }[];
}

/** Configurable fraud thresholds (per-organization overrides) */
export interface FraudThresholds {
  /** Max scans on same ticket within timeWindowMs for multiScanRapid rule (default: 3) */
  multiScanMaxCount: number;
  /** Time window in ms for multiScanRapid rule (default: 300000 = 5 min) */
  multiScanWindowMs: number;
  /** Max distance in km from event location for geoInconsistent rule (default: 50) */
  geoMaxDistanceKm: number;
  /** Max scans per IP per minute for suspiciousIp rule (default: 20) */
  ipMaxScansPerMinute: number;
  /** Time window in ms for suspiciousIp check (default: 60000 = 1 min) */
  ipScanWindowMs: number;
  /** Whether multiScanRapid rule is enabled (default: true) */
  multiScanEnabled: boolean;
  /** Whether geoInconsistent rule is enabled (default: true) */
  geoEnabled: boolean;
  /** Whether suspiciousIp rule is enabled (default: true) */
  ipEnabled: boolean;
  /** Whether deviceMismatch rule is enabled (default: true) */
  deviceEnabled: boolean;
}

const DEFAULT_THRESHOLDS: FraudThresholds = {
  multiScanMaxCount: 3,
  multiScanWindowMs: 300_000, // 5 minutes
  geoMaxDistanceKm: 50,
  ipMaxScansPerMinute: 20,
  ipScanWindowMs: 60_000, // 1 minute
  multiScanEnabled: true,
  geoEnabled: true,
  ipEnabled: true,
  deviceEnabled: true,
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Parse organization settings to extract fraud detection thresholds.
 * Falls back to defaults for any missing configuration.
 */
export function getFraudThresholds(orgSettings?: string): FraudThresholds {
  if (!orgSettings) return { ...DEFAULT_THRESHOLDS };

  try {
    const settings = JSON.parse(orgSettings);
    const fraud = settings.fraud_detection || {};

    return {
      multiScanMaxCount: fraud.multi_scan_max_count ?? DEFAULT_THRESHOLDS.multiScanMaxCount,
      multiScanWindowMs: fraud.multi_scan_window_ms ?? DEFAULT_THRESHOLDS.multiScanWindowMs,
      geoMaxDistanceKm: fraud.geo_max_distance_km ?? DEFAULT_THRESHOLDS.geoMaxDistanceKm,
      ipMaxScansPerMinute: fraud.ip_max_scans_per_minute ?? DEFAULT_THRESHOLDS.ipMaxScansPerMinute,
      ipScanWindowMs: fraud.ip_scan_window_ms ?? DEFAULT_THRESHOLDS.ipScanWindowMs,
      multiScanEnabled: fraud.multi_scan_enabled ?? DEFAULT_THRESHOLDS.multiScanEnabled,
      geoEnabled: fraud.geo_enabled ?? DEFAULT_THRESHOLDS.geoEnabled,
      ipEnabled: fraud.ip_enabled ?? DEFAULT_THRESHOLDS.ipEnabled,
      deviceEnabled: fraud.device_enabled ?? DEFAULT_THRESHOLDS.deviceEnabled,
    };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/**
 * Extract device fingerprint from a user-agent string.
 * Returns a simplified identifier (browser + os family) for comparison.
 */
function extractDeviceFingerprint(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  // Extract browser family
  let browser = 'unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'chrome';
  else if (ua.includes('firefox')) browser = 'firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'safari';
  else if (ua.includes('edg')) browser = 'edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'opera';

  // Extract OS family
  let os = 'unknown';
  if (ua.includes('android')) os = 'android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'ios';
  else if (ua.includes('windows')) os = 'windows';
  else if (ua.includes('mac os')) os = 'macos';
  else if (ua.includes('linux')) os = 'linux';

  return `${browser}:${os}`;
}

/**
 * Determine severity based on rule type and count/degree of violation.
 */
function determineSeverity(
  ruleType: string,
  details: Record<string, unknown>
): 'low' | 'medium' | 'high' | 'critical' {
  switch (ruleType) {
    case 'multi_scan_rapid': {
      const count = (details.scanCount as number) ?? 1;
      if (count >= 10) return 'critical';
      if (count >= 5) return 'high';
      if (count >= 3) return 'medium';
      return 'low';
    }
    case 'geo_inconsistent': {
      const distKm = (details.distanceKm as number) ?? 0;
      if (distKm >= 500) return 'high';
      if (distKm >= 200) return 'medium';
      return 'low';
    }
    case 'suspicious_ip': {
      const rate = (details.scanRatePerMinute as number) ?? 0;
      if (rate >= 100) return 'critical';
      if (rate >= 50) return 'high';
      if (rate >= 30) return 'medium';
      return 'low';
    }
    case 'device_mismatch':
      return 'medium';
    default:
      return 'low';
  }
}

// ============================================================
// FRAUD RULES
// ============================================================

/**
 * Rule: multiScanRapid — Detect if same ticket scanned multiple times
 * within a configurable time window.
 */
async function checkMultiScanRapid(
  params: FraudDetectionParams,
  thresholds: FraudThresholds
): Promise<FraudAlertDetail | null> {
  if (!thresholds.multiScanEnabled) return null;

  const windowStart = new Date(Date.now() - thresholds.multiScanWindowMs);

  // Count scans on this ticket within the time window
  const recentScans = await db.scan.findMany({
    where: {
      ticketId: params.ticketId,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      scannedBy: true,
      deviceInfo: true,
      latitude: true,
      longitude: true,
    },
  });

  const scanCount = recentScans.length;

  // Also count the current scan
  const totalScans = scanCount + 1;

  if (totalScans < thresholds.multiScanMaxCount) return null;

  // Build alert details
  const scanSummaries = recentScans.slice(0, 10).map((s) => ({
    scanId: s.id,
    scannedAt: s.createdAt.toISOString(),
    scannedBy: s.scannedBy,
    device: s.deviceInfo?.substring(0, 100),
  }));

  return {
    ruleType: 'multi_scan_rapid',
    severity: determineSeverity('multi_scan_rapid', { scanCount: totalScans }),
    message: `Ticket scanned ${totalScans} times in the last ${thresholds.multiScanWindowMs / 60_000} minutes`,
    details: {
      scanCount: totalScans,
      windowMinutes: thresholds.multiScanWindowMs / 60_000,
      threshold: thresholds.multiScanMaxCount,
      recentScans: scanSummaries,
    },
  };
}

/**
 * Rule: geoInconsistent — Detect if scan geolocation is far from event location
 * using the Haversine formula.
 */
async function checkGeoInconsistent(
  params: FraudDetectionParams,
  thresholds: FraudThresholds
): Promise<FraudAlertDetail | null> {
  if (!thresholds.geoEnabled) return null;
  if (params.latitude == null || params.longitude == null) return null;

  // Get event location
  const event = await db.event.findUnique({
    where: { id: params.eventId },
    select: { latitude: true, longitude: true, name: true },
  });

  if (!event || event.latitude == null || event.longitude == null) return null;

  // Calculate distance using Haversine (returns meters)
  const distanceMeters = haversineDistance(
    params.latitude,
    params.longitude,
    event.latitude,
    event.longitude
  );
  const distanceKm = distanceMeters / 1000;
  const maxDistanceKm = thresholds.geoMaxDistanceKm;

  if (distanceKm <= maxDistanceKm) return null;

  return {
    ruleType: 'geo_inconsistent',
    severity: determineSeverity('geo_inconsistent', { distanceKm }),
    message: `Scan is ${distanceKm.toFixed(1)}km from event "${event.name}" (threshold: ${maxDistanceKm}km)`,
    details: {
      distanceKm: Math.round(distanceKm * 10) / 10,
      maxDistanceKm,
      scanLat: params.latitude,
      scanLng: params.longitude,
      eventLat: event.latitude,
      eventLng: event.longitude,
      eventName: event.name,
    },
  };
}

/**
 * Rule: suspiciousIp — Track IP-based scan frequency per organization.
 */
async function checkSuspiciousIp(
  params: FraudDetectionParams,
  thresholds: FraudThresholds
): Promise<FraudAlertDetail | null> {
  if (!thresholds.ipEnabled) return null;
  if (!params.ipAddress) return null;

  const windowStart = new Date(Date.now() - thresholds.ipScanWindowMs);

  // Count scans from this IP for this org within the time window
  const ipScanCount = await db.scan.count({
    where: {
      organizationId: params.organizationId,
      createdAt: { gte: windowStart },
      // Note: Scan model doesn't have ipAddress field directly,
      // so we look at recent scan logs via device info heuristic
      // In production, the scan API should log IP in deviceInfo or a separate field
    },
  });

  // Since Scan model doesn't have an ipAddress field, we check
  // ActivityLog for IP-based tracking as a proxy
  const ipActivityCount = await db.activityLog.count({
    where: {
      organizationId: params.organizationId,
      ipAddress: params.ipAddress,
      action: { in: ['scan_ticket', 'validate_ticket'] },
      createdAt: { gte: windowStart },
    },
  });

  const totalFromIp = ipScanCount + ipActivityCount + 1; // +1 for current action
  const ratePerMinute = totalFromIp / (thresholds.ipScanWindowMs / 60_000);

  if (totalFromIp < thresholds.ipMaxScansPerMinute) return null;

  return {
    ruleType: 'suspicious_ip',
    severity: determineSeverity('suspicious_ip', { scanRatePerMinute: ratePerMinute }),
    message: `IP ${params.ipAddress} performed ${totalFromIp} scans in ${(thresholds.ipScanWindowMs / 60_000).toFixed(0)} minutes (threshold: ${thresholds.ipMaxScansPerMinute})`,
    details: {
      ipAddress: params.ipAddress,
      scanCount: totalFromIp,
      windowMinutes: thresholds.ipScanWindowMs / 60_000,
      threshold: thresholds.ipMaxScansPerMinute,
      scanRatePerMinute: Math.round(ratePerMinute * 10) / 10,
    },
  };
}

/**
 * Rule: deviceMismatch — Detect if same ticket scanned from very different devices rapidly.
 */
async function checkDeviceMismatch(
  params: FraudDetectionParams,
  thresholds: FraudThresholds
): Promise<FraudAlertDetail | null> {
  if (!thresholds.deviceEnabled) return null;
  if (!params.deviceInfo) return null;

  const windowStart = new Date(Date.now() - 300_000); // 5 minute window
  const currentFingerprint = extractDeviceFingerprint(params.deviceInfo);

  // Get recent scans on this ticket
  const recentScans = await db.scan.findMany({
    where: {
      ticketId: params.ticketId,
      createdAt: { gte: windowStart },
    },
    select: {
      deviceInfo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (recentScans.length === 0) return null;

  // Count distinct device fingerprints
  const fingerprints = new Map<string, number>();
  for (const scan of recentScans) {
    if (scan.deviceInfo) {
      const fp = extractDeviceFingerprint(scan.deviceInfo);
      fingerprints.set(fp, (fingerprints.get(fp) ?? 0) + 1);
    }
  }

  // Add current scan
  fingerprints.set(currentFingerprint, (fingerprints.get(currentFingerprint) ?? 0) + 1);

  // If scanned from more than 3 different device types within 5 min, flag it
  if (fingerprints.size < 3) return null;

  const deviceBreakdown: Record<string, number> = {};
  for (const [fp, count] of fingerprints) {
    deviceBreakdown[fp] = count;
  }

  return {
    ruleType: 'device_mismatch',
    severity: 'medium',
    message: `Ticket scanned from ${fingerprints.size} different device types within 5 minutes`,
    details: {
      deviceCount: fingerprints.size,
      devices: deviceBreakdown,
      windowMinutes: 5,
      currentDevice: currentFingerprint,
    },
  };
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Run all fraud detection rules against a scan/ticket action.
 *
 * This function:
 * 1. Loads configurable thresholds from organization settings
 * 2. Runs each enabled fraud rule in parallel
 * 3. Creates a FraudAlert record for each triggered rule (status: "flagged")
 * 4. NEVER auto-blocks — always flags for admin review
 *
 * @param params - Scan/action parameters to analyze
 * @returns Detection result with list of any triggered alerts
 */
export async function detectFraud(params: FraudDetectionParams): Promise<FraudDetectionResult> {
  const alerts: FraudAlertDetail[] = [];

  try {
    // Load org settings for configurable thresholds
    const org = await db.organization.findUnique({
      where: { id: params.organizationId },
      select: { settings: true },
    });

    const thresholds = getFraudThresholds(org?.settings);

    // Run all fraud rules in parallel
    const results = await Promise.allSettled([
      checkMultiScanRapid(params, thresholds),
      checkGeoInconsistent(params, thresholds),
      checkSuspiciousIp(params, thresholds),
      checkDeviceMismatch(params, thresholds),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const alert = result.value;
        alerts.push(alert);

        // Create a FraudAlert record in the database
        await db.fraudAlert.create({
          data: {
            organizationId: params.organizationId,
            ticketId: params.ticketId,
            userId: params.scannedBy,
            ruleType: alert.ruleType,
            severity: alert.severity,
            details: JSON.stringify(alert.details),
            status: 'flagged',
          },
        });
      }
    }
  } catch (error) {
    console.error('[FraudDetector] Error during fraud detection:', error);
  }

  return {
    flagged: alerts.length > 0,
    alerts,
  };
}

// ============================================================
// ALERT REVIEW
// ============================================================

/**
 * Review a fraud alert — update its status.
 *
 * Allowed statuses: "reviewed", "dismissed", "blocked"
 *
 * @param alertId - The FraudAlert ID to update
 * @param status - New status (reviewed / dismissed / blocked)
 * @param reviewedBy - ID of the user who reviewed the alert
 * @returns Updated alert or null if not found
 */
export async function reviewAlert(
  alertId: string,
  status: 'reviewed' | 'dismissed' | 'blocked',
  reviewedBy: string
) {
  const validStatuses = ['reviewed', 'dismissed', 'blocked'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid alert status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return db.fraudAlert.update({
    where: { id: alertId },
    data: {
      status,
      reviewedBy,
      reviewedAt: new Date(),
    },
  });
}

// ============================================================
// FRAUD STATS
// ============================================================

/**
 * Get aggregated fraud statistics for an organization's dashboard.
 *
 * Returns total counts, breakdowns by rule type and severity,
 * and the 20 most recent alerts.
 *
 * @param organizationId - The organization to get stats for
 */
export async function getFraudStats(organizationId: string): Promise<FraudStats> {
  const [total, flagged, reviewed, dismissed, blocked, recentAlerts] = await Promise.all([
    db.fraudAlert.count({ where: { organizationId } }),
    db.fraudAlert.count({ where: { organizationId, status: 'flagged' } }),
    db.fraudAlert.count({ where: { organizationId, status: 'reviewed' } }),
    db.fraudAlert.count({ where: { organizationId, status: 'dismissed' } }),
    db.fraudAlert.count({ where: { organizationId, status: 'blocked' } }),
    db.fraudAlert.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        ruleType: true,
        severity: true,
        status: true,
        createdAt: true,
        ticketId: true,
      },
    }),
  ]);

  // Build breakdowns by rule type and severity
  const allAlerts = await db.fraudAlert.findMany({
    where: { organizationId },
    select: { ruleType: true, severity: true },
  });

  const byRuleType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const alert of allAlerts) {
    byRuleType[alert.ruleType] = (byRuleType[alert.ruleType] ?? 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
  }

  return {
    totalAlerts: total,
    flaggedCount: flagged,
    reviewedCount: reviewed,
    dismissedCount: dismissed,
    blockedCount: blocked,
    byRuleType,
    bySeverity,
    recentAlerts,
  };
}

/**
 * Get a paginated list of fraud alerts for an organization.
 */
export async function getFraudAlerts(
  organizationId: string,
  options: {
    status?: string;
    ruleType?: string;
    severity?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const { status, ruleType, severity, page = 1, limit = 20 } = options;

  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (ruleType) where.ruleType = ruleType;
  if (severity) where.severity = severity;

  const [alerts, total] = await Promise.all([
    db.fraudAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        organization: {
          select: { name: true },
        },
      },
    }),
    db.fraudAlert.count({ where }),
  ]);

  return {
    alerts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
