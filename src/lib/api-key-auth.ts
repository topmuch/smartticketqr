// ============================================================
// 🔑 API KEY AUTH - API key generation, validation, and management
// ============================================================
// Provides API key authentication for the Public API v1.
// API keys are stored as SHA-256 hashes in the ApiKey table.
// Each key belongs to an organization and has scoped permissions.
// In-memory per-hour rate limiting per API key (sliding window).
// ============================================================

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// TYPES
// ============================================================

export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  keyName: string;
  permissions: string[];
  rateLimit: number;
}

interface ApiKeyRecord {
  id: string;
  rawKey: string;
  keyPrefix: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  expiresAt: Date | null;
}

// ============================================================
// CORS HEADERS for Public API v1
// ============================================================

export const publicApiCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization, X-Organization-Id',
};

export function publicCorsResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...publicApiCorsHeaders,
      ...extraHeaders,
    },
  });
}

export function publicHandleCors() {
  return new NextResponse(null, { status: 204, headers: publicApiCorsHeaders });
}

/** Standard error response for public API */
export function publicApiError(message: string, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: {
        ...publicApiCorsHeaders,
        ...extraHeaders,
      },
    }
  );
}

// ============================================================
// API KEY RATE LIMITING (sliding window per API key per hour)
// ============================================================

interface RateLimitEntry {
  timestamps: number[];
}

const apiKeyRateStore = new Map<string, RateLimitEntry>();

const API_KEY_RATE_WINDOW = 3_600_000; // 1 hour
const API_KEY_CLEANUP_INTERVAL = 3_600_000; // 1 hour
const MAX_RATE_ENTRIES = 50_000;

let apiKeyCleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (apiKeyCleanupTimer) return;
  apiKeyCleanupTimer = setInterval(() => {
    const cutoff = Date.now() - API_KEY_RATE_WINDOW;
    for (const [key, entry] of apiKeyRateStore.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
      if (entry.timestamps.length === 0) {
        apiKeyRateStore.delete(key);
      }
    }
    if (apiKeyRateStore.size > MAX_RATE_ENTRIES) {
      apiKeyRateStore.clear();
    }
  }, API_KEY_CLEANUP_INTERVAL);
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Generate a new API key for an organization.
 *
 * @param prefix - Key prefix, e.g. "stq_live" or "stq_test"
 * @param organizationId - The organization that owns this key
 * @param name - Human-readable name for the key (e.g. "Mobile App")
 * @param options - Optional: permissions, rateLimit, expiresAt
 * @returns Object with the raw key (one-time display) and DB record details
 */
export async function generateApiKey(
  prefix: string,
  organizationId: string,
  name: string,
  options?: {
    permissions?: string[];
    rateLimit?: number;
    expiresAt?: Date;
  }
): Promise<ApiKeyRecord> {
  const randomPart = crypto.randomBytes(16).toString('hex'); // 32 hex chars
  const rawKey = `${prefix}_${randomPart}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 8);

  const permissions = options?.permissions ?? ['read'];
  const rateLimit = options?.rateLimit ?? 100;
  const expiresAt = options?.expiresAt ?? undefined;

  const apiKey = await db.apiKey.create({
    data: {
      organizationId,
      keyHash,
      keyPrefix,
      name,
      permissions: JSON.stringify(permissions),
      rateLimit,
      expiresAt,
      isActive: true,
    },
  });

  return {
    id: apiKey.id,
    rawKey,
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    permissions,
    rateLimit: apiKey.rateLimit,
    expiresAt: apiKey.expiresAt,
  };
}

/**
 * Hash a raw API key using SHA-256.
 *
 * @param rawKey - The raw API key string
 * @returns Hex-encoded SHA-256 hash
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Validate a raw API key against the database.
 *
 * Looks up the key by its SHA-256 hash, checks:
 * - isActive flag
 * - expiresAt date (if set, must be in the future)
 * - Organization is still active
 * - Updates lastUsedAt timestamp on success
 *
 * @param rawKey - The raw API key provided in the request
 * @returns The full ApiKey record with organization if valid, null otherwise
 */
export async function validateApiKey(rawKey: string) {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.length < 8) {
    return null;
  }

  const keyHash = hashApiKey(trimmed);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  if (!apiKey) return null;
  if (!apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  if (!apiKey.organization.isActive) return null;

  // Update lastUsedAt (fire-and-forget)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {
    // Silently ignore update errors
  });

  return apiKey;
}

/**
 * Check rate limit for a specific API key.
 *
 * Uses a sliding window of 1 hour per API key (reuses pattern from rate-limiter.ts).
 *
 * @param apiKeyId - The API key ID to check
 * @param rateLimit - Maximum requests per hour
 * @returns Object with allowed flag, remaining count, and reset time
 */
export function checkApiKeyRateLimit(
  apiKeyId: string,
  rateLimit: number
): { allowed: boolean; remaining: number; resetAtMs: number; retryAfterSeconds?: number } {
  ensureCleanupTimer();

  const now = Date.now();
  const cutoff = now - API_KEY_RATE_WINDOW;

  let entry = apiKeyRateStore.get(apiKeyId);
  if (!entry) {
    entry = { timestamps: [] };
    apiKeyRateStore.set(apiKeyId, entry);
  }

  // Filter out timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= rateLimit) {
    const oldestTs = entry.timestamps[0];
    const resetAtMs = oldestTs + API_KEY_RATE_WINDOW;
    const retryAfterSeconds = Math.ceil((resetAtMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAtMs,
      retryAfterSeconds,
    };
  }

  // Record this request
  entry.timestamps.push(now);

  const remaining = rateLimit - entry.timestamps.length;
  const resetAtMs = entry.timestamps[0] + API_KEY_RATE_WINDOW;

  return {
    allowed: true,
    remaining,
    resetAtMs,
  };
}

/**
 * Build standard rate limit headers for responses.
 */
export function getApiKeyRateLimitHeaders(result: { remaining: number; resetAtMs: number }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
  };
}

/**
 * Revoke an API key (soft delete — sets isActive to false).
 *
 * @param id - The API key ID to revoke
 * @returns Success status and optional error message
 */
export async function revokeApiKey(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = await db.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    if (!apiKey.isActive) {
      return { success: false, error: 'API key is already revoked' };
    }

    await db.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    // Clear any rate limit data for this key
    apiKeyRateStore.delete(id);

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to revoke API key' };
  }
}

/**
 * Rotate an API key.
 *
 * Creates a new key with the same permissions and settings,
 * deactivates the old one, and returns the new raw key
 * (which can only be displayed once).
 *
 * @param id - The API key ID to rotate
 * @returns New key details or error
 */
export async function rotateApiKey(
  id: string
): Promise<{ success: boolean; newKey?: ApiKeyRecord; error?: string }> {
  try {
    const existingKey = await db.apiKey.findUnique({
      where: { id },
    });

    if (!existingKey) {
      return { success: false, error: 'API key not found' };
    }

    // Determine prefix from the keyPrefix (e.g. "stq_live" from "stq_liv...")
    const rawPrefix = existingKey.keyPrefix.includes('_')
      ? existingKey.keyPrefix.split('_')[0]
      : 'stq_live';

    const permissions: string[] = JSON.parse(existingKey.permissions);
    const newExpiresAt = existingKey.expiresAt
      ? new Date(Math.max(existingKey.expiresAt.getTime(), Date.now() + 30 * 24 * 60 * 60 * 1000))
      : undefined;

    // Create the new key
    const newKey = await generateApiKey(rawPrefix, existingKey.organizationId, existingKey.name, {
      permissions,
      rateLimit: existingKey.rateLimit,
      expiresAt: newExpiresAt,
    });

    // Deactivate the old key
    await db.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    // Clear rate limit data for the old key
    apiKeyRateStore.delete(id);

    return { success: true, newKey };
  } catch (error) {
    return { success: false, error: 'Failed to rotate API key' };
  }
}

// ============================================================
// RESOLVE API KEY (request → context)
// ============================================================

/**
 * Extract and validate the X-API-Key from a request.
 * Also checks rate limits and updates lastUsedAt.
 *
 * @returns ApiKeyContext if valid, or a NextResponse error
 */
export async function resolveApiKey(
  request: NextRequest
): Promise<ResolvedApiKeyContext | NextResponse> {
  // Step 1: Get raw key from header
  const rawKey = request.headers.get('x-api-key');
  if (!rawKey) {
    return publicApiError('Missing X-API-Key header. Provide a valid API key to access this endpoint.', 401);
  }

  // Step 2: Validate key against database
  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) {
    return publicApiError('Invalid or expired API key. Check your key and try again.', 401);
  }

  // Step 3: Rate limiting
  const rateLimitResult = checkApiKeyRateLimit(apiKey.id, apiKey.rateLimit);
  if (!rateLimitResult.allowed) {
    const retryAfter = rateLimitResult.retryAfterSeconds || 3600;
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: `Rate limit exceeded. Maximum ${apiKey.rateLimit} requests per hour. Try again later.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          ...publicApiCorsHeaders,
          ...getApiKeyRateLimitHeaders(rateLimitResult),
        },
      }
    );
  }

  // Step 4: Parse permissions
  let permissions: string[] = ['read'];
  try {
    permissions = JSON.parse(apiKey.permissions);
  } catch {
    // Keep default ['read']
  }

  // Step 5: Return context with rate limit info attached
  return {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    keyName: apiKey.name,
    permissions,
    rateLimit: apiKey.rateLimit,
    _rateLimitResult: rateLimitResult, // attached for header extraction
  };
}

/**
 * Extended context that includes rate limit result for response headers.
 */
export interface ResolvedApiKeyContext extends ApiKeyContext {
  _rateLimitResult: { remaining: number; resetAtMs: number };
}

/**
 * Type guard: check if resolveApiKey returned an error response.
 */
export function isApiKeyError(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Extract rate limit headers from a resolved API key context.
 * Returns empty object if the context doesn't have rate limit info.
 */
export function extractRateLimitHeaders(context: ApiKeyContext): Record<string, string> {
  const extended = context as ResolvedApiKeyContext;
  if (extended._rateLimitResult) {
    return getApiKeyRateLimitHeaders(extended._rateLimitResult);
  }
  return {};
}
