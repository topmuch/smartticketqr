import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  resolveTenant,
  isErrorResponse,
  corsResponse,
  withErrorHandler,
  handleCors,
  parsePagination,
} from '@/lib/api-helper';

// ============================================================
// GET /api/support-tickets — List support tickets for org
// ============================================================
// Query params:
//   ?page=1&limit=20
//   ?status=open|in_progress|resolved|closed
//   ?priority=low|medium|high|critical
//   ?assignedTo=userId
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

    // Filter by status
    const status = searchParams.get('status');
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      where.status = status;
    }

    // Filter by priority
    const priority = searchParams.get('priority');
    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      where.priority = priority;
    }

    // Filter by assigned user
    const assignedTo = searchParams.get('assignedTo');
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supportTicket.count({ where }),
    ]);

    return corsResponse({
      success: true,
      data: tickets,
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
// POST /api/support-tickets — Create support ticket
// ============================================================
// Body:
//   { subject: string, message: string, priority?: string, userId?: string }
//
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { subject, message, priority, userId } = body;

    // Validate required fields
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return corsResponse({ error: 'Subject is required' }, 400);
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return corsResponse({ error: 'Message is required' }, 400);
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    const parsedPriority = priority && validPriorities.includes(priority)
      ? priority
      : 'medium';

    // Validate userId if provided — must belong to same org
    if (userId) {
      const userExists = await db.user.findFirst({
        where: {
          id: userId,
          organizationId: tenant.organizationId,
        },
      });
      if (!userExists) {
        return corsResponse({ error: 'User not found in this organization' }, 400);
      }
    }

    const ticket = await db.supportTicket.create({
      data: {
        organizationId: tenant.organizationId,
        userId: userId || null,
        subject: subject.trim(),
        message: message.trim(),
        priority: parsedPriority,
        status: 'open',
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'support_ticket.create',
        details: `Created support ticket #${ticket.id}: ${subject.trim()}`,
      },
    });

    return corsResponse({
      success: true,
      data: ticket,
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
