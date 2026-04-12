// ============================================================
// 🪝 WEBHOOK DISPATCHER - Outbound webhook delivery system
// ============================================================
// Queues and delivers webhooks to configured endpoints.
// Supports HMAC-SHA256 signatures, exponential backoff retries,
// and comprehensive delivery logging.
// ============================================================

import crypto from 'crypto';
import { db } from '@/lib/db';

// ---- Types ----

interface WebhookPayload {
  [key: string]: unknown;
}

interface WebhookDeliveryResult {
  success: boolean;
  logId: string;
  httpStatus?: number;
  responseBody?: string;
  error?: string;
}

// ---- Retry Schedule ----

/**
 * Exponential backoff: 1min, 5min, 30min
 * Returns delay in milliseconds for the given attempt number.
 */
export function getRetrySchedule(attempt: number): number {
  const schedule: Record<number, number> = {
    1: 60_000,     // 1 minute
    2: 300_000,    // 5 minutes
    3: 1_800_000,  // 30 minutes
  };
  return schedule[attempt] ?? 3_600_000; // Default to 1 hour for attempts > 3
}

// ---- Signature Generation ----

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 *
 * @param payload - The payload object to sign
 * @param secret - The endpoint's signing secret
 * @returns Hex-encoded HMAC-SHA256 string
 */
export function generateSignature(payload: WebhookPayload, secret: string): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

// ---- Core Functions ----

/**
 * Dispatch a webhook event to all matching endpoints for an organization.
 *
 * Finds all active WebhookEndpoints subscribed to the given eventType,
 * and creates a pending WebhookLog entry for each.
 *
 * @param organizationId - The organization triggering the event
 * @param eventType - Event type string (e.g. "ticket.validated", "subscription.expired")
 * @param payload - Event payload data
 * @returns Number of webhooks queued
 */
export async function dispatchWebhook(
  organizationId: string,
  eventType: string,
  payload: WebhookPayload
): Promise<number> {
  try {
    // Find all active endpoints for this organization
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    if (endpoints.length === 0) {
      return 0;
    }

    const payloadString = JSON.stringify(payload);
    let queued = 0;

    for (const endpoint of endpoints) {
      // Check if this endpoint is subscribed to this event type
      const subscribedEvents: string[] = JSON.parse(endpoint.events);
      if (!subscribedEvents.includes(eventType)) {
        continue;
      }

      // Create a pending webhook log entry
      await db.webhookLog.create({
        data: {
          organizationId,
          endpointId: endpoint.id,
          eventType,
          payload: payloadString,
          status: 'pending',
          attempts: 1,
        },
      });

      queued++;
    }

    return queued;
  } catch (error) {
    console.error('[WebhookDispatcher] Failed to dispatch webhook:', error);
    return 0;
  }
}

/**
 * Process the pending webhook delivery queue.
 *
 * Fetches all pending webhook logs (and those past their nextRetryAt),
 * attempts delivery, and handles success/failure with exponential backoff.
 *
 * Called by a cron job or scheduled task.
 *
 * @returns Summary of processing results
 */
export async function processWebhookQueue(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
  retried: number;
}> {
  const now = new Date();
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let retried = 0;

  try {
    // Fetch all pending logs and those ready for retry
    const pendingLogs = await db.webhookLog.findMany({
      where: {
        status: 'pending',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      include: {
        endpoint: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100, // Process in batches to avoid overwhelming the system
    });

    for (const log of pendingLogs) {
      processed++;

      // Check if endpoint still exists and is active
      if (!log.endpoint || !log.endpoint.isActive) {
        await db.webhookLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            responseBody: 'Endpoint disabled or deleted',
          },
        });
        failed++;
        continue;
      }

      const result = await deliverWebhook(log);

      if (result.success) {
        delivered++;
      } else {
        if (log.attempts >= 3) {
          failed++;
        } else {
          retried++;
        }
      }
    }
  } catch (error) {
    console.error('[WebhookDispatcher] Queue processing error:', error);
  }

  return { processed, delivered, failed, retried };
}

/**
 * Deliver a single webhook log entry.
 *
 * Sends POST request to the endpoint URL with:
 * - X-Signature: sha256=<hmac_hex>
 * - X-Webhook-Id: <logId>
 * - X-Event-Type: <eventType>
 * - Content-Type: application/json
 *
 * On success: marks as delivered.
 * On failure: increments attempts, sets nextRetryAt with exponential backoff.
 * After 3 failed attempts: marks as failed permanently.
 */
async function deliverWebhook(
  log: {
    id: string;
    organizationId: string;
    endpointId: string;
    eventType: string;
    payload: string | null;
    attempts: number;
    endpoint: {
      id: string;
      url: string;
      secret: string;
    } | null;
  }
): Promise<WebhookDeliveryResult> {
  const payload = log.payload ?? '{}';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10 second timeout

  try {
    const signature = crypto
      .createHmac('sha256', log.endpoint!.secret)
      .update(payload)
      .digest('hex');

    const response = await fetch(log.endpoint!.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
        'X-Webhook-Id': log.id,
        'X-Event-Type': log.eventType,
      },
      body: payload,
      signal: controller.signal,
    });

    const responseBody = await response.text();

    if (response.status >= 200 && response.status < 300) {
      // Success
      await db.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'delivered',
          httpStatus: response.status,
          responseBody: responseBody.substring(0, 10_000), // Truncate large responses
        },
      });

      return {
        success: true,
        logId: log.id,
        httpStatus: response.status,
        responseBody,
      };
    } else {
      // Non-2xx response — treat as failure, retry
      return await handleDeliveryFailure(log, `HTTP ${response.status}: ${responseBody.substring(0, 500)}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown delivery error';
    return await handleDeliveryFailure(log, errorMessage);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Handle a failed webhook delivery — increment attempts and schedule retry.
 */
async function handleDeliveryFailure(
  log: {
    id: string;
    attempts: number;
  },
  errorMessage: string
): Promise<WebhookDeliveryResult> {
  const newAttempts = log.attempts + 1;

  if (newAttempts >= 3) {
    // Permanently failed after 3 attempts
    await db.webhookLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        attempts: newAttempts,
        nextRetryAt: null,
        responseBody: errorMessage.substring(0, 10_000),
      },
    });

    return {
      success: false,
      logId: log.id,
      error: errorMessage,
    };
  }

  // Schedule retry with exponential backoff
  const retryDelay = getRetrySchedule(newAttempts);
  const nextRetryAt = new Date(Date.now() + retryDelay);

  await db.webhookLog.update({
    where: { id: log.id },
    data: {
      attempts: newAttempts,
      nextRetryAt,
      responseBody: errorMessage.substring(0, 10_000),
    },
  });

  return {
    success: false,
    logId: log.id,
    error: errorMessage,
  };
}
