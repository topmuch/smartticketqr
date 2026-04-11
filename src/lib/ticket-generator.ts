// ============================================================
// 🎫 TICKET GENERATOR - Secure QR Payload & HMAC Signing
// ============================================================
// Generates cryptographically signed QR payloads:
// - HMAC-SHA256 signature using org-specific secret
// - Expiration timestamp
// - Base64url-encoded payload for QR code
// ============================================================

import crypto from 'crypto';
import { db } from '@/lib/db';

// ============================================================
// TYPES
// ============================================================

export interface QRPayload {
  tid: string;      // ticket ID (cuid)
  tc: string;       // ticket code (e.g., ST-XXXX-XXXX)
  org: string;      // organization UUID
  exp: string;      // expiration ISO string
  sig: string;      // HMAC-SHA256 hex signature
}

export interface QRValidationResult {
  valid: boolean;
  payload?: QRPayload;
  error?: string;
}

// ============================================================
// ORG SECRET MANAGEMENT
// ============================================================

/**
 * Get or create HMAC secret for an organization.
 * Each org has its own secret for QR signing isolation.
 */
export async function getOrgSecret(organizationId: string): Promise<string> {
  let secret = await db.orgSecret.findUnique({
    where: { organizationId },
  });

  if (!secret) {
    const hmacSecret = crypto.randomBytes(32).toString('hex');
    secret = await db.orgSecret.create({
      data: {
        organizationId,
        hmacSecret,
      },
    });
  }

  return secret.hmacSecret;
}

/**
 * Get both current and previous HMAC secrets (for rotation grace period).
 */
export async function getOrgSecretsWithPrevious(organizationId: string): Promise<{ current: string; previous: string | null }> {
  const secret = await db.orgSecret.findUnique({
    where: { organizationId },
  });

  if (!secret) {
    const hmacSecret = crypto.randomBytes(32).toString('hex');
    await db.orgSecret.create({
      data: { organizationId, hmacSecret },
    });
    return { current: hmacSecret, previous: null };
  }

  return { current: secret.hmacSecret, previous: secret.previousSecret };
}

/**
 * Rotate HMAC secret for an organization.
 * Old secret kept as previousSecret for 24h grace period.
 */
export async function rotateOrgSecret(organizationId: string): Promise<string> {
  const existing = await db.orgSecret.findUnique({
    where: { organizationId },
  });

  const newSecret = crypto.randomBytes(32).toString('hex');

  if (existing) {
    await db.orgSecret.update({
      where: { id: existing.id },
      data: {
        hmacSecret: newSecret,
        previousSecret: existing.hmacSecret,
        rotatedAt: new Date(),
      },
    });
  } else {
    await db.orgSecret.create({
      data: {
        organizationId,
        hmacSecret: newSecret,
      },
    });
  }

  return newSecret;
}

// ============================================================
// QR PAYLOAD GENERATION
// ============================================================

/**
 * Generate a signed QR payload for a ticket.
 *
 * QR Payload format (JSON → Base64URL):
 * {
 *   "tid": "ticket-cuid-id",
 *   "tc": "ST-XXXX-XXXX",
 *   "org": "organization-uuid",
 *   "exp": "2025-12-31T23:59:00.000Z",
 *   "sig": "hmac-sha256-hex-signature"
 * }
 */
export async function generateSignedQRPayload(params: {
  ticketId: string;
  ticketCode: string;
  orgUuid: string;
  organizationId: string;
  expiresAt?: Date;
}): Promise<string> {
  const { ticketId, ticketCode, orgUuid, organizationId, expiresAt } = params;

  // Get org HMAC secret
  const hmacSecret = await getOrgSecret(organizationId);

  // Default expiration: 1 year from now or event-specific
  const expiration = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const expStr = expiration.toISOString();

  // Build data to sign (without signature)
  const dataToSign = `${ticketId}:${ticketCode}:${orgUuid}:${expStr}`;

  // Generate HMAC-SHA256 signature
  const sig = crypto.createHmac('sha256', hmacSecret).update(dataToSign).digest('hex');

  // Build payload
  const payload: QRPayload = {
    tid: ticketId,
    tc: ticketCode,
    org: orgUuid,
    exp: expStr,
    sig,
  };

  // Encode to Base64URL
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// ============================================================
// QR PAYLOAD VALIDATION
// ============================================================

/**
 * Validate and decode a QR payload string.
 *
 * Returns:
 * - valid: true if signature matches and not expired
 * - payload: decoded payload data
 * - error: reason for invalidation
 */
export async function validateQRPayload(
  encodedPayload: string,
  organizationId: string
): Promise<QRValidationResult> {
  try {
    // Decode Base64URL
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload: QRPayload = JSON.parse(jsonStr);

    // Validate required fields
    if (!payload.tid || !payload.tc || !payload.org || !payload.exp || !payload.sig) {
      return { valid: false, error: 'Malformed QR payload: missing required fields' };
    }

    // Check expiration
    const expDate = new Date(payload.exp);
    if (isNaN(expDate.getTime())) {
      return { valid: false, error: 'Invalid expiration date in QR payload' };
    }
    if (expDate < new Date()) {
      return { valid: false, error: 'QR code has expired', payload };
    }

    // Get org secrets (current + previous for rotation)
    const secrets = await getOrgSecretsWithPrevious(organizationId);

    // Reconstruct data to sign
    const dataToSign = `${payload.tid}:${payload.tc}:${payload.org}:${payload.exp}`;

    // Verify signature with current secret
    const currentSig = crypto.createHmac('sha256', secrets.current).update(dataToSign).digest('hex');
    if (currentSig === payload.sig) {
      return { valid: true, payload };
    }

    // Verify with previous secret (grace period after rotation)
    if (secrets.previous) {
      const previousSig = crypto.createHmac('sha256', secrets.previous).update(dataToSign).digest('hex');
      if (previousSig === payload.sig) {
        return { valid: true, payload };
      }
    }

    return { valid: false, error: 'Invalid QR signature', payload };
  } catch {
    return { valid: false, error: 'Failed to decode QR payload' };
  }
}

/**
 * Quick validation by ticket code (for backward compatibility with manual entry).
 * Falls back to direct DB lookup without HMAC verification.
 */
export function validateTicketCode(ticketCode: string): { clean: string; valid: boolean } {
  const clean = ticketCode.trim().toUpperCase();
  if (!clean || clean.length < 3) {
    return { clean: '', valid: false };
  }
  return { clean, valid: true };
}

/**
 * Build a public ticket URL for WhatsApp sharing.
 */
export function buildPublicTicketUrl(baseUrl: string, ticketCode: string, orgSlug: string): string {
  return `${baseUrl}/ticket/${orgSlug}/${ticketCode}`;
}
