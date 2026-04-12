// ============================================================
// 🤝 AFFILIATE TRACKER - Referral & commission tracking system
// ============================================================
// Manages referral codes, tracks conversions, calculates commissions,
// and provides affiliate dashboard statistics.
// Commission only calculated for tickets with status = 'used'
// (anti-refund fraud protection).
// ============================================================

import { db } from '@/lib/db';
import { cookies } from 'next/headers';

// ============================================================
// TYPES
// ============================================================

/** Affiliate record with enriched data */
export interface AffiliateWithUser {
  id: string;
  organizationId: string;
  userId: string;
  code: string;
  commissionRate: number;
  totalRevenueGenerated: number;
  totalCommissionEarned: number;
  totalReferrals: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

/** Affiliate dashboard statistics */
export interface AffiliateDashboard {
  totalAffiliates: number;
  activeAffiliates: number;
  totalRevenueGenerated: number;
  totalCommissionEarned: number;
  totalCommissionsPending: number;
  totalReferrals: number;
  topAffiliates: AffiliateWithUser[];
  recentReferrals: {
    id: string;
    code: string;
    affiliateName: string;
    revenue: number;
    commission: number;
    createdAt: Date;
  }[];
  byCommissionRate: Record<string, { count: number; revenue: number }>;
}

/** Commission calculation result */
export interface CommissionResult {
  affiliateId: string;
  code: string;
  totalRevenueGenerated: number;
  commissionRate: number;
  commissionAmount: number;
  alreadyPaid: number;
  pendingPayout: number;
}

/** Referral cookie structure */
const REFERRAL_COOKIE_NAME = 'smartticket_referral';
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// ============================================================
// REFERRAL CODE GENERATION
// ============================================================

/**
 * Characters used for referral codes (excluding ambiguous chars like 0/O, 1/I/l).
 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a random alphanumeric referral code.
 * Length: 6-8 characters (default 7).
 */
function generateRandomCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

/**
 * Generate a unique referral code for a user in an organization.
 *
 * Ensures uniqueness by checking against existing codes in the database.
 * If a collision occurs (extremely rare), regenerates up to 10 times.
 *
 * @param userId - The user who will own this referral code
 * @param organizationId - The organization scope
 * @param preferredCode - Optional preferred code (must be alphanumeric, 4-12 chars)
 * @returns The generated or validated referral code
 */
export async function generateReferralCode(
  userId: string,
  organizationId: string,
  preferredCode?: string
): Promise<string> {
  // Validate preferred code if provided
  if (preferredCode) {
    if (!/^[A-Za-z0-9]{4,12}$/.test(preferredCode)) {
      throw new Error('Preferred code must be 4-12 alphanumeric characters');
    }

    // Check if preferred code is already taken (globally unique)
    const existing = await db.affiliate.findUnique({
      where: { code: preferredCode.toUpperCase() },
    });

    if (existing) {
      throw new Error('This referral code is already taken. Please choose another.');
    }

    const upperCode = preferredCode.toUpperCase();

    // Check if user already has an affiliate record
    const existingAffiliate = await db.affiliate.findFirst({
      where: { userId, organizationId },
    });

    if (existingAffiliate) {
      // Update existing affiliate's code
      await db.affiliate.update({
        where: { id: existingAffiliate.id },
        data: { code: upperCode },
      });
      return upperCode;
    }

    // Create new affiliate record
    await db.affiliate.create({
      data: {
        organizationId,
        userId,
        code: upperCode,
      },
    });
    return upperCode;
  }

  // Auto-generate a unique code
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateRandomCode();

    const existing = await db.affiliate.findUnique({
      where: { code },
    });

    if (!existing) {
      // Check if user already has an affiliate record
      const existingAffiliate = await db.affiliate.findFirst({
        where: { userId, organizationId },
      });

      if (existingAffiliate) {
        await db.affiliate.update({
          where: { id: existingAffiliate.id },
          data: { code },
        });
        return code;
      }

      await db.affiliate.create({
        data: {
          organizationId,
          userId,
          code,
        },
      });
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate a unique referral code after multiple attempts');
}

// ============================================================
// REFERRAL TRACKING
// ============================================================

/**
 * Track a referral conversion.
 *
 * Records that a ticket was purchased through a referral code.
 * Revenue is tracked for commission calculation.
 * Only tickets with status 'used' will count toward commission.
 *
 * @param code - The referral code used
 * @param ticketId - The ticket that was purchased/referred
 * @param revenue - The revenue amount from this referral
 * @returns The affiliate record that was updated
 */
export async function trackReferral(
  code: string,
  ticketId: string,
  revenue: number
): Promise<{
  success: boolean;
  affiliateId?: string;
  error?: string;
}> {
  try {
    // Look up affiliate by code
    const affiliate = await db.affiliate.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!affiliate) {
      return { success: false, error: 'Invalid referral code' };
    }

    if (!affiliate.isActive) {
      return { success: false, error: 'This referral code is no longer active' };
    }

    // Verify the ticket exists and belongs to the same organization
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        eventId: true,
        status: true,
        event: {
          select: { organizationId: true },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    if (ticket.event.organizationId !== affiliate.organizationId) {
      return { success: false, error: 'Referral code does not match ticket organization' };
    }

    // Update affiliate stats
    await db.affiliate.update({
      where: { id: affiliate.id },
      data: {
        totalRevenueGenerated: { increment: revenue },
        totalReferrals: { increment: 1 },
      },
    });

    // Log the referral as an activity
    await db.activityLog.create({
      data: {
        organizationId: affiliate.organizationId,
        userId: affiliate.userId,
        action: 'referral_conversion',
        details: JSON.stringify({
          referralCode: code.toUpperCase(),
          ticketId,
          revenue,
        }),
      },
    });

    return {
      success: true,
      affiliateId: affiliate.id,
    };
  } catch (error) {
    console.error('[AffiliateTracker] Error tracking referral:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track referral',
    };
  }
}

// ============================================================
// COMMISSION CALCULATION
// ============================================================

/**
 * Calculate commission for an affiliate based on their accumulated revenue.
 *
 * IMPORTANT: Commission is only calculated based on revenue from tickets
 * with status = 'used'. This prevents refund fraud.
 *
 * Formula: commissionAmount = eligibleRevenue * commissionRate / 100
 *
 * @param affiliateId - The affiliate to calculate commission for
 * @returns Commission breakdown including pending payout amount
 */
export async function calculateCommission(affiliateId: string): Promise<CommissionResult> {
  const affiliate = await db.affiliate.findUnique({
    where: { id: affiliateId },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  // Calculate eligible revenue: only count tickets referred by this affiliate
  // that have status = 'used'
  // We track this through activity logs where action = 'referral_conversion'
  const referralLogs = await db.activityLog.findMany({
    where: {
      userId: affiliate.userId,
      organizationId: affiliate.organizationId,
      action: 'referral_conversion',
    },
    select: {
      details: true,
      createdAt: true,
    },
  });

  let eligibleRevenue = 0;

  for (const log of referralLogs) {
    try {
      const details = JSON.parse(log.details || '{}');
      const ticketId = details.ticketId;

      if (ticketId) {
        // Check if this ticket is 'used' (validated)
        const ticket = await db.ticket.findUnique({
          where: { id: ticketId },
          select: { status: true, price: true },
        });

        if (ticket && ticket.status === 'used') {
          eligibleRevenue += details.revenue ?? ticket.price ?? 0;
        }
      }
    } catch {
      // Skip malformed logs
    }
  }

  const commissionAmount = eligibleRevenue * affiliate.commissionRate / 100;
  const pendingPayout = commissionAmount - affiliate.totalCommissionEarned;

  return {
    affiliateId: affiliate.id,
    code: affiliate.code,
    totalRevenueGenerated: Math.round(eligibleRevenue * 100) / 100,
    commissionRate: affiliate.commissionRate,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    alreadyPaid: Math.round(affiliate.totalCommissionEarned * 100) / 100,
    pendingPayout: Math.round(pendingPayout * 100) / 100,
  };
}

/**
 * Record a commission payout for an affiliate.
 *
 * @param affiliateId - The affiliate receiving the payout
 * @param amount - The amount paid out
 * @param paidBy - ID of the user processing the payout
 */
export async function recordCommissionPayout(
  affiliateId: string,
  amount: number,
  paidBy: string
) {
  const affiliate = await db.affiliate.findUnique({
    where: { id: affiliateId },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  if (amount <= 0) {
    throw new Error('Payout amount must be positive');
  }

  // Verify the affiliate has enough pending commission
  const commission = await calculateCommission(affiliateId);
  if (amount > commission.pendingPayout) {
    throw new Error(
      `Payout amount (${amount}) exceeds pending commission (${commission.pendingPayout})`
    );
  }

  // Update affiliate record
  await db.affiliate.update({
    where: { id: affiliateId },
    data: {
      totalCommissionEarned: { increment: amount },
    },
  });

  // Create a transaction record for the payout
  await db.transaction.create({
    data: {
      organizationId: affiliate.organizationId,
      userId: paidBy,
      amount: -amount, // Negative because it's an outgoing payment
      status: 'completed',
      paymentMethod: 'affiliate_payout',
      description: `Affiliate commission payout to ${affiliate.code}`,
    },
  });

  // Log the payout
  await db.activityLog.create({
    data: {
      organizationId: affiliate.organizationId,
      userId: paidBy,
      action: 'affiliate_payout',
      details: JSON.stringify({
        affiliateId,
        code: affiliate.code,
        amount,
      }),
    },
  });

  return {
    success: true,
    amount,
    affiliateCode: affiliate.code,
  };
}

// ============================================================
// AFFILIATE LOOKUP
// ============================================================

/**
 * Look up an affiliate by their referral code.
 *
 * @param code - The referral code to look up
 * @returns The affiliate record or null if not found
 */
export async function getAffiliateByCode(code: string): Promise<AffiliateWithUser | null> {
  const affiliate = await db.affiliate.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return affiliate;
}

/**
 * Get an affiliate by user ID within an organization.
 */
export async function getAffiliateByUser(
  userId: string,
  organizationId: string
): Promise<AffiliateWithUser | null> {
  return db.affiliate.findFirst({
    where: { userId, organizationId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

// ============================================================
// AFFILIATE DASHBOARD
// ============================================================

/**
 * Get comprehensive affiliate statistics for an organization's dashboard.
 *
 * Includes total counts, revenue figures, top performers, and recent referrals.
 *
 * @param organizationId - The organization to get stats for
 */
export async function getAffiliateDashboard(organizationId: string): Promise<AffiliateDashboard> {
  const affiliates = await db.affiliate.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { totalRevenueGenerated: 'desc' },
  });

  const activeAffiliates = affiliates.filter((a) => a.isActive);
  const totalRevenueGenerated = affiliates.reduce((sum, a) => sum + a.totalRevenueGenerated, 0);
  const totalCommissionEarned = affiliates.reduce((sum, a) => sum + a.totalCommissionEarned, 0);
  const totalReferrals = affiliates.reduce((sum, a) => sum + a.totalReferrals, 0);

  // Calculate pending commissions (total eligible - already paid)
  let totalCommissionsPending = 0;
  for (const affiliate of activeAffiliates) {
    try {
      const commission = await calculateCommission(affiliate.id);
      totalCommissionsPending += commission.pendingPayout;
    } catch {
      // Skip affiliates with errors
    }
  }
  totalCommissionsPending = Math.round(totalCommissionsPending * 100) / 100;

  // Top 5 affiliates by revenue
  const topAffiliates = affiliates.slice(0, 5);

  // Recent referral conversions from activity logs
  const recentReferralLogs = await db.activityLog.findMany({
    where: {
      organizationId,
      action: 'referral_conversion',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const recentReferrals = [];
  for (const log of recentReferralLogs) {
    try {
      const details = JSON.parse(log.details || '{}');
      const affiliate = affiliates.find((a) => a.userId === log.userId);

      recentReferrals.push({
        id: log.id,
        code: details.referralCode ?? 'N/A',
        affiliateName: affiliate?.user?.name ?? 'Unknown',
        revenue: details.revenue ?? 0,
        commission: affiliate
          ? Math.round((details.revenue ?? 0) * affiliate.commissionRate / 100 * 100) / 100
          : 0,
        createdAt: log.createdAt,
      });
    } catch {
      // Skip malformed logs
    }
  }

  // Breakdown by commission rate
  const byCommissionRate: Record<string, { count: number; revenue: number }> = {};
  for (const affiliate of affiliates) {
    const rateKey = `${affiliate.commissionRate}%`;
    if (!byCommissionRate[rateKey]) {
      byCommissionRate[rateKey] = { count: 0, revenue: 0 };
    }
    byCommissionRate[rateKey].count++;
    byCommissionRate[rateKey].revenue += affiliate.totalRevenueGenerated;
  }

  return {
    totalAffiliates: affiliates.length,
    activeAffiliates: activeAffiliates.length,
    totalRevenueGenerated: Math.round(totalRevenueGenerated * 100) / 100,
    totalCommissionEarned: Math.round(totalCommissionEarned * 100) / 100,
    totalCommissionsPending,
    totalReferrals,
    topAffiliates,
    recentReferrals,
    byCommissionRate,
  };
}

// ============================================================
// COOKIE-BASED REFERRAL TRACKING
// ============================================================

/**
 * Get the referral code from cookies (client-side cookie).
 *
 * Should be called on the server side during page requests to detect
 * incoming referrals.
 *
 * @returns The referral code from the cookie, or null if not set
 */
export async function getReferralCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(REFERRAL_COOKIE_NAME)?.value ?? null;
  } catch {
    // Cookies not available (e.g., during static generation)
    return null;
  }
}

/**
 * Set the referral code in cookies.
 *
 * Stores the referral code with a 30-day expiry so that future
 * purchases can be attributed to the referring affiliate.
 *
 * @param code - The referral code to store
 * @returns The Set-Cookie header value
 */
export function setReferralCookie(code: string): string {
  return `${REFERRAL_COOKIE_NAME}=${code}; Path=/; Max-Age=${REFERRAL_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

/**
 * Clear the referral cookie.
 *
 * @returns The Set-Cookie header value to clear the cookie
 */
export function clearReferralCookie(): string {
  return `${REFERRAL_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}

// ============================================================
// AFFILIATE MANAGEMENT
// ============================================================

/**
 * Update an affiliate's commission rate.
 *
 * @param affiliateId - The affiliate to update
 * @param commissionRate - New commission rate (percentage)
 */
export async function updateAffiliateCommission(
  affiliateId: string,
  commissionRate: number
) {
  if (commissionRate < 0 || commissionRate > 100) {
    throw new Error('Commission rate must be between 0 and 100');
  }

  return db.affiliate.update({
    where: { id: affiliateId },
    data: { commissionRate },
  });
}

/**
 * Activate or deactivate an affiliate.
 *
 * @param affiliateId - The affiliate to update
 * @param isActive - Whether the affiliate should be active
 */
export async function toggleAffiliateStatus(
  affiliateId: string,
  isActive: boolean
) {
  return db.affiliate.update({
    where: { id: affiliateId },
    data: { isActive },
  });
}
