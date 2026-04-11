// ============================================================
// 📋 PUBLIC API v1 — Events (List)
// ============================================================
// GET: List events filtered by the API key's organization.
// Query params: ?status, ?type, ?page, ?limit, ?search
// Requires X-API-Key header.
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveApiKey,
  isApiKeyError,
  extractRateLimitHeaders,
  publicHandleCors,
} from '@/lib/api-key-auth';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate via API key
    const context = await resolveApiKey(request);
    if (isApiKeyError(context)) return context;

    const { organizationId } = context;
    const rateHeaders = extractRateLimitHeaders(context);

    // Step 2: Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    // Step 3: Build WHERE clause with tenant isolation
    const where: Record<string, unknown> = {
      organizationId,
    };

    if (status) where.status = status;
    if (type) where.type = type;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }

    // Step 4: Fetch events with pagination
    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          location: true,
          latitude: true,
          longitude: true,
          startDate: true,
          endDate: true,
          totalTickets: true,
          soldTickets: true,
          price: true,
          currency: true,
          status: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.event.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Step 5: Return response
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          events,
          meta: {
            page,
            limit,
            total,
            totalPages,
          },
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...rateHeaders,
        },
      }
    );
  } catch (error) {
    console.error('[Public API v1 Events Error]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function OPTIONS() {
  return publicHandleCors();
}
