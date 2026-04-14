// ============================================================
// 🛡️ API ERROR HANDLER — Production-safe error responses
// ============================================================
// Standalone convenience module for handling errors in API routes.
// Prevents database internals (Prisma, SQL) from leaking to clients.
//
// Usage in any API route:
//   import { handleApiError } from '@/lib/api-error';
//   try { ... } catch (err) { return handleApiError(err); }
//
// Guarantees:
//  • Stack traces are NEVER sent to the client
//  • Prisma error codes → safe, user-friendly messages
//  • SQL/internal errors → "Internal server error" in production
//  • Full error details are always logged server-side
// ============================================================

import { NextResponse } from 'next/server';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
} from '@prisma/client/runtime/library';

// ─── Prisma error map ─────────────────────────────────────
const PRISMA_ERROR_MAP: Record<string, string> = {
  P2002: 'A record with this value already exists',
  P2003: 'Referenced record not found',
  P2004: 'A constraint on the database failed',
  P2005: 'Invalid value provided for a field',
  P2006: 'Invalid value provided — data could not be stored',
  P2007: 'Data validation error',
  P2008: 'Failed to parse the query',
  P2009: 'Query validation error',
  P2011: 'Null constraint violation',
  P2012: 'Missing required value for a field',
  P2013: 'Missing required argument',
  P2015: 'Related record not found',
  P2020: 'Value out of range for field',
  P2024: 'Database connection timeout — please retry',
  P2025: 'Record not found',
  P2034: 'Transaction conflict — please retry',
  P2036: 'Foreign key constraint failed',
  P2041: 'Unable to acquire lock — please retry',
  P2042: 'Unable to acquire row lock — please retry',
};

const PRISMA_STATUS_MAP: Record<string, number> = {
  P2002: 409,
  P2003: 400,
  P2005: 400,
  P2006: 400,
  P2007: 400,
  P2008: 400,
  P2009: 400,
  P2011: 400,
  P2012: 400,
  P2013: 400,
  P2020: 400,
  P2024: 503,
  P2025: 404,
  P2034: 409,
  P2036: 400,
  P2041: 423,
  P2042: 423,
};

// ─── Detect SQL leak patterns ─────────────────────────────
const SQL_PATTERNS = [
  /SELECT\s/i,
  /INSERT\s/i,
  /UPDATE\s/i,
  /DELETE\s/i,
  /CREATE\s+TABLE/i,
  /ALTER\s+TABLE/i,
  /DROP\s/i,
  /PRAGMA\s/i,
  /sqlite_/i,
  /table\s+/i,
  /column\s+/i,
  /constraint\s+/i,
  /foreign\s+key/i,
  /unique\s+constraint/i,
  / INNER JOIN /i,
  / LEFT JOIN /i,
  / WHERE /i,
  / GROUP BY /i,
  / ORDER BY /i,
];

/**
 * Check if a message contains potential SQL or DB internals that should be masked.
 */
function containsSqlLeak(message: string): boolean {
  return SQL_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Classify an error and return a safe message + HTTP status.
 */
function classifyError(error: unknown): { message: string; status: number } {
  // Prisma known errors
  if (error instanceof PrismaClientKnownRequestError) {
    const userMessage = PRISMA_ERROR_MAP[error.code] ?? 'A database error occurred';
    const status = PRISMA_STATUS_MAP[error.code] ?? 500;
    return { message: userMessage, status };
  }

  // Prisma validation errors
  if (error instanceof PrismaClientValidationError) {
    return { message: 'Invalid request data', status: 400 };
  }

  // Prisma initialization errors (DB unreachable)
  if (error instanceof PrismaClientInitializationError) {
    return { message: 'Database is temporarily unavailable', status: 503 };
  }

  // Prisma Rust panic
  if (error instanceof PrismaClientRustPanicError) {
    return { message: 'A database error occurred', status: 500 };
  }

  // Generic errors
  const message = error instanceof Error ? error.message : String(error);
  return { message, status: 500 };
}

/**
 * Handle an error safely:
 *  - Logs full details server-side
 *  - Returns a sanitized response to the client
 *  - NEVER leaks stack traces, SQL, or DB internals in production
 *
 * @param error   — The caught error (unknown)
 * @param context — Optional context string for logging (e.g. 'create-ticket')
 */
export function handleApiError(
  error: unknown,
  context?: string
): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';
  const tag = context ? `[${context}]` : '[API Error]';

  // Classify the error
  const { message, status } = classifyError(error);

  // Build the client-safe message
  let clientMessage: string;

  if (status >= 400 && status < 500) {
    // 4xx errors: the message is safe to show (user input errors)
    clientMessage = message;
  } else {
    // 5xx errors: check for SQL leaks and hide in production
    if (isProduction || containsSqlLeak(message)) {
      clientMessage = 'Internal server error';
    } else {
      // Development: show the actual message but never the stack
      clientMessage = message;
    }
  }

  // Log full details server-side (always, regardless of env)
  const stack = error instanceof Error ? error.stack : undefined;
  const errorCode = error instanceof PrismaClientKnownRequestError ? error.code : null;

  console.error(
    `\x1b[31m${tag}\x1b[0m\n` +
    `  Status: ${status}\n` +
    `  Client message: ${clientMessage}\n` +
    `  Raw error: ${error instanceof Error ? error.message : String(error)}\n` +
    (errorCode ? `  Prisma code: ${errorCode}\n` : '') +
    (stack ? `  Stack:\n${stack}\n` : '')
  );

  return NextResponse.json(
    { error: clientMessage },
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

/**
 * Create a typed error response (for use outside try/catch).
 * Usage: return apiError('Not found', 404);
 */
export function apiError(message: string, status: number = 500): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
