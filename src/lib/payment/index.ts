// ============================================================
// 🔧 PAYMENT PROVIDER REGISTRY
// ============================================================
// Returns the correct provider instance based on payment method name.
// Add new providers here.
// ============================================================

import type { PaymentProvider } from './provider';
import { WaveProvider } from './wave';
import { OrangeMoneyProvider } from './orange-money';

const providers: Record<string, PaymentProvider> = {
  wave: new WaveProvider(),
  orange_money: new OrangeMoneyProvider(),
  // stripe: new StripeProvider(),  // Phase 3
  // free: new FreeProvider(),      // No payment needed
};

/**
 * Get a payment provider instance by method name.
 * Throws if provider is not registered.
 */
export function getPaymentProvider(method: string): PaymentProvider {
  const provider = providers[method];
  if (!provider) {
    throw new Error(`Payment provider "${method}" is not supported. Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

/** List all registered provider names */
export function getAvailableProviders(): string[] {
  return Object.keys(providers);
}
