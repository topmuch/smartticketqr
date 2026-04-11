// ============================================================
// 📋 SUBSCRIPTION MANAGER
// ============================================================
// Handles the full subscription lifecycle:
// - Create / activate / expire / cancel subscriptions
// - Check plan limits (events, tickets, users)
// - Enforce trial periods
// - Renewal logic
// ============================================================

import { db } from '@/lib/db';
import crypto from 'crypto';

export interface PlanLimits {
  maxEvents: number;
  maxTicketsPerEvent: number;
  maxUsers: number;
  maxTicketsMonth: number; // 0 = unlimited
}

export interface SubscriptionCheck {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  actionUrl?: string;
}

// Default plan limits (used as fallback)
const DEFAULT_PLANS: Record<string, PlanLimits> = {
  starter: { maxEvents: 5, maxTicketsPerEvent: 500, maxUsers: 3, maxTicketsMonth: 2000 },
  pro: { maxEvents: 50, maxTicketsPerEvent: 5000, maxUsers: 20, maxTicketsMonth: 20000 },
  enterprise: { maxEvents: 999999, maxTicketsPerEvent: 100000, maxUsers: 999999, maxTicketsMonth: 0 },
};

/**
 * Get plan limits from SubscriptionPlan table, with defaults fallback.
 */
export async function getPlanLimits(planCode: string): Promise<PlanLimits> {
  const plan = await db.subscriptionPlan.findUnique({ where: { code: planCode } });
  if (plan) {
    return {
      maxEvents: plan.maxEvents,
      maxTicketsPerEvent: plan.maxTicketsPerEvent,
      maxUsers: plan.maxUsers,
      maxTicketsMonth: plan.maxTicketsMonth,
    };
  }
  return DEFAULT_PLANS[planCode] || DEFAULT_PLANS.starter;
}

/**
 * Check if an organization can perform an action based on plan limits.
 */
export async function checkLimit(
  organizationId: string,
  limitType: 'events' | 'tickets_per_event' | 'users' | 'tickets_month',
  proposedValue?: number
): Promise<SubscriptionCheck> {
  // 1. Get organization subscription status
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return { allowed: false, reason: 'Organization not found', current: 0, limit: 0 };
  }

  // 2. Check if subscription is active
  if (org.subscriptionStatus === 'expired' || org.subscriptionStatus === 'cancelled') {
    return {
      allowed: false,
      reason: `Subscription ${org.subscriptionStatus}. Please renew to continue.`,
      current: 0,
      limit: 0,
      actionUrl: '/billing',
    };
  }

  // 3. Check trial expiry
  if (org.subscriptionStatus === 'trial' && org.subscriptionExpiresAt && new Date() > org.subscriptionExpiresAt) {
    // Auto-expire trial
    await db.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: 'expired' },
    });
    return {
      allowed: false,
      reason: 'Trial period expired. Please upgrade to a paid plan.',
      current: 0,
      limit: 0,
      actionUrl: '/billing',
    };
  }

  // 4. Get plan limits
  const limits = await getPlanLimits(org.subscriptionPlan);

  // 5. Check specific limit type
  switch (limitType) {
    case 'events': {
      const count = await db.event.count({ where: { organizationId } });
      return {
        allowed: count < limits.maxEvents,
        reason: count >= limits.maxEvents ? `Event limit reached (${count}/${limits.maxEvents}). Upgrade your plan.` : undefined,
        current: count,
        limit: limits.maxEvents,
        actionUrl: count >= limits.maxEvents ? '/billing' : undefined,
      };
    }
    case 'users': {
      const count = await db.user.count({ where: { organizationId, isActive: true } });
      return {
        allowed: count < limits.maxUsers,
        reason: count >= limits.maxUsers ? `User limit reached (${count}/${limits.maxUsers}).` : undefined,
        current: count,
        limit: limits.maxUsers,
        actionUrl: count >= limits.maxUsers ? '/billing' : undefined,
      };
    }
    case 'tickets_per_event': {
      const proposed = proposedValue || 0;
      const limit = limits.maxTicketsPerEvent;
      return {
        allowed: proposed <= limit,
        reason: proposed > limit ? `Max tickets per event: ${limit}.` : undefined,
        current: proposed,
        limit,
        actionUrl: proposed > limit ? '/billing' : undefined,
      };
    }
    case 'tickets_month': {
      if (limits.maxTicketsMonth === 0) {
        return { allowed: true, current: 0, limit: 0 }; // unlimited
      }
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      // Count tickets created this month via event relation
      const count = await db.ticket.count({
        where: {
          event: { organizationId },
          createdAt: { gte: startOfMonth },
        },
      });
      return {
        allowed: count < limits.maxTicketsMonth,
        reason: count >= limits.maxTicketsMonth ? `Monthly ticket limit reached (${count}/${limits.maxTicketsMonth}).` : undefined,
        current: count,
        limit: limits.maxTicketsMonth,
        actionUrl: count >= limits.maxTicketsMonth ? '/billing' : undefined,
      };
    }
  }
}

/**
 * Create a new subscription for an organization.
 */
export async function createSubscription(params: {
  organizationId: string;
  planCode: string;
  paymentMethod: string;
  months: number;
}): Promise<{ subscriptionId: string; externalRef: string }> {
  const { organizationId, planCode, paymentMethod, months } = params;

  // Get plan pricing
  const plan = await db.subscriptionPlan.findUnique({ where: { code: planCode } });
  if (!plan) throw new Error(`Plan "${planCode}" not found`);

  const amount = plan.priceMonthly * months;
  const externalRef = `SUB-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  // Create subscription record
  const subscription = await db.subscription.create({
    data: {
      organizationId,
      planCode,
      amount,
      currency: plan.currency,
      startDate,
      endDate,
      status: 'pending',
      paymentMethod,
      externalRef,
    },
  });

  return { subscriptionId: subscription.id, externalRef };
}

/**
 * Activate a subscription after successful payment.
 * Called by the webhook handler.
 */
export async function activateSubscription(externalRef: string): Promise<void> {
  const subscription = await db.subscription.findUnique({ where: { externalRef } });
  if (!subscription) throw new Error(`Subscription with ref "${externalRef}" not found`);

  // Idempotence: already active
  if (subscription.status === 'active') {
    console.log(`[Subscription] Already active: ${externalRef}`);
    return;
  }

  // Get plan limits
  const limits = await getPlanLimits(subscription.planCode);

  // Activate subscription
  await db.subscription.update({
    where: { id: subscription.id },
    data: { status: 'active' },
  });

  // Update organization
  await db.organization.update({
    where: { id: subscription.organizationId },
    data: {
      subscriptionPlan: subscription.planCode,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: subscription.endDate,
      maxEvents: limits.maxEvents,
      maxTicketsPerEvent: limits.maxTicketsPerEvent,
      maxUsers: limits.maxUsers,
      isActive: true,
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      organizationId: subscription.organizationId,
      action: 'subscription.activated',
      details: `Subscription activated: ${subscription.planCode}, ref=${externalRef}, expires=${subscription.endDate.toISOString()}`,
    },
  });

  console.log(`[Subscription] Activated: ${externalRef} → org=${subscription.organizationId} plan=${subscription.planCode}`);
}

/**
 * Mark subscription as failed.
 */
export async function failSubscription(externalRef: string, reason: string): Promise<void> {
  const subscription = await db.subscription.findUnique({ where: { externalRef } });
  if (!subscription) throw new Error(`Subscription with ref "${externalRef}" not found`);

  await db.subscription.update({
    where: { id: subscription.id },
    data: { status: 'cancelled', metadata: JSON.stringify({ failedReason: reason }) },
  });

  await db.activityLog.create({
    data: {
      organizationId: subscription.organizationId,
      action: 'subscription.failed',
      details: `Subscription payment failed: ${reason}, ref=${externalRef}`,
    },
  });
}

/**
 * Check and expire overdue subscriptions.
 * Call this on a schedule (cron) or on app startup.
 */
export async function expireOverdueSubscriptions(): Promise<number> {
  const now = new Date();

  // Find active subscriptions past their end date
  const expired = await db.subscription.findMany({
    where: {
      status: 'active',
      endDate: { lt: now },
    },
  });

  let count = 0;
  for (const sub of expired) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: 'expired' },
    });

    await db.organization.update({
      where: { id: sub.organizationId },
      data: { subscriptionStatus: 'expired' },
    });

    await db.activityLog.create({
      data: {
        organizationId: sub.organizationId,
        action: 'subscription.expired',
        details: `Subscription expired: ${sub.planCode}`,
      },
    });

    count++;
  }

  if (count > 0) console.log(`[Subscription] Expired ${count} overdue subscriptions`);
  return count;
}

/**
 * Get comprehensive subscription status for an organization.
 */
export async function getSubscriptionStatus(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return null;

  const limits = await getPlanLimits(org.subscriptionPlan);

  const activeSub = await db.subscription.findFirst({
    where: { organizationId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });

  const currentEventCount = await db.event.count({ where: { organizationId } });
  const currentUserCount = await db.user.count({ where: { organizationId, isActive: true } });

  return {
    plan: org.subscriptionPlan,
    status: org.subscriptionStatus,
    expiresAt: org.subscriptionExpiresAt,
    limits,
    usage: {
      events: { current: currentEventCount, limit: limits.maxEvents },
      users: { current: currentUserCount, limit: limits.maxUsers },
    },
    activeSubscription: activeSub,
    isInTrial: org.subscriptionStatus === 'trial',
    isExpired: org.subscriptionStatus === 'expired',
    isActive: org.subscriptionStatus === 'active',
    needsAttention: org.subscriptionStatus === 'expired' || org.subscriptionStatus === 'trial',
  };
}
