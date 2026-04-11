import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, requireRole, corsResponse, withErrorHandler, isErrorResponse, parsePagination, corsHeaders } from '@/lib/api-helper';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin', 'admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              tickets: true,
              scans: true,
              events: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return corsResponse({
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = getUserFromRequest(request);
    if (!user) {
      return corsResponse({ error: 'Authentication required' }, 401);
    }
    const authCheck = requireRole(user, 'super_admin');
    if (isErrorResponse(authCheck)) return authCheck;

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return corsResponse({ error: 'Name, email, and password are required' }, 400);
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return corsResponse({ error: 'Email already registered' }, 409);
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'operator',
      },
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

    await db.activityLog.create({
      data: {
        userId: user.userId,
        action: 'user.create',
        details: `Created user: ${newUser.email} with role ${newUser.role}`,
      },
    });

    return corsResponse({ user: newUser }, 201);
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
