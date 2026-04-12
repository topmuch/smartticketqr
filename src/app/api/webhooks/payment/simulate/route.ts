import { NextRequest } from 'next/server';
import { resolveTenant, isErrorResponse, requireTenantRole, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
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
    // ⚠️ Only admin and super_admin can simulate payments
    const tenant = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(tenant)) return tenant;

    // Block in production — simulation endpoints must never be exposed
    if (process.env.NODE_ENV === 'production') {
      return corsResponse({ error: 'Payment simulation is disabled in production' }, 403);
    }

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
