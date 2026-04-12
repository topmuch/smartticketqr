import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, parsePagination, requireTenantRole, tenantWhereWith } from '@/lib/api-helper';
import { checkLimit } from '@/lib/subscription-manager';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const where = tenantWhereWith(tenant.organizationId, {});

    if (role) (where as Record<string, unknown>).role = role;
    if (search) {
      (where as Record<string, unknown>).OR = [
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
          organizationId: true,
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
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const roleCheck = requireTenantRole(request, 'super_admin');
    if (isErrorResponse(roleCheck)) return roleCheck;

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return corsResponse({ error: 'Name, email, and password are required' }, 400);
    }

    // Check subscription limit for users
    const limitCheck = await checkLimit(tenant.organizationId, 'users');
    if (!limitCheck.allowed) {
      return corsResponse({ error: limitCheck.reason, limit: limitCheck, needsUpgrade: true }, 403);
    }

    // Check if user already exists in THIS organization
    const existingUser = await db.user.findFirst({
      where: { email, organizationId: tenant.organizationId },
    });
    if (existingUser) {
      return corsResponse({ error: 'Email already registered in this organization' }, 409);
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'operator',
        organizationId: tenant.organizationId,
      },
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
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'user.create',
        details: `Created user: ${newUser.email} with role ${newUser.role}`,
      },
    });

    return corsResponse({ user: newUser }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
