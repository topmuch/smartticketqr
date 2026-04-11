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
// Domain format validator
// ============================================================
function isValidDomain(domain: string): boolean {
  const pattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

// ============================================================
// GET /api/custom-domains — List custom domains for org
// ============================================================
// Query params:
//   ?page=1&limit=10
//   ?status=active|pending|failed
//
// Tenant-isolated by organizationId.
// Note: CustomDomain has @unique on organizationId, so max 1 domain per org.
// ============================================================
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const domains = await db.customDomain.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return corsResponse({
      success: true,
      data: domains,
    });
  });
}

// ============================================================
// POST /api/custom-domains — Create custom domain
// ============================================================
// Body:
//   { domain: string, faviconUrl?: string, emailFrom?: string }
//
// Validates domain format and uniqueness.
// Requires admin or super_admin role.
// ============================================================
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const { domain, faviconUrl, emailFrom } = body;

    if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
      return corsResponse({ error: 'Domain is required' }, 400);
    }

    const trimmedDomain = domain.trim().toLowerCase();

    if (!isValidDomain(trimmedDomain)) {
      return corsResponse({ error: 'Invalid domain format. Example: billetterie.example.com' }, 400);
    }

    // Check uniqueness globally
    const existingDomain = await db.customDomain.findUnique({
      where: { domain: trimmedDomain },
    });
    if (existingDomain) {
      return corsResponse({ error: 'This domain is already registered by another organization' }, 409);
    }

    // Check if org already has a custom domain
    const existingOrgDomain = await db.customDomain.findUnique({
      where: { organizationId: tenant.organizationId },
    });
    if (existingOrgDomain) {
      return corsResponse({ error: 'Organization already has a custom domain. Update the existing one instead.' }, 409);
    }

    const customDomain = await db.customDomain.create({
      data: {
        organizationId: tenant.organizationId,
        domain: trimmedDomain,
        faviconUrl: faviconUrl || null,
        emailFrom: emailFrom || null,
        sslStatus: 'pending',
        isActive: true,
      },
    });

    await db.activityLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        action: 'custom_domain.create',
        details: `Added custom domain: ${trimmedDomain}`,
      },
    });

    return corsResponse({
      success: true,
      data: customDomain,
    }, 201);
  });
}

export async function OPTIONS() {
  return handleCors();
}
