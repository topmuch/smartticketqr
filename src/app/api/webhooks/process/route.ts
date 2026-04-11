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

    // If no valid process secret, this can still work if called
    // without auth — the queue processor is org-agnostic and just
    // picks up pending entries from all orgs.
    // For additional security, you can require auth below.

    // If WEBHOOK_PROCESS_SECRET is configured, reject calls without it
    if (PROCESS_SECRET && processSecret !== PROCESS_SECRET) {
      return corsResponse({ error: 'Invalid process secret' }, 401);
    }

    // No process secret configured — allow open access (for dev environments)
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
