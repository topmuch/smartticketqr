import { NextRequest } from 'next/server';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requireTenantRole } from '@/lib/api-helper';
import { createSubscription, getSubscriptionStatus } from '@/lib/subscription-manager';
import { getPaymentProvider } from '@/lib/payment';

/**
 * GET /api/subscriptions
 * Get current organization's subscription status with usage counts.
 * Auth required (any role), resolves tenant.
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const status = await getSubscriptionStatus(tenant.organizationId);
    if (!status) {
      return corsResponse({ error: 'Organization not found' }, 404);
    }

    return corsResponse({ subscription: status });
  });
}

/**
 * POST /api/subscriptions
 * Create a new subscription for the organization.
 * Auth required, admin+ role.
 * Body: { planCode, paymentMethod, months }
 * Returns: { subscription, paymentIntent }
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { planCode, paymentMethod, months } = body;

    if (!planCode || !paymentMethod) {
      return corsResponse({ error: 'planCode and paymentMethod are required' }, 400);
    }

    if (!months || months < 1 || months > 24) {
      return corsResponse({ error: 'months must be between 1 and 24' }, 400);
    }

    // Create subscription record
    const { subscriptionId, externalRef } = await createSubscription({
      organizationId: tenant.organizationId,
      planCode,
      paymentMethod,
      months,
    });

    // Get payment provider and create checkout intent
    const provider = getPaymentProvider(paymentMethod);
    const paymentIntent = await provider.createPayment({
      amount: 0, // Amount is stored in subscription; provider knows the ref
      currency: 'XOF',
      externalRef,
      description: `SmartTicketQR - ${planCode} subscription (${months} month${months > 1 ? 's' : ''})`,
    });

    return corsResponse({
      subscription: {
        id: subscriptionId,
        externalRef,
        planCode,
        paymentMethod,
        months,
      },
      paymentIntent,
    }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
