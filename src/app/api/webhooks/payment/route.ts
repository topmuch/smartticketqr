import { NextRequest } from 'next/server';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { activateSubscription, failSubscription } from '@/lib/subscription-manager';
import { getPaymentProvider } from '@/lib/payment';

/**
 * POST /api/webhooks/payment
 * Receive payment webhook from Wave/Orange Money.
 *
 * This endpoint does NOT require auth (called by payment providers).
 *
 * Headers:
 *   X-Provider:   "wave" or "orange_money"
 *   X-Signature:  HMAC signature for verification
 *
 * Flow:
 *   1. Read raw body + provider/sig headers
 *   2. Get payment provider instance
 *   3. Verify webhook signature
 *   4. Extract externalRef + status from parsed payload
 *   5. Activate or fail the subscription accordingly
 *   6. Always return 200 OK within 2 seconds (idempotent)
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const rawBody = await request.text();
    const providerName = request.headers.get('x-provider');
    const signature = request.headers.get('x-signature');

    // Log incoming webhook for audit
    console.log(`[Webhook] Payment webhook received`, {
      provider: providerName,
      hasSignature: !!signature,
      bodyLength: rawBody.length,
      timestamp: new Date().toISOString(),
    });

    // Validate provider header
    if (!providerName) {
      console.warn('[Webhook] Missing X-Provider header');
      return corsResponse({ received: true, error: 'Missing provider' });
    }

    if (!signature) {
      console.warn('[Webhook] Missing X-Signature header');
      return corsResponse({ received: true, error: 'Missing signature' });
    }

    try {
      // Get provider and verify signature
      const provider = getPaymentProvider(providerName);
      const payload = provider.verifyWebhook(rawBody, signature);

      console.log(`[Webhook] Verified payload`, {
        provider: payload.provider,
        externalRef: payload.externalRef,
        status: payload.status,
        amount: payload.amount,
        currency: payload.currency,
      });

      // Process based on payment status
      if (payload.status === 'completed') {
        try {
          await activateSubscription(payload.externalRef);
          console.log(`[Webhook] Subscription activated: ${payload.externalRef}`);
        } catch (err) {
          // Idempotence: already active is fine, log other errors
          console.error(`[Webhook] activateSubscription error:`, err);
        }
      } else if (payload.status === 'failed') {
        try {
          await failSubscription(payload.externalRef, `Payment failed via ${payload.provider}`);
          console.log(`[Webhook] Subscription failed: ${payload.externalRef}`);
        } catch (err) {
          console.error(`[Webhook] failSubscription error:`, err);
        }
      } else {
        console.log(`[Webhook] Ignoring status "${payload.status}" for ref ${payload.externalRef}`);
      }

      // Always return 200 OK — the provider should not retry on our errors
      return corsResponse({ received: true, processed: true });
    } catch (error) {
      console.error(`[Webhook] Processing error:`, error);

      // Still return 200 to prevent provider retries for malformed webhooks
      return corsResponse({ received: true, processed: false, error: 'Processing failed' });
    }
  });
}

export async function OPTIONS() { return handleCors(); }
