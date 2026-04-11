/**
 * Webhook Sender Service
 *
 * A standalone cron-like mini-service that periodically triggers the
 * main SmartTicketQR app's webhook delivery queue processing.
 *
 * It calls POST /api/webhooks/process on the main app at a configurable
 * interval (default: every 60 seconds) and logs the results.
 *
 * Environment Variables:
 *   APP_URL                - Base URL of the main app (default: http://localhost:3000)
 *   WEBHOOK_PROCESS_SECRET - Secret token for authenticating process requests (optional)
 *   POLL_INTERVAL_MS       - Milliseconds between processing cycles (default: 60000)
 *
 * Usage:
 *   bun --hot index.ts   (development with hot reload)
 *   bun index.ts          (production)
 */

// ─── Configuration ────────────────────────────────────────────────────────────
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const PROCESS_SECRET = process.env.WEBHOOK_PROCESS_SECRET || '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);

// ─── Process webhook queue ────────────────────────────────────────────────────
// Calls the main app's endpoint to flush pending webhook deliveries.
// Errors are caught and logged so the service never crashes.
async function processQueue(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Processing webhook queue...`);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Include the process secret header when configured
    if (PROCESS_SECRET) {
      headers['X-Process-Secret'] = PROCESS_SECRET;
    }

    const response = await fetch(`${APP_URL}/api/webhooks/process`, {
      method: 'POST',
      headers,
    });

    const result = await response.json();

    if (response.ok) {
      const { processed, delivered, failed } = result;
      console.log(
        `[${new Date().toISOString()}] Queue processed: ${processed} total, ${delivered} delivered, ${failed} failed`
      );

      if (failed > 0) {
        console.warn(
          `[${new Date().toISOString()}] ⚠️  ${failed} webhook(s) failed delivery`
        );
      }
    } else {
      console.error(
        `[${new Date().toISOString()}] Failed to process queue: HTTP ${response.status}`,
        result
      );
    }
  } catch (error) {
    // Never let an uncaught error crash the service
    console.error(
      `[${new Date().toISOString()}] Error processing webhook queue:`,
      error
    );
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`🪝 Webhook Sender Service`);
  console.log(`   App URL: ${APP_URL}`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(
    `   Process secret: ${PROCESS_SECRET ? 'configured' : 'not set (open access)'}`
  );
  console.log('');

  // Process the queue immediately on startup
  await processQueue();

  // Then schedule periodic processing
  setInterval(async () => {
    await processQueue();
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);
