import crypto from 'crypto';

export function generateQRSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSecureHash(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifySecureHash(data: string, hash: string, secret: string): boolean {
  const computed = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return computed === hash;
}

export function encryptTicketData(ticketCode: string, eventId: string): string {
  const payload = JSON.stringify({ tc: ticketCode, ei: eventId, ts: Date.now() });
  return Buffer.from(payload).toString('base64url');
}

export function decryptTicketData(encrypted: string): { tc: string; ei: string; ts: number } | null {
  try {
    const decoded = Buffer.from(encrypted, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
