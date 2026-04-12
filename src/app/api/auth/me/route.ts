import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const fullUser = await db.user.findUnique({
      where: { id: tenant.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            isActive: true,
          },
        },
      },
    });

    if (!fullUser || !fullUser.isActive) {
      return corsResponse({ error: 'User not found or deactivated' }, 404);
    }

    return corsResponse({ user: fullUser });
  });
}

export async function OPTIONS() { return handleCors(); }
