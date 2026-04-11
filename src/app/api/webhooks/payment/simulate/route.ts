import { NextRequest } from 'next/server';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { activateSubscription } from '@/lib/subscription-manager';

/**
 * POST /api/webhooks/payment/simulate
 * Simulate a successful payment for demo/testing purposes.
 *
 * ⚠️  DEMO ONLY — Remove in production!
 *
 * Auth required, resolves tenant.
 * Body: { externalRef, planCode }
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { externalRef, planCode } = body;

    if (!externalRef) {
      return corsResponse({ error: 'externalRef is required' }, 400);
    }

    console.log(`[Simulate] Simulating successful payment`, {
      externalRef,
      planCode,
      organizationId: tenant.organizationId,
      triggeredBy: tenant.userId,
    });

    await activateSubscription(externalRef);

    return corsResponse({
      message: 'Payment simulated successfully',
      externalRef,
      planCode,
    });
  });
}

export async function OPTIONS() { return handleCors(); }
