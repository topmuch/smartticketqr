# 🚀 SmartTicketQR — Scaling, Ecosystem & Growth Guide

> Phase 6 Production Readiness — White-Label, Automation, i18n, Fraud, Support, Affiliates

---

## 📋 Table of Contents

1. [White-Label & Custom Domains](#1-white-label--custom-domains)
2. [SSL Auto-Provisioning](#2-ssl-auto-provisioning)
3. [DNS Configuration](#3-dns-configuration)
4. [Internationalization (i18n)](#4-internationalization-i18n)
5. [Automation & Fallback Channels](#5-automation--fallback-channels)
6. [Fraud Detection Rules](#6-fraud-detection-rules)
7. [Support Portal & SLA](#7-support-portal--sla)
8. [Affiliate System](#8-affiliate-system)
9. [Monitoring & Cron Jobs](#9-monitoring--cron-jobs)
10. [AI/ML Roadmap](#10-aiml-roadmap)
11. [Pre-Launch Checklist v6](#11-pre-launch-checklist-v6)

---

## 1. White-Label & Custom Domains

### How It Works

Each organization can map a custom domain (e.g., `billetterie.maboite.sn`) to their SmartTicketQR instance. The system:

1. **Resolves the domain** → identifies the organization via `CustomDomain` table
2. **Injects branding** → logo, primary color, favicon, sender email
3. **Applies CSS variables** → `--org-primary`, `--brand-color` for dynamic theming

### Architecture

```
User Request → Host Header → Domain Resolver → Organization Lookup → Branding Injection
                                       ↓
                              custom_domains table
                                       ↓
                        organization settings (logo, colors)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/domain-resolver.ts` | Domain resolution, DNS validation, SSL management |
| `src/app/api/custom-domains/route.ts` | CRUD API for custom domains |
| `src/app/api/custom-domains/[id]/route.ts` | Single domain operations |
| `src/components/smart-ticket/custom-domains-page.tsx` | Admin UI for domain management |

### Setup Flow

1. Admin adds custom domain in **Settings → Custom Domains**
2. System validates domain format and availability
3. DNS instructions displayed (CNAME / A record)
4. DNS propagation: 5 min – 48 hours
5. SSL auto-provisioned via Let's Encrypt
6. Domain marked as `active` when SSL verified

---

## 2. SSL Auto-Provisioning

### Status Lifecycle

```
pending → provisioning → active
                        → failed → pending (retry)
active → renewing → active
```

### Implementation

SSL is managed via **Caddy** reverse proxy (in production Docker setup):

```yaml
# docker-compose.yml
caddy:
  image: caddy:2-alpine
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data    # Stores auto-generated certs
```

Caddy automatically obtains and renews Let's Encrypt certificates. No manual SSL management needed.

### Environment Variables

```bash
LETSENCRYPT_EMAIL=admin@smartticketqr.app  # Required for cert notifications
```

---

## 3. DNS Configuration

### Step-by-Step for Domain Owners

1. **Log in** to domain registrar (GoDaddy, Namecheap, OVH, etc.)
2. **Navigate** to DNS management for the custom domain
3. **Add CNAME record**:
   - Host: `billetterie.maboite.sn`
   - Value: `smartticketqr.app`
   - TTL: 3600
4. **Alternative A record**:
   - Host: `billetterie.maboite.sn`
   - Value: `76.76.21.21` (production server IP)
   - TTL: 3600
5. **Wait** for DNS propagation (typically 5-30 min, up to 48 hours)
6. **Verify** — SSL certificate auto-provisioned once DNS resolves

### Verification

```bash
# Check DNS resolution
dig billetterie.maboite.sn CNAME +short

# Check SSL certificate
curl -vI https://billetterie.maboite.sn 2>&1 | grep "subject:"
```

---

## 4. Internationalization (i18n)

### Architecture

```
Client Side:                         Server Side:
useTranslation() hook                t() function
       ↓                                    ↓
I18nProvider (React Context)          translations[locale][key]
       ↓                                    ↓
localStorage: smartticket-lang       DB: translations table
       ↓                                    ↓
Fallback: fr → en → key              Fallback: fr → en → key
```

### Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `fr` | French | ✅ Complete (200+ keys) |
| `en` | English | ✅ Complete (200+ keys) |
| `wo` | Wolof | 📋 Planned |
| `ar` | Arabic | 📋 Planned |

### Key Conventions

- **Keys**: Dot-notation (`dashboard.stats.revenue`, `nav.events`)
- **No hardcoded text** in any view component
- **Parameters**: `{name}`, `{count}`, `{date}` for interpolation
- **Auto-detection**: `navigator.language` → French preferred for SN/CM/CI/ML

### Adding a New Language

1. Add translations to `src/lib/i18n/translations.ts`
2. Add locale to `AVAILABLE_LOCALES` array
3. Add `LOCALE_NAMES` entry
4. Language switcher auto-includes new locale

### DB-based Translations (Admin)

Admins can override translations via `/api/i18n/[key]`:
- `PUT /api/i18n/dashboard.title` with body `{ text: "Tableau de bord", langCode: "fr" }`
- DB translations override file-based translations at runtime

---

## 5. Automation & Fallback Channels

### Channel Priority

```
Primary: WhatsApp → Fallback: SMS → Final Fallback: Email
```

### Trigger Events

| Event | Description | Default Channel |
|-------|-------------|-----------------|
| `ticket_created` | New ticket issued | WhatsApp |
| `ticket_reminder` | 24h before event | SMS |
| `ticket_validated` | Ticket scanned at entry | WhatsApp |
| `scan_failed` | Validation failed | Email |

### Retry Logic

| Attempt | Delay | Action |
|---------|-------|--------|
| 1 | Immediate | Try primary channel |
| 2 | 1 minute | Try fallback channel |
| 3 | 5 minutes | Try fallback channel |
| 4 | 15 minutes | Try fallback channel |
| 5+ | — | Mark as permanently failed |

### Configuration

Per-organization settings in `Organization.settings` JSON:

```json
{
  "whatsapp_access_token": "[WA_TOKEN]",
  "whatsapp_phone_number_id": "[WA_PHONE_ID]",
  "sms_api_key": "[SMS_API_KEY]",
  "smtp_host": "[SMTP_HOST]",
  "smtp_port": 587,
  "smtp_user": "[SMTP_USER]",
  "smtp_pass": "[SMTP_PASS]"
}
```

### Idempotency

- Duplicate detection window: 5 minutes
- Same `organizationId` + `triggerEvent` + `recipient` = skip
- Prevents double-sending on webhook retries

---

## 6. Fraud Detection Rules

### Rule Engine

| Rule | Description | Default Threshold |
|------|-------------|-------------------|
| `multi_scan_rapid` | Same ticket scanned N times in M minutes | 3 scans / 5 min |
| `geo_inconsistent` | Scan location > N km from event venue | 50 km |
| `suspicious_ip` | Same IP performing N scans in M minutes | 20 scans / 1 min |
| `device_mismatch` | Ticket scanned from N+ different device types in 5 min | 3 devices |

### Severity Levels

| Severity | Trigger Condition |
|----------|-------------------|
| `low` | Minimal threshold breach |
| `medium` | Moderate (default) |
| `high` | 5+ scans, 200+ km, 50+ scans/min |
| `critical` | 10+ scans, 500+ km, 100+ scans/min |

### ⚠️ IMPORTANT: No Auto-Blocking

Fraud alerts are **NEVER automatically blocked**. The system:
1. **Flags** the activity → creates `FraudAlert` record (status: `flagged`)
2. **Alerts** admins via dashboard notifications
3. **Requires manual review** → admin sets status to `reviewed`, `dismissed`, or `blocked`

This ensures GDPR compliance and prevents false-positive lockouts.

### Configuring Thresholds

Per-organization in `Organization.settings`:

```json
{
  "fraud_detection": {
    "multi_scan_max_count": 3,
    "multi_scan_window_ms": 300000,
    "geo_max_distance_km": 50,
    "ip_max_scans_per_minute": 20,
    "ip_scan_window_ms": 60000,
    "multi_scan_enabled": true,
    "geo_enabled": true,
    "ip_enabled": true,
    "device_enabled": true
  }
}
```

---

## 7. Support Portal & SLA

### Ticket Lifecycle

```
open → in_progress → resolved → closed
                     ↑           ↓
                     └───────────┘ (reopen)
```

### Priority Levels

| Priority | Response SLA | Color |
|----------|-------------|-------|
| `low` | 72 hours | Slate |
| `medium` | 24 hours | Amber |
| `high` | 4 hours | Orange |
| `critical` | 1 hour | Red |

### SLA Tracking

- SLA timer starts at ticket creation
- Breach warning shown when time exceeds SLA threshold
- SLA = `resolvedAt - createdAt`

### Webhook Integration

Support events can trigger webhooks for external tools:

```json
{
  "event": "support_ticket.created",
  "data": {
    "ticketId": "abc123",
    "subject": "Cannot scan QR code",
    "priority": "high"
  }
}
```

Integrations: Zendesk, Freshdesk, Slack, Microsoft Teams (via webhook endpoints).

---

## 8. Affiliate System

### How It Works

1. **Affiliate enrolled** → unique referral code generated (e.g., `ABCD1234`)
2. **Shared link** → `https://app.smartticketqr.app/?ref=ABCD1234`
3. **Cookie stored** → 30-day expiry, `HttpOnly`, `SameSite=Lax`
4. **Ticket purchased** → referral conversion tracked
5. **Commission calculated** → only on tickets with status `used` (anti-refund fraud)
6. **Payout processed** → admin approves, transaction recorded

### Commission Formula

```
commission = eligible_revenue × commission_rate / 100

eligible_revenue = SUM(price) WHERE ticket.status = 'used' AND referral_code = code
```

### Referral Code Format

- 7 alphanumeric characters (no ambiguous chars: 0/O, 1/I/l)
- Characters: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Example: `X7K9M2P`, `QR8TNW3`

### Tracking

```typescript
// Server-side cookie reading
const referralCode = getReferralCookie(); // → "X7K9M2P"

// Track conversion after ticket purchase
await trackReferral("X7K9M2P", ticketId, ticketPrice);
```

### Anti-Fraud Measures

- Commission only on `status = 'used'` tickets
- Referral cookie max 30 days
- Code uniqueness enforced (global unique constraint)
- Payout amount cannot exceed pending commission balance

---

## 9. Monitoring & Cron Jobs

### Cron Jobs

| Job | Schedule | Script/Endpoint |
|-----|----------|-----------------|
| Webhook queue processor | Every 5 min | `POST /api/webhooks/process` |
| Automation queue processor | Every 5 min | `POST /api/automation/process` (planned) |
| DB backup | Daily 02:00 | `scripts/backup-db.sh` |
| SSL health check | Every hour | Monitor `custom_domains.ssl_status` |
| Stats cache refresh | Every 15 min | `POST /api/stats/refresh` |

### Structured Logging

All logs use structured JSON format:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "service": "smartticketqr",
  "module": "fraud-detector",
  "organizationId": "org_abc123",
  "message": "Fraud rule triggered",
  "ruleType": "multi_scan_rapid",
  "ticketId": "tkt_xyz789",
  "severity": "high"
}
```

### Health Checks

```bash
# Application health
GET /api/v1/health → { status: "ok", version: "6.0.0", uptime: 86400 }

# Database connectivity
GET /api/health/db → { status: "ok", dbSize: "45MB" }

# Cron status
GET /api/health/cron → { lastRun: "2025-01-15T10:25:00Z", nextRun: "2025-01-15T10:30:00Z" }
```

---

## 10. AI/ML Roadmap

### Phase 7 — AI-Powered Features (Planned)

| Feature | Description | Technology |
|---------|-------------|-----------|
| **Dynamic Pricing** | Auto-adjust ticket prices based on demand, time, capacity | Time-series ML model |
| **Support Chatbot** | Automated ticket triage and resolution | LLM + RAG |
| **Attendance Prediction** | Predict event attendance for capacity planning | Regression model |
| **Anomaly Detection** | ML-based fraud detection beyond rule-based system | Isolation Forest / Autoencoder |
| **Smart Reminders** | Optimal send time for reminders based on user behavior | Bayesian optimization |
| **Image Recognition** | Verify ticket QR images for counterfeiting | CNN model |

### Hook Points (Prepared)

The codebase includes placeholder hooks for AI integration:

```typescript
// src/lib/fraud-detector.ts — ready for ML model injection
// src/lib/automation-dispatcher.ts — ready for smart scheduling
// src/lib/affiliate-tracker.ts — ready for conversion prediction
```

---

## 11. Pre-Launch Checklist v6

### White-Label & Domains
- [ ] Test custom domain creation (admin UI)
- [ ] Verify DNS instruction display
- [ ] Test domain resolution with test subdomain
- [ ] Verify SSL auto-provisioning
- [ ] Test branding injection (logo, colors)
- [ ] Test favicon custom upload

### i18n
- [ ] Test language auto-detection (FR browser)
- [ ] Test manual language switch (FR ↔ EN)
- [ ] Verify all pages display translated text
- [ ] Test DB-based translation override
- [ ] Verify fallback to FR for missing keys

### Automation
- [ ] Create automation rule (ticket_created → WhatsApp)
- [ ] Test fallback: disable WhatsApp → verify SMS fallback
- [ ] Test delay: set 5-minute delay → verify timing
- [ ] Check automation logs display
- [ ] Verify idempotency (no duplicate sends)

### Fraud Detection
- [ ] Simulate multi-scan: scan same ticket 5x in 1 minute
- [ ] Verify fraud alert created with correct severity
- [ ] Test review action (mark as dismissed)
- [ ] Test block action (mark as blocked)
- [ ] Verify fraud stats dashboard
- [ ] Test threshold configuration in org settings

### Support Portal
- [ ] Create support ticket as regular user
- [ ] Test status transition (open → in_progress → resolved → closed)
- [ ] Verify SLA breach warning (>24h open ticket)
- [ ] Test priority badges display correctly
- [ ] Verify ticket assignment to admin

### Affiliates
- [ ] Create affiliate (select user, auto-generate code)
- [ ] Test referral link generation (?ref=CODE)
- [ ] Simulate referral conversion (trackReferral)
- [ ] Verify commission calculation (only on 'used' tickets)
- [ ] Test affiliate dashboard stats
- [ ] Test commission payout flow

### General
- [ ] All 22 pages load without errors
- [ ] Mobile responsive on all new pages
- [ ] Dark mode works on all new pages
- [ ] ESLint passes: 0 errors
- [ ] Dev server compiles cleanly
- [ ] API routes return correct data with tenant isolation

---

*SmartTicketQR v6.0 — Phase 6 Complete*
*Stack: Next.js 16 + TypeScript + Tailwind CSS 4 + Prisma + SQLite*
