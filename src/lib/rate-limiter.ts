// ============================================================
// ⏱️ RATE LIMITER - In-memory rate limiting for API endpoints
// ============================================================
// Simple sliding-window rate limiter using a Map.
// Tracks requests per IP + endpoint combination.
// Max 5 validations/sec/IP by default.
// ============================================================

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval: remove entries older than 2 minutes
const CLEANUP_INTERVAL = 120_000; // 2 minutes
const MAX_ENTRIES = 10_000; // Memory safety limit

/**
 * Check if a request is within rate limits.
 *
 * @param key - Unique identifier (typically "ip:endpoint")
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 1000 // 1 second default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Get or create entry
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Filter out timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  // Check if limit exceeded
  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

/**
 * Get rate limit headers for the response.
 */
export function getRateLimitHeaders(result: { remaining: number; resetAt: number }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Periodic cleanup of expired entries.
 */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const cutoff = now - CLEANUP_INTERVAL;

    for (const [key, entry] of rateLimitStore.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
      if (entry.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }

    // Memory safety: if too many entries, clear all
    if (rateLimitStore.size > MAX_ENTRIES) {
      rateLimitStore.clear();
    }
  }, CLEANUP_INTERVAL);
}

// Auto-start cleanup timer
startCleanupTimer();
