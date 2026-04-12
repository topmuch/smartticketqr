import { NextRequest } from 'next/server';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { checkLimit } from '@/lib/subscription-manager';

/**
 * POST /api/subscriptions/check
 * Check if an action is allowed under the current plan.
 * Auth required, resolves tenant.
 * Body: { limitType: 'events' | 'tickets_per_event' | 'users' | 'tickets_month', proposedValue? }
 * Returns: { allowed, reason, current, limit }
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { limitType, proposedValue } = body;

    const validLimitTypes = ['events', 'tickets_per_event', 'users', 'tickets_month'];
    if (!limitType || !validLimitTypes.includes(limitType)) {
      return corsResponse({
        error: `Invalid limitType. Must be one of: ${validLimitTypes.join(', ')}`,
      }, 400);
    }

    const result = await checkLimit(
      tenant.organizationId,
      limitType as 'events' | 'tickets_per_event' | 'users' | 'tickets_month',
      proposedValue,
    );

    return corsResponse({
      allowed: result.allowed,
      reason: result.reason,
      current: result.current,
      limit: result.limit,
    });
  });
}

export async function OPTIONS() { return handleCors(); }
