import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import {
  resolveTenant,
  requireTenantRole,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

// ============================================================
// GET /api/affiliates — List affiliates for org
// ============================================================
// Query params:
//   ?page=1&limit=20
//   ?isActive=true|false
//
// Tenant-isolated by organizationId.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
    };

    const isActive = searchParams.get('isActive');
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const [affiliates, total] = await Promise.all([
      db.affiliate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.affiliate.count({ where }),
    ]);

    // Fetch user data separately (Affiliate has userId as plain string, not a Prisma relation)
    const userIds = [...new Set(affiliates.map((a) => a.userId).filter(Boolean))];
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, avatar: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedAffiliates = affiliates.map((a) => ({
      ...a,
      user: userMap.get(a.userId) || null,
    }));

    return corsResponse({
      success: true,
      data: enrichedAffiliates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
}

// ============================================================
// POST /api/affiliates — Create affiliate (generate referral code)
// ============================================================
// Body:
//   { userId: string, commissionRate?: number }
//
// Generates a unique referral code automatically.
// Requires admin or super_admin role.
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'admin', 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { userId, commissionRate } = body;

    if (!userId || typeof userId !== 'string') {
      return corsResponse({ error: 'userId is required' }, 400);
    }

    // Verify user belongs to this org
    const userExists = await db.user.findFirst({
      where: {
        id: userId,
        organizationId: tenant.organizationId,
      },
    });

    if (!userExists) {
      return corsResponse({ error: 'User not found in this organization' }, 400);
    }

    // Check if user is already an affiliate
    const existingAffiliate = await db.affiliate.findFirst({
      where: {
        organizationId: tenant.organizationId,
        userId,
      },
    });

    if (existingAffiliate) {
      return corsResponse({ error: 'User is already an affiliate for this organization' }, 409);
    }

    // Validate commission rate
    const parsedRate = typeof commissionRate === 'number'
      ? Math.max(0, Math.min(commissionRate, 50)) // max 50%
      : 5.0;

    // Generate unique referral code
    let code: string;
    let isUnique = false;
    let attempts = 0;
    do {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const existingCode = await db.affiliate.findUnique({ where: { code } });
      isUnique = !existingCode;
      attempts++;
    } while (!isUnique && attempts < 10);

    if (!isUnique) {
      return corsResponse({ error: 'Failed to generate unique referral code. Please try again.' }, 500);
    }

    const affiliate = await db.affiliate.create({
      data: {
        organizationId: tenant.organizationId,
        userId,
        code,
        commissionRate: parsedRate,
        totalRevenueGenerated: 0,
        totalCommissionEarned: 0,
        totalReferrals: 0,
        isActive: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'affiliate.create',
        details: `Created affiliate for ${userExists.name} with code: ${code} (${parsedRate}% commission)`,
      },
    });

    return corsResponse({
      success: true,
      data: affiliate,
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
