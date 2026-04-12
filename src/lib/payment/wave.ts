// ============================================================
// 🌊 WAVE BUSINESS (Senegal) — Payment Provider Implementation
// ============================================================
// In production, this calls the Wave API directly.
// For demo/development, this simulates the payment flow.
//
// Production API: https://api.wave.com/v1/
// Webhook secret: [WAVE_API_SECRET]
// Webhook URL: [PAYMENT_WEBHOOK_URL]/api/webhooks/payment
// ============================================================

import crypto from 'crypto';
import type { PaymentProvider, PaymentIntent, PaymentResult, WebhookPayload } from './provider';

const WAVE_API_KEY = process.env.WAVE_API_KEY || 'demo_wave_key';
const WAVE_API_SECRET = process.env.WAVE_API_SECRET || 'demo_wave_secret_hmac_key';

export class WaveProvider implements PaymentProvider {
  readonly name = 'wave';

  async createPayment(params: {
    amount: number;
    currency: string;
    externalRef: string;
    phoneNumber?: string;
    description?: string;
  }): Promise<PaymentIntent> {
    // --- DEMO MODE: Simulate payment creation ---
    // In production, call:
    // POST https://api.wave.com/v1/checkout/sessions
    // Headers: Authorization: Bearer {WAVE_API_KEY}
    // Body: { amount, currency, external_ref, phone_number, description }

    console.log(`[Wave] Creating payment: ${params.amount} ${params.currency} ref=${params.externalRef}`);

    return {
      externalRef: params.externalRef,
      checkoutUrl: `https://pay.wave.com/checkout/${params.externalRef}`,
      phoneNumber: params.phoneNumber,
      status: 'pending',
      message: `Paiement Wave de ${params.amount} FCFA initié. Veuillez confirmer sur votre téléphone.`,
    };
  }

  verifyWebhook(rawBody: string, signature: string): WebhookPayload {
    // --- DEMO MODE: Skip signature verification ---
    // In production, verify HMAC:
    // const expectedSig = crypto
    //   .createHmac('sha256', WAVE_API_SECRET)
    //   .update(rawBody)
    //   .digest('hex');
    // if (signature !== expectedSig) throw new Error('Invalid Wave webhook signature');

    const body = JSON.parse(rawBody);

    return {
      provider: 'wave',
      externalRef: body.external_ref || body.data?.id || '',
      status: body.status === 'succeeded' ? 'completed' : 'failed',
      amount: parseFloat(body.amount || body.data?.amount || '0'),
      currency: body.currency || 'XOF',
      timestamp: new Date().toISOString(),
      signature,
      rawBody: body,
    };
  }

  async checkStatus(externalRef: string): Promise<PaymentResult> {
    // --- DEMO MODE: Return mock status ---
    console.log(`[Wave] Checking status for ref=${externalRef}`);

    return {
      success: true,
      externalRef,
      status: 'completed',
      amount: 0,
      currency: 'XOF',
      provider: 'wave',
      message: 'Paiement confirmé (demo)',
    };
  }
}
