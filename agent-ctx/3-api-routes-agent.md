# Task ID: 3 — API Routes Agent

## Summary
Created all 15 Phase 6 API route files for SmartTicketQR.

## Files Created

### Custom Domains (2 files)
- `/src/app/api/custom-domains/route.ts` — GET (list), POST (create with domain format validation + uniqueness check)
- `/src/app/api/custom-domains/[id]/route.ts` — GET, PUT (sslStatus/favicon/email/isActive), DELETE

### Automation Rules (2 files)
- `/src/app/api/automation-rules/route.ts` — GET (list with trigger/channel/isActive filters), POST (create with duplicate prevention)
- `/src/app/api/automation-rules/[id]/route.ts` — GET, PUT, DELETE

### Automation Logs (1 file)
- `/src/app/api/automation-logs/route.ts` — GET (list with status/channel/ruleId/date-range filters)

### Support Tickets (2 files)
- `/src/app/api/support-tickets/route.ts` — GET (list with status/priority/assignedTo filters), POST
- `/src/app/api/support-tickets/[id]/route.ts` — GET, PUT (auto-resolvedAt), DELETE (soft-close)

### Affiliates (3 files)
- `/src/app/api/affiliates/route.ts` — GET (list), POST (auto-generate referral code)
- `/src/app/api/affiliates/[id]/route.ts` — GET, PUT (commissionRate/isActive), DELETE (soft-deactivate)
- `/src/app/api/affiliates/stats/route.ts` — GET (aggregate stats + top performers)

### Fraud Alerts (3 files)
- `/src/app/api/fraud-alerts/route.ts` — GET (list with status/severity/ruleType filters), POST
- `/src/app/api/fraud-alerts/[id]/route.ts` — GET, PUT (auto-reviewedAt), no DELETE
- `/src/app/api/fraud-alerts/stats/route.ts` — GET (counts by type/severity/time period)

### i18n (2 files)
- `/src/app/api/i18n/route.ts` — GET (all translations for a language, French fallback)
- `/src/app/api/i18n/[key]/route.ts` — GET (single translation), PUT (upsert, admin-only)

## Patterns Used
- `resolveTenant()` + `isErrorResponse()` for tenant isolation on every route
- `requireTenantRole()` for admin-only mutations
- `withErrorHandler()` wrapper for consistent error handling
- `handleCors()` / `corsResponse()` for CORS support
- `parsePagination()` for paginated list endpoints
- Activity logging on all mutation operations
- Prisma `findFirst` with `organizationId` for IDOR protection
