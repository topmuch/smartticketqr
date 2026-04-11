import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { corsResponse, withErrorHandler } from '@/lib/api-helper';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return corsResponse({ error: 'Email and password are required' }, 400);
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
    }

    if (!user.isActive) {
      return corsResponse({ error: 'Account has been deactivated' }, 403);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return corsResponse({ error: 'Invalid credentials' }, 401);
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'user.login',
        details: `User logged in: ${user.email}`,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return corsResponse({ user: userWithoutPassword, token });
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
