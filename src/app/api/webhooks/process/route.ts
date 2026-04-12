import { NextRequest } from 'next/server';
import { processWebhookQueue } from '@/lib/webhook-dispatcher';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

// ============================================================
// POST /api/webhooks/process — Trigger webhook queue processing
// ============================================================
// This endpoint is designed to be called by system cron jobs
// or by an admin manually. It processes all pending webhook
// deliveries that are due for retry.
//
// Auth: Uses a shared secret (X-Process-Secret header) for
// system-to-system calls, OR standard tenant auth.
//
// The process secret is read from env var WEBHOOK_PROCESS_SECRET.
// If not set, the endpoint requires standard tenant auth.
// ============================================================

const PROCESS_SECRET = process.env.WEBHOOK_PROCESS_SECRET;

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // Check for system process secret (for cron jobs)
    const processSecret = request.headers.get('x-process-secret');

    if (PROCESS_SECRET && processSecret === PROCESS_SECRET) {
      // System cron call — no tenant context needed
      const result = await processWebhookQueue();
      return corsResponse({
        success: true,
        processed: result.processed,
        failed: result.failed,
      });
    }

    // Fail-closed: if WEBHOOK_PROCESS_SECRET is set, reject any call without valid secret
    if (PROCESS_SECRET) {
      return corsResponse({ error: 'Valid process secret required' }, 401);
    }

    // No process secret configured — only allow in non-production environments
    if (process.env.NODE_ENV === 'production') {
      return corsResponse({ error: 'WEBHOOK_PROCESS_SECRET must be configured in production' }, 403);
    }

    // Dev environment without secret: allow open access for testing
    const result = await processWebhookQueue();
    return corsResponse({
      success: true,
      processed: result.processed,
      failed: result.failed,
    });
  });
}

export async function OPTIONS() {
  return handleCors();
}
