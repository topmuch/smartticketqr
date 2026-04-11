import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken, generateTicketCode } from '@/lib/auth';
import { corsResponse, withErrorHandler } from '@/lib/api-helper';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return corsResponse({ error: 'Name, email, and password are required' }, 400);
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return corsResponse({ error: 'Email already registered' }, 409);
    }

    // Check if this is the first user → super_admin
    const userCount = await db.user.count();
    const userRole = role || (userCount === 0 ? 'super_admin' : 'operator');

    const hashedPassword = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'user.register',
        details: `New user registered: ${user.email} with role ${userRole}`,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return corsResponse({ user: userWithoutPassword, token }, 201);
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
