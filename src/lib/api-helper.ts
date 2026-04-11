import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JWTPayload } from '@/lib/auth';

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function corsResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders,
  });
}

export function handleCors(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Auth helper
export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return verifyToken(token);
}

export function requireAuth(request: NextRequest): JWTPayload | NextResponse {
  const user = getUserFromRequest(request);
  if (!user) {
    return corsResponse({ error: 'Authentication required' }, 401) as unknown as NextResponse;
  }
  return user as unknown as NextResponse;
}

export function requireRole(user: JWTPayload | null, ...roles: string[]): JWTPayload | NextResponse {
  if (!user) {
    return corsResponse({ error: 'Authentication required' }, 401) as unknown as NextResponse;
  }
  if (!roles.includes(user.role)) {
    return corsResponse({ error: 'Insufficient permissions' }, 403) as unknown as NextResponse;
  }
  return user as unknown as NextResponse;
}

// Pagination helper
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePagination(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  return { page, limit };
}

// Date range helper
export function parseDateRange(searchParams: URLSearchParams): { startDate?: Date; endDate?: Date } {
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  return {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  };
}

// Error handler wrapper
export async function withErrorHandler(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return corsResponse({ error: message }, 500);
  }
}

// Check if result is a NextResponse (error) or actual data
export function isErrorResponse(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}
