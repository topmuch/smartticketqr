import { db } from '@/lib/db';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

/**
 * GET /api/subscription-plans
 * List all active subscription plans (public — no auth required).
 */
export async function GET() {
  return withErrorHandler(async () => {
    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        name: true,
        priceMonthly: true,
        currency: true,
        maxEvents: true,
        maxTicketsPerEvent: true,
        maxUsers: true,
        maxTicketsMonth: true,
        features: true,
        sortOrder: true,
      },
    });

    // Parse JSON features
    const parsedPlans = plans.map(plan => ({
      ...plan,
      features: JSON.parse(plan.features || '[]'),
    }));

    return corsResponse({ plans: parsedPlans });
  });
}

export async function OPTIONS() { return handleCors(); }
