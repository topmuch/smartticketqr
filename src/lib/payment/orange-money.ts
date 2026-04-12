// ============================================================
// 🟠 ORANGE MONEY — Payment Provider Implementation
// ============================================================
// In production, this calls the Orange Money Developer API.
//
// Production API: https://api.orange.com/orange-money/
// Webhook secret: [OM_API_SECRET]
// ============================================================

import type { PaymentProvider, PaymentIntent, PaymentResult, WebhookPayload } from './provider';

const OM_API_KEY = process.env.OM_API_KEY || 'demo_om_key';
const OM_API_SECRET = process.env.OM_API_SECRET || 'demo_om_secret';
const OM_MERCHANT_ID = process.env.OM_MERCHANT_ID || 'demo_merchant';

export class OrangeMoneyProvider implements PaymentProvider {
  readonly name = 'orange_money';

  async createPayment(params: {
    amount: number;
    currency: string;
    externalRef: string;
    phoneNumber?: string;
    description?: string;
  }): Promise<PaymentIntent> {
    // --- DEMO MODE: Simulate payment creation ---
    // In production, call:
    // POST https://api.orange.com/orange-money/v1/payments
    // Headers: Authorization: Bearer {access_token}
    // Body: { merchant_id, amount, currency, external_ref, phone_number }

    console.log(`[OrangeMoney] Creating payment: ${params.amount} ${params.currency} ref=${params.externalRef}`);

    return {
      externalRef: params.externalRef,
      checkoutUrl: `https://pay.orange.money/checkout/${params.externalRef}`,
      phoneNumber: params.phoneNumber,
      status: 'pending',
      message: `Paiement Orange Money de ${params.amount} FCFA initié. Veuillez confirmer via USSD.`,
    };
  }

  verifyWebhook(rawBody: string, signature: string): WebhookPayload {
    // --- DEMO MODE: Skip signature verification ---
    // In production, verify with OM API:
    // const expectedSig = crypto
    //   .createHmac('sha256', OM_API_SECRET)
    //   .update(rawBody)
    //   .digest('hex');

    const body = JSON.parse(rawBody);

    return {
      provider: 'orange_money',
      externalRef: body.external_ref || body.payment_id || '',
      status: body.status === 'SUCCESS' ? 'completed' : 'failed',
      amount: parseFloat(body.amount || '0'),
      currency: body.currency || 'XOF',
      timestamp: new Date().toISOString(),
      signature,
      rawBody: body,
    };
  }

  async checkStatus(externalRef: string): Promise<PaymentResult> {
    console.log(`[OrangeMoney] Checking status for ref=${externalRef}`);

    return {
      success: true,
      externalRef,
      status: 'completed',
      amount: 0,
      currency: 'XOF',
      provider: 'orange_money',
      message: 'Paiement confirmé (demo)',
    };
  }
}
