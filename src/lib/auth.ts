import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─── Security: JWT secret MUST be set via environment variable ───
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Aborting server start.');
  }
  // Dev-only: warn but allow (never use in production!)
  console.warn(
    '[SECURITY] JWT_SECRET not set — using insecure development key. ' +
    'Set JWT_SECRET in .env for production use.'
  );
}

/** Resolved secret: always a string, but will crash the process in production if missing */
const _resolvedSecret = JWT_SECRET || 'dev-only-insecure-key-do-not-use-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    },
    _resolvedSecret,
    { expiresIn: '7d', algorithm: 'HS256' },
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, _resolvedSecret, { algorithms: ['HS256'] }) as JWTPayload;
  } catch {
    return null;
  }
}

export function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
}
