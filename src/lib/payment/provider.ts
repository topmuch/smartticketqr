// ============================================================
// 💳 PAYMENT PROVIDER INTERFACE
// ============================================================
// Swap Wave/OM/Stripe without refactoring — implement this interface.
// All providers return normalized PaymentResult.
// ============================================================

export interface PaymentIntent {
  /** Unique reference for idempotency */
  externalRef: string;
  /** Provider-specific checkout URL or payment instructions */
  checkoutUrl?: string;
  /** Phone number to send payment prompt (Wave/OM) */
  phoneNumber?: string;
  /** Status for client display */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Human-readable message */
  message: string;
}

export interface PaymentResult {
  success: boolean;
  externalRef: string;
  status: 'completed' | 'failed' | 'pending';
  amount: number;
  currency: string;
  provider: string;
  message: string;
  rawPayload?: unknown;
}

export interface WebhookPayload {
  provider: string;
  externalRef: string;
  status: 'completed' | 'failed';
  amount: number;
  currency: string;
  timestamp: string;
  signature: string;
  rawBody: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  /** Initialize a payment and return a PaymentIntent */
  createPayment(params: {
    amount: number;
    currency: string;
    externalRef: string;
    phoneNumber?: string;
    description?: string;
  }): Promise<PaymentIntent>;
  /** Verify a webhook signature and return parsed payload */
  verifyWebhook(rawBody: string, signature: string): WebhookPayload;
  /** Check payment status by external reference */
  checkStatus(externalRef: string): Promise<PaymentResult>;
}
