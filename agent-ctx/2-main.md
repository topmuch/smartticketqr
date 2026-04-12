# Task ID: 2 - Phase 5 Backend Library Files

## Agent: Main

## Status: Completed

## Summary
Created/updated 3 backend library files for Phase 5:

1. **src/lib/api-key-auth.ts** — API key authentication system
   - `generateApiKey(prefix, organizationId, name, options?)` — generates raw key like `stq_live_<32hex>`, stores SHA-256 hash + first 8 char prefix
   - `hashApiKey(rawKey)` — SHA-256 hash via Node.js `crypto.createHash`
   - `validateApiKey(rawKey)` — looks up by hash, checks isActive/expiresAt/org active, updates lastUsedAt
   - `checkApiKeyRateLimit(apiKeyId, rateLimit)` — in-memory per-hour sliding window (Map-based, reuses rate-limiter.ts pattern)
   - `revokeApiKey(id)` — sets isActive = false, clears rate limit cache
   - `rotateApiKey(id)` — creates new key, deactivates old, returns new raw key (one-time display)
   - Preserved existing resolveApiKey(), public CORS helpers from previous Task 3-a

2. **src/lib/webhook-dispatcher.ts** — Outbound webhook system
   - `dispatchWebhook(organizationId, eventType, payload)` — queues webhook for matching endpoints
   - `processWebhookQueue()` — processes pending logs in batches of 100 (for cron)
   - Headers: X-Signature (sha256=), X-Webhook-Id, X-Event-Type, Content-Type: application/json
   - 10s timeout, exponential backoff (1min, 5min, 30min), max 3 attempts before permanent failure
   - `getRetrySchedule(attempt)` — returns delay in ms
   - `generateSignature(payload, secret)` — HMAC-SHA256 hex

3. **src/middleware.ts** — Next.js security headers
   - CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, X-XSS-Protection, Permissions-Policy
   - Matcher: `/((?!api/).*)` and `/api/v1/:path*`

## Verification
- ESLint: 0 errors
- Dev server compiles successfully
- Worklog updated at /home/z/my-project/worklog.md
