// ============================================================
// 🌍 GEO VALIDATOR - Haversine distance & anti-fraud
// ============================================================
// Calculates distance between GPS coordinates using Haversine.
// Compares scan location vs event location.
// Configurable max distance threshold per organization.
// GDPR-compliant: only captures geo when user consents.
// ============================================================

// ============================================================
// HAVERSINE FORMULA
// ============================================================

/**
 * Calculate the distance in meters between two GPS coordinates
 * using the Haversine formula.
 *
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================
// GEO VALIDATION RESULT
// ============================================================

export interface GeoCheckResult {
  /** Whether geo validation passed (within threshold) */
  withinThreshold: boolean;
  /** Distance in meters between scan and event location */
  distance: number | null;
  /** Configured max distance threshold in meters */
  maxDistance: number;
  /** Whether geo data was provided */
  hasGeoData: boolean;
  /** Alert message if threshold exceeded */
  alertMessage?: string;
}

// ============================================================
// VALIDATION LOGIC
// ============================================================

/**
 * Validate scan location against event location.
 *
 * Rules:
 * - If no geo data provided → pass (geo is optional)
 * - If no event coordinates → pass (geo not configured for event)
 * - If org has max_scan_distance in settings → use it, else default 500m
 * - Calculate distance and compare
 *
 * @param scanLat - Scanner GPS latitude
 * @param scanLng - Scanner GPS longitude
 * @param eventLat - Event location latitude
 * @param eventLng - Event location longitude
 * @param orgSettings - Organization settings JSON (may contain max_scan_distance)
 */
export function validateScanLocation(
  scanLat: number | null | undefined,
  scanLng: number | null | undefined,
  eventLat: number | null | undefined,
  eventLng: number | null | undefined,
  orgSettings?: string
): GeoCheckResult {
  // Default threshold: 500 meters
  let maxDistance = 500;

  // Parse org settings for custom threshold
  if (orgSettings) {
    try {
      const settings = JSON.parse(orgSettings);
      if (settings.max_scan_distance && typeof settings.max_scan_distance === 'number') {
        maxDistance = settings.max_scan_distance;
      }
    } catch {
      // Invalid JSON, use default
    }
  }

  // No scan geo data → pass (geo is optional, GDPR-compliant)
  if (scanLat == null || scanLng == null) {
    return {
      withinThreshold: true,
      distance: null,
      maxDistance,
      hasGeoData: false,
    };
  }

  // No event geo configured → pass (not all events have locations)
  if (eventLat == null || eventLng == null) {
    return {
      withinThreshold: true,
      distance: null,
      maxDistance,
      hasGeoData: true,
    };
  }

  // Calculate distance
  const distance = haversineDistance(scanLat, scanLng, eventLat, eventLng);
  const withinThreshold = distance <= maxDistance;

  return {
    withinThreshold,
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
    maxDistance,
    hasGeoData: true,
    alertMessage: withinThreshold
      ? undefined
      : `Scan location is ${formatDistance(distance)} from event location (max: ${formatDistance(maxDistance)})`,
  };
}

/**
 * Format distance for human-readable display.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Parse organization settings to get geo-related config.
 */
export function getOrgGeoConfig(orgSettings?: string): {
  maxScanDistance: number;
  geoEnabled: boolean;
} {
  const defaults = {
    maxScanDistance: 500,
    geoEnabled: true,
  };

  if (!orgSettings) return defaults;

  try {
    const settings = JSON.parse(orgSettings);
    return {
      maxScanDistance: settings.max_scan_distance || defaults.maxScanDistance,
      geoEnabled: settings.geo_enabled !== false,
    };
  } catch {
    return defaults;
  }
}
