import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, corsResponse, withErrorHandler } from '@/lib/api-helper';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fullUser || !fullUser.isActive) {
      return corsResponse({ error: 'User not found or deactivated' }, 404);
    }

    return corsResponse({ user: fullUser });
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
