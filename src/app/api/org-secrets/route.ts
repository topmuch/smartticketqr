import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant, isErrorResponse, corsResponse, withErrorHandler, handleCors, requireTenantRole } from '@/lib/api-helper';
import { getOrgSecret, rotateOrgSecret } from '@/lib/ticket-generator';

/**
 * GET /api/org-secrets - Get current org HMAC secret status (masked)
 * POST /api/org-secrets/rotate - Rotate HMAC secret (admin only)
 */
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = resolveTenant(request);
    if (isErrorResponse(tenant)) return tenant;

    const secret = await db.orgSecret.findUnique({
      where: { organizationId: tenant.organizationId },
    });

    return corsResponse({
      hasSecret: !!secret,
      rotatedAt: secret?.rotatedAt || null,
      createdAt: secret?.createdAt || null,
      hasPreviousSecret: !!secret?.previousSecret,
    });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const tenant = requireTenantRole(request, 'super_admin', 'admin');
    if (isErrorResponse(tenant)) return tenant;

    const body = await request.json();
    const action = body.action;

    if (action === 'rotate') {
      const newSecret = await rotateOrgSecret(tenant.organizationId);
      return corsResponse({
        message: 'HMAC secret rotated successfully. Old secret kept as backup for 24h.',
        secretMasked: `${newSecret.substring(0, 8)}...${newSecret.substring(newSecret.length - 8)}`,
      });
    }

    if (action === 'ensure') {
      await getOrgSecret(tenant.organizationId);
      return corsResponse({ message: 'HMAC secret ensured for organization' });
    }

    return corsResponse({ error: 'Invalid action. Use "rotate" or "ensure"' }, 400);
  });
}

export async function OPTIONS() { return handleCors(); }
