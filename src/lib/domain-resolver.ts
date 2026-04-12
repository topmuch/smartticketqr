// ============================================================
// 🌐 DOMAIN RESOLVER - White-label domain resolution
// ============================================================
// Resolves custom domains to organizations, manages branding,
// validates DNS configuration, and handles SSL status tracking.
// ============================================================

import { db } from '@/lib/db';

// ============================================================
// TYPES
// ============================================================

/** Organization branding configuration */
export interface OrgBranding {
  /** Organization ID */
  id: string;
  /** Organization name */
  name: string;
  /** Organization slug */
  slug: string;
  /** Logo URL */
  logoUrl: string | null;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Custom domain configuration (if any) */
  customDomain: {
    id: string;
    domain: string;
    sslStatus: string;
    isActive: boolean;
    faviconUrl: string | null;
    emailFrom: string | null;
  } | null;
}

/** Branding headers for injecting into responses */
export interface BrandingHeaders {
  'X-Brand-Color': string;
  'X-Brand-Name'?: string;
  'X-Brand-Logo'?: string;
  'X-Brand-Domain'?: string;
  'X-Brand-Slug'?: string;
}

/** DNS validation instructions for custom domain setup */
export interface DnsInstructions {
  /** The domain being configured */
  domain: string;
  /** CNAME record instruction (preferred) */
  cname: {
    host: string;
    value: string;
    ttl: string;
  };
  /** A record instruction (alternative) */
  aRecord: {
    host: string;
    value: string;
    ttl: string;
  };
  /** SSL verification instruction */
  ssl: {
    method: string;
    description: string;
    estimatedTime: string;
  };
  /** Step-by-step setup guide */
  steps: string[];
}

/** Domain claim validation result */
export interface DomainClaimResult {
  /** Whether the domain is available for claiming */
  available: boolean;
  /** Reason if not available */
  reason?: string;
  /** Existing domain record (if claimed) */
  existingDomain?: {
    id: string;
    domain: string;
    organizationId: string;
    organizationName: string;
    sslStatus: string;
  };
}

/** SSL status type */
export type SslStatus = 'pending' | 'provisioning' | 'active' | 'failed' | 'renewing';

// ============================================================
// CONSTANTS
// ============================================================

/** Target hostname that custom domains should CNAME to */
const TARGET_CNAME = 'smartticketqr.app';

/** Target IP address for A record setup */
const TARGET_A_RECORD = '76.76.21.21'; // Placeholder IP (in production, use actual server IP)

/** Default TTL for DNS records */
const DEFAULT_TTL = '3600'; // 1 hour

/** Known platform hostnames that should NOT be resolved as custom domains */
const PLATFORM_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  'smartticketqr.app',
  'www.smartticketqr.app',
  'app.smartticketqr.app',
];

// ============================================================
// DOMAIN RESOLUTION
// ============================================================

/**
 * Resolve an organization from a hostname.
 *
 * Looks up the CustomDomain table to find which organization
 * owns the given hostname. Returns the organization with its
 * custom domain settings if found.
 *
 * @param hostname - The hostname to resolve (e.g., "billetterie.maboite.sn")
 * @returns Organization + CustomDomain or null if not a custom domain
 */
export async function resolveOrganizationFromDomain(hostname: string) {
  // Normalize hostname: remove port, lowercase
  const normalizedHost = hostname.split(':')[0].toLowerCase().trim();

  // Skip platform hostnames — these are handled by the main app
  if (PLATFORM_HOSTNAMES.includes(normalizedHost)) {
    return null;
  }

  // Look up custom domain
  const customDomain = await db.customDomain.findUnique({
    where: { domain: normalizedHost },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          settings: true,
          isActive: true,
        },
      },
    },
  });

  if (!customDomain) {
    return null;
  }

  // Verify domain and organization are both active
  if (!customDomain.isActive || !customDomain.organization.isActive) {
    return null;
  }

  return {
    organization: customDomain.organization,
    customDomain: {
      id: customDomain.id,
      domain: customDomain.domain,
      sslStatus: customDomain.sslStatus,
      isActive: customDomain.isActive,
      faviconUrl: customDomain.faviconUrl,
      emailFrom: customDomain.emailFrom,
    },
  };
}

// ============================================================
// BRANDING
// ============================================================

/**
 * Get organization branding configuration.
 *
 * Returns the organization's visual identity settings including
 * logo, primary color, and custom domain configuration.
 * Used to dynamically brand the frontend based on the resolved domain.
 *
 * @param organizationId - The organization to get branding for
 */
export async function getOrgBranding(organizationId: string): Promise<OrgBranding> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // Get custom domain if configured
  const customDomain = await db.customDomain.findUnique({
    where: { organizationId },
    select: {
      id: true,
      domain: true,
      sslStatus: true,
      isActive: true,
      faviconUrl: true,
      emailFrom: true,
    },
  });

  return {
    ...org,
    customDomain: customDomain ?? null,
  };
}

/**
 * Inject branding headers into a response.
 *
 * Returns a headers object that can be spread into NextResponse headers
 * or used in middleware to brand responses dynamically.
 *
 * Headers:
 * - X-Brand-Color: Primary brand color (hex)
 * - X-Brand-Name: Organization name
 * - X-Brand-Logo: Logo URL
 * - X-Brand-Domain: Custom domain (if set)
 * - X-Brand-Slug: Organization slug
 *
 * @param org - Organization with branding properties
 */
export function injectBrandingHeaders(org: {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  customDomain?: {
    domain: string;
  } | null;
}): BrandingHeaders {
  const headers: BrandingHeaders = {
    'X-Brand-Color': org.primaryColor || '#059669',
  };

  if (org.name) headers['X-Brand-Name'] = org.name;
  if (org.logoUrl) headers['X-Brand-Logo'] = org.logoUrl;
  if (org.customDomain?.domain) headers['X-Brand-Domain'] = org.customDomain.domain;
  if (org.slug) headers['X-Brand-Slug'] = org.slug;

  return headers;
}

// ============================================================
// DOMAIN CLAIM VALIDATION
// ============================================================

/**
 * Validate whether a domain can be claimed by an organization.
 *
 * Checks:
 * 1. Domain format is valid
 * 2. Domain is not a platform hostname
 * 3. Domain is not already claimed by another organization
 *
 * @param domain - The domain to validate
 * @param organizationId - The organization attempting to claim the domain
 */
export async function validateDomainClaim(
  domain: string,
  organizationId: string
): Promise<DomainClaimResult> {
  // Normalize domain
  const normalizedDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Validate domain format
  if (!isValidDomainFormat(normalizedDomain)) {
    return {
      available: false,
      reason: 'Invalid domain format. Use a valid domain like "billetterie.example.com"',
    };
  }

  // Check if it's a platform hostname
  if (PLATFORM_HOSTNAMES.includes(normalizedDomain)) {
    return {
      available: false,
      reason: 'Cannot claim platform hostnames',
    };
  }

  // Check if domain is already claimed
  const existingDomain = await db.customDomain.findUnique({
    where: { domain: normalizedDomain },
    include: {
      organization: {
        select: { name: true },
      },
    },
  });

  if (existingDomain) {
    // If claimed by the same org, it's available for update
    if (existingDomain.organizationId === organizationId) {
      return { available: true };
    }

    return {
      available: false,
      reason: 'Domain is already claimed by another organization',
      existingDomain: {
        id: existingDomain.id,
        domain: existingDomain.domain,
        organizationId: existingDomain.organizationId,
        organizationName: existingDomain.organization.name,
        sslStatus: existingDomain.sslStatus,
      },
    };
  }

  // Check if the organization already has a custom domain
  const existingOrgDomain = await db.customDomain.findUnique({
    where: { organizationId },
  });

  if (existingOrgDomain) {
    // Organization can update their existing domain
    return { available: true };
  }

  return { available: true };
}

/**
 * Basic domain format validation.
 */
function isValidDomainFormat(domain: string): boolean {
  // Simple regex for domain validation
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
  return domainRegex.test(domain);
}

// ============================================================
// DNS INSTRUCTIONS
// ============================================================

/**
 * Get DNS configuration instructions for setting up a custom domain.
 *
 * Provides CNAME and A record instructions, SSL setup guidance,
 * and a step-by-step walkthrough for the domain owner.
 *
 * @param domain - The custom domain to configure
 */
export function getDnsInstructions(domain: string): DnsInstructions {
  const normalizedDomain = domain.toLowerCase().trim();

  return {
    domain: normalizedDomain,
    cname: {
      host: normalizedDomain,
      value: TARGET_CNAME,
      ttl: DEFAULT_TTL,
    },
    aRecord: {
      host: normalizedDomain,
      value: TARGET_A_RECORD,
      ttl: DEFAULT_TTL,
    },
    ssl: {
      method: 'Automatic (Let\'s Encrypt)',
      description:
        'SSL certificates are automatically provisioned via Let\'s Encrypt once DNS records are properly configured and verified. No manual certificate management required.',
      estimatedTime: '5-15 minutes after DNS propagation',
    },
    steps: [
      `1. Log in to your domain registrar (e.g., GoDaddy, Namecheap, OVH)`,
      `2. Navigate to DNS management for "${normalizedDomain}"`,
      `3. Add a CNAME record:`,
      `   - Host/Name: ${normalizedDomain}`,
      `   - Value/Target: ${TARGET_CNAME}`,
      `   - TTL: ${DEFAULT_TTL} (or "Auto")`,
      `4. Alternatively, add an A record:`,
      `   - Host/Name: ${normalizedDomain}`,
      `   - Value/Target: ${TARGET_A_RECORD}`,
      `   - TTL: ${DEFAULT_TTL} (or "Auto")`,
      `5. Wait for DNS propagation (up to 48 hours, typically 5-30 minutes)`,
      `6. SSL certificate will be automatically provisioned once DNS is verified`,
      `7. Your white-label domain will be active once SSL status is "active"`,
    ],
  };
}

// ============================================================
// SSL STATUS MANAGEMENT
// ============================================================

/**
 * Update the SSL status of a custom domain.
 *
 * Status transitions:
 * - pending → provisioning → active
 * - provisioning → failed (on error)
 * - active → renewing → active (on renewal)
 * - failed → pending (on retry)
 *
 * @param domainId - The CustomDomain record ID
 * @param status - New SSL status
 */
export async function updateSslStatus(domainId: string, status: SslStatus) {
  const validStatuses: SslStatus[] = ['pending', 'provisioning', 'active', 'failed', 'renewing'];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid SSL status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return db.customDomain.update({
    where: { id: domainId },
    data: { sslStatus: status },
  });
}

/**
 * Get all custom domains with their SSL status for monitoring.
 *
 * Useful for admin dashboards and automated SSL health checks.
 */
export async function getDomainSslStatuses() {
  const domains = await db.customDomain.findMany({
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    total: domains.length,
    active: domains.filter((d) => d.sslStatus === 'active').length,
    pending: domains.filter((d) => d.sslStatus === 'pending' || d.sslStatus === 'provisioning').length,
    failed: domains.filter((d) => d.sslStatus === 'failed').length,
    domains,
  };
}

// ============================================================
// CUSTOM DOMAIN MANAGEMENT
// ============================================================

/**
 * Register a new custom domain for an organization.
 *
 * @param organizationId - The organization claiming the domain
 * @param domain - The custom domain to register
 * @param options - Optional additional settings
 */
export async function registerCustomDomain(
  organizationId: string,
  domain: string,
  options: {
    faviconUrl?: string;
    emailFrom?: string;
  } = {}
) {
  // Validate domain claim
  const validation = await validateDomainClaim(domain, organizationId);
  if (!validation.available) {
    throw new Error(validation.reason || 'Domain is not available');
  }

  const normalizedDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Check if organization already has a custom domain
  const existing = await db.customDomain.findUnique({
    where: { organizationId },
  });

  if (existing) {
    // Update existing domain
    return db.customDomain.update({
      where: { id: existing.id },
      data: {
        domain: normalizedDomain,
        sslStatus: 'pending', // Reset SSL status for new domain
        faviconUrl: options.faviconUrl ?? existing.faviconUrl,
        emailFrom: options.emailFrom ?? existing.emailFrom,
        isActive: true,
      },
    });
  }

  // Create new custom domain
  return db.customDomain.create({
    data: {
      organizationId,
      domain: normalizedDomain,
      sslStatus: 'pending',
      faviconUrl: options.faviconUrl ?? null,
      emailFrom: options.emailFrom ?? null,
      isActive: true,
    },
  });
}

/**
 * Remove a custom domain configuration.
 *
 * @param organizationId - The organization removing their custom domain
 */
export async function removeCustomDomain(organizationId: string) {
  const existing = await db.customDomain.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    throw new Error('No custom domain configured for this organization');
  }

  await db.customDomain.delete({
    where: { id: existing.id },
  });

  return { success: true, removed: existing.domain };
}

/**
 * Update custom domain settings (favicon, email from, active status).
 *
 * @param organizationId - The organization to update
 * @param updates - Settings to update
 */
export async function updateCustomDomainSettings(
  organizationId: string,
  updates: {
    faviconUrl?: string | null;
    emailFrom?: string | null;
    isActive?: boolean;
  }
) {
  const existing = await db.customDomain.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    throw new Error('No custom domain configured for this organization');
  }

  return db.customDomain.update({
    where: { id: existing.id },
    data: updates,
  });
}

/**
 * Get all custom domains for listing/management purposes.
 *
 * @param page - Page number (default 1)
 * @param limit - Results per page (default 20)
 * @param sslStatus - Optional filter by SSL status
 */
export async function listCustomDomains(
  page = 1,
  limit = 20,
  sslStatus?: string
) {
  const where: Record<string, unknown> = {};
  if (sslStatus) where.sslStatus = sslStatus;

  const [domains, total] = await Promise.all([
    db.customDomain.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.customDomain.count({ where }),
  ]);

  return {
    domains,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
