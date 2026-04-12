# SmartTicketQR — Deployment & Security Guide

> **Version:** 5.0.0
> **Last Updated:** June 2025
> **Stack:** Next.js 16 · Bun · Prisma · SQLite · Caddy
> **Target Market:** African SaaS — Multi-Tenant Ticket Management

---

## Table of Contents

1. [Production Setup](#1-production-setup)
   - [1.1 Prerequisites](#11-prerequisites)
   - [1.2 Environment Variables](#12-environment-variables)
   - [1.3 Docker Deployment](#13-docker-deployment)
   - [1.4 Manual Deployment](#14-manual-deployment)
   - [1.5 Database Initialization](#15-database-initialization)
   - [1.6 SSL/TLS with Caddy](#16-ssltls-with-caddy)
2. [Security Headers](#2-security-headers)
   - [2.1 Implemented Headers](#21-implemented-headers)
   - [2.2 Verification](#22-verification)
   - [2.3 Header Reference Table](#23-header-reference-table)
3. [API Key Security](#3-api-key-security)
   - [3.1 Storage Architecture](#31-storage-architecture)
   - [3.2 Key Format](#32-key-format)
   - [3.3 Key Rotation Procedure](#33-key-rotation-procedure)
   - [3.4 Rate Limiting](#34-rate-limiting)
   - [3.5 Best Practices](#35-best-practices)
4. [Webhook System](#4-webhook-system)
   - [4.1 Signature Verification](#41-signature-verification)
   - [4.2 Event Types](#42-event-types)
   - [4.3 Retry Schedule](#43-retry-schedule)
   - [4.4 Queue Processing Cron](#44-queue-processing-cron)
   - [4.5 Verification Code Examples](#45-verification-code-examples)
5. [Backup & Recovery](#5-backup--recovery)
   - [5.1 Backup Strategy](#51-backup-strategy)
   - [5.2 Backup Rotation Policy](#52-backup-rotation-policy)
   - [5.3 Backup Script](#53-backup-script)
   - [5.4 Off-Site Storage](#54-off-site-storage)
   - [5.5 Restore Procedure](#55-restore-procedure)
6. [Monitoring](#6-monitoring)
   - [6.1 Health Check Endpoint](#61-health-check-endpoint)
   - [6.2 Monitor Script](#62-monitor-script)
   - [6.3 Log Monitoring](#63-log-monitoring)
   - [6.4 Webhook Delivery Monitoring](#64-webhook-delivery-monitoring)
   - [6.5 Database Size Monitoring](#65-database-size-monitoring)
   - [6.6 Alerting](#66-alerting)
7. [Pre-Launch Checklist](#7-pre-launch-checklist)
   - [7.1 Security](#71-security)
   - [7.2 Functionality](#72-functionality)
   - [7.3 Infrastructure](#73-infrastructure)

---

## 1. Production Setup

### 1.1 Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| CPU Cores | 2 | 4 |
| RAM | 2 GB | 4 GB |
| Disk Space | 20 GB | 50 GB SSD |
| Docker Engine | 20.10+ | 24.0+ |
| Docker Compose | v2+ | v2.20+ |
| OS | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 LTS |
| Domain | 1 domain with DNS A record | Domain + CDN (Cloudflare) |
| SQLite | System package | `sqlite3` CLI for backups |

### 1.2 Environment Variables

Create a `.env` file in the project root. All variables must be set before deploying.

#### Core Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | *(insecure fallback)* | Cryptographic key for JWT token signing and verification. Must be 32+ characters of high-entropy randomness. Used by `src/lib/auth.ts` to sign session tokens with a 7-day expiry. |
| `DATABASE_URL` | **Yes** | `file:./db/custom.db` | SQLite database connection string. In Docker, use `file:/app/data/custom.db`. On bare metal, use `file:./db/custom.db`. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | Public-facing URL of the application. Used for QR code links, webhook callbacks, and CORS origin validation. Must include protocol (`https://` in production). |

#### Webhook Processing

| Variable | Required | Default | Description |
|---|---|---|---|
| `WEBHOOK_PROCESS_SECRET` | **Recommended** | *(none — open access)* | Shared secret for authenticating webhook queue processing calls to `POST /api/webhooks/process`. When set, the `X-Process-Secret` header must match. **Critical in production** to prevent unauthorized queue flushes. |

#### Webhook Sender Service

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_URL` | **Recommended** | `http://localhost:3000` | Internal URL the webhook sender uses to reach the main app. In Docker Compose, use `http://app:3000`. On bare metal with the webhook sender mini-service, use `http://localhost:3000`. |
| `POLL_INTERVAL_MS` | No | `60000` | How often (in milliseconds) the webhook sender polls `POST /api/webhooks/process`. Default is every 60 seconds. |

#### Optional

| Variable | Required | Default | Description |
|---|---|---|---|
| `CORS_ORIGINS` | Recommended | `*` | Comma-separated list of allowed CORS origins for internal API routes. Set to your exact production domain(s). |
| `NODE_ENV` | No | `production` | Node.js environment. Set to `production` for optimized builds. Never set to `development` in production. |
| `NEXT_TELEMETRY_DISABLED` | No | `1` | Disables Next.js telemetry. Leave as `1` in production. |

#### Generating a Secure JWT Secret

```bash
# Method 1: OpenSSL (recommended)
openssl rand -hex 32
# Output: 4f8a2b1c9d3e6f7a0b2c4d6e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> **WARNING:** The default fallback `JWT_SECRET` in `src/lib/auth.ts` is for development only. Using it in production is a critical security vulnerability.

#### Generating a Webhook Process Secret

```bash
openssl rand -base64 48
# Output: K7x2mP9qR4sT8uW1yA3bC5dE7fG9hJ1kL3mN5oP7qR9sT==
```

### 1.3 Docker Deployment

The project includes a multi-stage `Dockerfile` and a `docker-compose.yml` that orchestrates three services: the Next.js application, Redis for caching, and Caddy as a reverse proxy with automatic HTTPS.

#### Step-by-Step Deployment

```bash
# 1. Clone the repository
git clone <your-repo-url> /opt/smartticketqr
cd /opt/smartticketqr

# 2. Create the production environment file
cp .env.example .env

# 3. Configure all environment variables (see §1.2)
nano .env

# 4. Build and start all services in detached mode
docker compose up -d --build

# 5. Verify all containers are healthy
docker compose ps
# Expected: app (healthy), redis (healthy), caddy (running)

# 6. Check application logs for startup errors
docker compose logs app --tail=50

# 7. Initialize the database (see §1.5)
docker compose exec app bun run db:push
curl -X POST http://localhost:3000/api/auth/seed
```

#### Docker Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Internet   │────▶│    Caddy     │────▶│   Next.js App    │
│  :80 / :443  │     │  (reverse    │     │   :3000 (Bun)    │
│              │     │   proxy)     │     │                  │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                 │
                                         ┌───────┴────────┐
                                         │  SQLite (file)  │
                                         │  /app/data/     │
                                         └────────────────┘
                                         ┌───────┐
                                         │ Redis │  (optional caching)
                                         │ :6379 │
                                         └───────┘
```

#### Service Details

| Service | Image | Port | Purpose | Restart Policy |
|---|---|---|---|---|
| `app` | Built from `Dockerfile` (Bun) | 3000 (internal) | Next.js application | `unless-stopped` |
| `redis` | `redis:7-alpine` | 6379 (internal) | Rate limiting, session cache | `unless-stopped` |
| `caddy` | `caddy:2-alpine` | 80, 443 (external) | HTTPS termination, reverse proxy | `unless-stopped` |

#### Docker Health Checks

The `app` service includes an automatic health check that runs every 30 seconds:

```
test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
interval: 30s
timeout: 10s
retries: 3
start_period: 30s
```

If the health check fails 3 consecutive times, Docker will automatically restart the container.

#### Useful Docker Commands

```bash
# Rebuild after code changes
docker compose up -d --build

# View all service logs in real-time
docker compose logs -f

# View logs for a specific service
docker compose logs -f app
docker compose logs -f redis
docker compose logs -f caddy

# Restart a single service
docker compose restart app

# Stop all services
docker compose down

# Stop and remove volumes (DESTRUCTIVE — wipes database)
docker compose down -v

# Execute a command inside the running container
docker compose exec app bun run db:push
docker compose exec app sqlite3 /app/data/custom.db "SELECT count(*) FROM Ticket;"

# Inspect resource usage
docker stats
```

### 1.4 Manual Deployment

For environments where Docker is not available, you can deploy directly using Bun.

#### Prerequisites

```bash
# Install Bun (https://bun.sh)
curl -fsSL https://bun.sh/install | bash

# Install system dependencies
sudo apt-get update
sudo apt-get install -y sqlite3 nginx certbot python3-certbot-nginx
```

#### Deployment Steps

```bash
# 1. Clone and install
git clone <your-repo-url> /opt/smartticketqr
cd /opt/smartticketqr
bun install

# 2. Generate Prisma client
bunx prisma generate

# 3. Create production environment file
cp .env.example .env
nano .env  # Set all required variables from §1.2

# 4. Build the Next.js application
bun run build

# 5. Push database schema
bunx prisma db push

# 6. Seed initial data
curl -X POST http://localhost:3000/api/auth/seed

# 7. Start the production server
bun run start
# or with PM2 for process management:
pm2 start bun --name smartticketqr -- run start
pm2 save
pm2 startup
```

#### Nginx Configuration (Manual HTTPS)

```nginx
server {
    listen 80;
    server_name tickets.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tickets.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/tickets.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tickets.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Obtain SSL certificate
sudo certbot --nginx -d tickets.yourdomain.com
```

### 1.5 Database Initialization

SmartTicketQR uses Prisma ORM with SQLite. The database file is stored in the `db/` directory (local) or `/app/data/` (Docker).

#### Schema Push (Recommended for SQLite)

```bash
# Docker
docker compose exec app bun run db:push

# Manual
bunx prisma db push
```

Prisma `db push` synchronizes the Prisma schema (`prisma/schema.prisma`) with the SQLite database without creating migration files. This is the recommended approach for SQLite in production.

#### Seed Demo Data

After pushing the schema, seed the database with demo data:

```bash
# Docker
curl -X POST http://localhost:3000/api/auth/seed

# Manual
curl -X POST http://localhost:3000/api/auth/seed
```

The seed script creates:
- 3 subscription plans (Starter, Pro, Enterprise) with XOF pricing
- 1 demo organization (slug: `demo`)
- 3 users with roles: `super_admin`, `admin`, `operator`
- 6 events across Senegal (music festival, tech conference, bus, ferry, boat cruise, national day)
- ~300 tickets with realistic West African names
- Scan logs, transactions, and activity logs

> **SECURITY WARNING:** The default seed password for all users is `Admin@123`. Change this immediately after first login via the admin UI or direct database update.

### 1.6 SSL/TLS with Caddy

Caddy automatically provisions and renews Let's Encrypt certificates with zero configuration.

#### Caddyfile Configuration

```
tickets.yourdomain.com {
    reverse_proxy app:3000
}
```

After updating the Caddyfile, restart Caddy:

```bash
docker compose restart caddy
```

Caddy will automatically:
- Request a certificate via ACME (Let's Encrypt) using HTTP-01 challenge
- Enable HTTPS on port 443
- Redirect all HTTP (port 80) traffic to HTTPS
- Handle certificate renewal before expiry
- Enable HTTP/2 for improved performance

#### DNS Requirements

Your domain must have an A record pointing to your server's public IP:

```
tickets.yourdomain.com.    300    IN    A    203.0.113.42
```

> **Note:** DNS propagation can take up to 48 hours. Use `dig tickets.yourdomain.com` to verify.

---

## 2. Security Headers

Security headers are implemented in `src/middleware.ts` and are applied to all page routes and `/api/v1/*` public API routes. They are **not** applied to internal `/api/*` routes (which use their own CORS headers).

### 2.1 Implemented Headers

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' https:

X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 0
Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)
```

### 2.2 Verification

Test all headers with a single command:

```bash
# Check page routes
curl -sI https://tickets.yourdomain.com | grep -E \
  "content-security-policy|x-content-type|x-frame|strict-transport|referrer-policy|x-xss|permissions-policy"

# Check public API v1 routes
curl -sI https://tickets.yourdomain.com/api/v1/health | grep -E \
  "content-security-policy|x-content-type|x-frame|strict-transport|referrer-policy|x-xss|permissions-policy"
```

### 2.3 Header Reference Table

| Header | Value | Purpose | Risk if Missing |
|---|---|---|---|
| **Content-Security-Policy** | (see above) | Controls which resources the browser is allowed to load. Prevents XSS by restricting script sources. | Browser may load malicious scripts from arbitrary origins. |
| **X-Content-Type-Options** | `nosniff` | Prevents MIME type sniffing. Forces browser to respect the declared Content-Type. | Attacker could upload a `.html` file disguised as an image and execute XSS. |
| **X-Frame-Options** | `DENY` | Prevents the page from being rendered in an `<iframe>`. Defends against clickjacking attacks. | Attacker could overlay invisible frames to trick users into clicking. |
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year, including all subdomains. Browser will refuse HTTP connections. | Users vulnerable to SSL stripping attacks on first visit. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Only sends the origin (not full URL) on cross-origin requests. Protects sensitive URL parameters. | Sensitive data (ticket codes, session IDs) could leak via Referer header. |
| **X-XSS-Protection** | `0` | Disables legacy XSS filter in Chrome (modern CSP handles this). | No risk — CSP is the modern replacement. Setting to `0` avoids edge-case mXSS bypasses. |
| **Permissions-Policy** | `camera=(self), microphone=(self), geolocation=(self)` | Restricts browser features (camera, mic, geolocation) to same-origin only. Required for QR scanner PWA. | Malicious third-party scripts could access camera/microphone without permission. |

#### CSP Hardening (Advanced)

For production, consider tightening the CSP by removing `'unsafe-inline'` and `'unsafe-eval'`:

1. **Add nonces to inline scripts** — Configure Next.js to generate per-request nonces:
   ```js
   // next.config.ts
   experimental: {
     headerStyle: '现代化的',
   }
   ```
2. **Restrict `connect-src`** to specific domains instead of `https:`:
   ```
   connect-src 'self' https://tickets.yourdomain.com https://api.payment-provider.com
   ```
3. **Restrict `img-src`** to your CDN domain:
   ```
   img-src 'self' data: blob: https://cdn.yourdomain.com
   ```

---

## 3. API Key Security

API keys provide authentication for the Public API v1 (`/api/v1/*`). The implementation is in `src/lib/api-key-auth.ts`.

### 3.1 Storage Architecture

**Raw API keys are never stored in the database.** Only SHA-256 hashes are persisted.

```
┌─────────────────────────────────────────────────────────────┐
│                    Key Lifecycle                             │
│                                                             │
│  Generation:                                                 │
│    crypto.randomBytes(16) → "stq_live_a1b2c3d4e5f6..."     │
│                                   │                        │
│                                   ▼                        │
│  Display ONCE to user (admin UI)                           │
│                                   │                        │
│                                   ▼                        │
│  Hashing:                                                    │
│    SHA-256("stq_live_a1b2c3d4e5f6...") → hash stored in DB │
│                                   │                        │
│                                   ▼                        │
│  Validation:                                                 │
│    SHA-256(request_key) → lookup hash in DB                 │
│    crypto.timingSafeCompare for constant-time comparison    │
└─────────────────────────────────────────────────────────────┘
```

**Database Schema** (`ApiKey` model in `prisma/schema.prisma`):

| Column | Type | Description |
|---|---|---|
| `keyHash` | `String` (unique) | SHA-256 hash of the raw key — **never the raw key** |
| `keyPrefix` | `String` | First 8 characters for identification (e.g., `stq_liv`) |
| `name` | `String` | Human-readable label (e.g., "Mobile App Production") |
| `permissions` | `String` (JSON) | `["read"]` or `["read","write"]` |
| `rateLimit` | `Int` | Max requests per hour (default: 100) |
| `isActive` | `Boolean` | Soft-delete flag — `false` = revoked |
| `expiresAt` | `DateTime?` | Optional expiration timestamp |

### 3.2 Key Format

```
stq_{environment}_{random_hex_32_chars}

Examples:
  stq_live_4f8a2b1c9d3e6f7a0b2c4d6e8f0a1b2c   (production)
  stq_test_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6    (staging/testing)
```

| Component | Length | Description |
|---|---|---|
| `stq_` | 4 chars | Fixed prefix — identifies SmartTicketQR keys |
| `{env}` | 4-5 chars | `live` or `test` — environment indicator |
| `{random}` | 32 chars | Cryptographically random hex (`crypto.randomBytes(16)`) |

### 3.3 Key Rotation Procedure

Key rotation is supported via the `rotateApiKey()` function in `src/lib/api-key-auth.ts`. The rotation:

1. Creates a **new** key with the same permissions, rate limit, and name
2. Deactivates the **old** key (sets `isActive: false`)
3. Returns the new raw key (displayed **only once**)
4. Clears rate limit state for the old key
5. Extends the expiry by at least 30 days (if the old key had an expiry)

#### Rotation Steps

```bash
# Option 1: Via Admin UI
# Navigate to Settings → API Keys → Click "Rotate" on the target key

# Option 2: Via API
curl -X POST \
  -H "Authorization: Bearer <session_token>" \
  https://tickets.yourdomain.com/api/api-keys/<key_id>/rotate
```

#### Safe Rotation Workflow

```
1. Generate new key ──▶ Store securely in your application config
2. Deploy new key ────▶ Update client apps, integrations, CI/CD
3. Verify new key ────▶ Test API calls with the new key
4. Wait 24-48 hours ──▶ Monitor for any 401 errors on the old key
5. Revoke old key ────▶ Via Admin UI or API
```

> **NOTE:** After rotation, the old key is immediately deactivated (not deleted). Any service still using the old key will receive `401 Unauthorized`.

### 3.4 Rate Limiting

API keys are rate-limited using an in-memory **sliding window** algorithm.

| Parameter | Value | Description |
|---|---|---|
| Window | 1 hour (3,600,000 ms) | Rolling time window per API key |
| Default Limit | 100 requests/hour | Configurable per key in admin UI |
| Max Store Size | 50,000 entries | Memory safety limit |
| Cleanup Interval | 1 hour | Stale entries purged automatically |
| Response on Limit | HTTP 429 | Includes `Retry-After` header |

#### Rate Limit Response Headers

Every API response includes these headers:

```
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1718467200
```

| Header | Description |
|---|---|
| `X-RateLimit-Remaining` | Number of requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

#### HTTP 429 Response

```json
{
  "success": false,
  "error": "Rate limit exceeded. Maximum 100 requests per hour. Try again later."
}
```

Additional headers:
```
Retry-After: 1847
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718467200
```

### 3.5 Best Practices

1. **Never log raw API keys** — Only log the `keyPrefix` (first 8 chars) for identification.

2. **Use environment-specific prefixes** — `stq_live_` for production, `stq_test_` for staging. This prevents accidental use of test keys in production.

3. **Set expiry dates** — Every key should have an `expiresAt`. This limits the blast radius of a compromised key.

4. **Apply least-privilege permissions** — Use `["read"]` for analytics dashboards. Only use `["read", "write"]` for services that need to create or modify tickets.

5. **One key per integration** — Don't share keys between services. Create a dedicated key for each integration so you can revoke individually.

6. **Rotate quarterly** — Set a calendar reminder to rotate all production API keys every 90 days.

7. **Revoke immediately on compromise** — If a key is leaked, revoke it instantly via the Admin UI. Since the old key is hashed, you cannot recover it — which is the intended security property.

8. **Monitor `lastUsedAt`** — Keys with no recent activity may indicate abandoned integrations and should be revoked.

---

## 4. Webhook System

SmartTicketQR delivers webhook events to configured HTTPS endpoints when actions occur within your organization. The webhook system is implemented in `src/lib/webhook-dispatcher.ts` and `src/app/api/webhooks/process/route.ts`.

### 4.1 Signature Verification

Every webhook delivery is signed with HMAC-SHA256 using the endpoint's signing secret. Partners **must** verify signatures to ensure authenticity.

#### Headers Sent with Every Webhook

| Header | Example | Description |
|---|---|---|
| `X-Signature` | `sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890` | HMAC-SHA256 signature of the raw payload body |
| `X-Webhook-Id` | `clx9abc2def0123456789abcd` | Unique delivery log ID (for idempotency) |
| `X-Event-Type` | `ticket.validated` | The event type that triggered this webhook |
| `Content-Type` | `application/json` | Always `application/json` |

#### Signature Computation

The signature is computed as follows:

```
HMAC-SHA256(
  key    = <endpoint_signing_secret>,
  message = <raw_request_body_as_string>
)
```

**Important:** Use the **raw body string** (not a parsed object) as the HMAC message. In most frameworks, you can access this via `request.body` (as a string) or `request.rawBody`.

```
X-Signature: sha256=<hex_encoded_hmac>
```

### 4.2 Event Types

| Event Type | Trigger | Payload Includes |
|---|---|---|
| `ticket.created` | A new ticket is purchased or created | `ticketId`, `ticketCode`, `eventId`, `eventName`, `holderName`, `holderEmail`, `price`, `currency` |
| `ticket.validated` | A ticket QR code is scanned and validated | `ticketId`, `ticketCode`, `eventId`, `eventName`, `validatedAt`, `operatorName`, `deviceInfo` |
| `ticket.cancelled` | A ticket is cancelled or refunded | `ticketId`, `ticketCode`, `eventId`, `eventName`, `cancelledAt`, `reason` |
| `subscription.created` | A new subscription is activated | `organizationId`, `organizationName`, `planCode`, `planName`, `startDate`, `endDate`, `amount`, `currency` |
| `subscription.expired` | A subscription has expired | `organizationId`, `organizationName`, `planCode`, `expiredAt` |
| `user.created` | A new user registers in an organization | `userId`, `userEmail`, `userName`, `role`, `organizationId`, `organizationName` |

#### Sample Payload: `ticket.validated`

```json
{
  "event": "ticket.validated",
  "timestamp": "2025-06-15T14:30:00.000Z",
  "organizationId": "clx9abc123456",
  "data": {
    "ticketId": "clx9def789012",
    "ticketCode": "A3KF-9N2P-XW7M",
    "eventId": "clx9ghi345678",
    "eventName": "Summer Music Festival 2025",
    "holderName": "Amadou Diallo",
    "holderEmail": "amadou.diallo@email.com",
    "validatedAt": "2025-06-15T14:30:00.000Z",
    "operatorName": "Sarah Operator",
    "deviceInfo": "Mobile Scanner v2.1",
    "location": "Main Entrance"
  }
}
```

### 4.3 Retry Schedule

Failed webhook deliveries are retried with exponential backoff. The retry schedule is:

| Attempt | Delay | Total Time Since First Attempt |
|---|---|---|
| 1st (immediate) | 0s | 0s |
| 2nd (first retry) | 1 minute | ~1 min |
| 3rd (second retry) | 5 minutes | ~6 min |
| — | — | — |
| **After 3 total attempts** | — | **Marked as permanently failed** |

#### Retry Logic Details

- A webhook is considered **failed** if the endpoint returns a non-2xx HTTP status or the connection times out (10-second timeout).
- `nextRetryAt` is calculated using `Date.now() + retryDelay`.
- The queue processor (`processWebhookQueue()`) processes up to **100 pending deliveries per batch**.
- If the endpoint is disabled or deleted, the webhook is immediately marked as `failed` without retry.

### 4.4 Queue Processing Cron

The webhook delivery queue is processed by calling:

```
POST /api/webhooks/process
Header: X-Process-Secret: <your_webhook_process_secret>
```

#### Option 1: Webhook Sender Mini-Service (Recommended)

The project includes a dedicated mini-service at `mini-services/webhook-sender/` that continuously polls the queue:

```bash
# Start the webhook sender service
cd mini-services/webhook-sender
bun --hot index.ts   # Development (auto-reload)
bun index.ts          # Production
```

Environment variables for the webhook sender:

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | URL of the main application |
| `WEBHOOK_PROCESS_SECRET` | *(none)* | Must match `WEBHOOK_PROCESS_SECRET` on the main app |
| `POLL_INTERVAL_MS` | `60000` | Polling interval in ms (default: 60 seconds) |

#### Option 2: System Cron Job

Alternatively, use the system cron to trigger processing every 2 minutes:

```bash
# Edit crontab
crontab -e

# Add this line (calls the process endpoint every 2 minutes)
*/2 * * * * curl -s -X POST -H "X-Process-Secret: YOUR_SECRET" http://localhost:3000/api/webhooks/process > /dev/null 2>&1
```

> **IMPORTANT:** If `WEBHOOK_PROCESS_SECRET` is set on the main app, the cron job **must** include the `X-Process-Secret` header. Without it, the request will be rejected with HTTP 401.

### 4.5 Verification Code Examples

#### Node.js (Express)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(req, secret) {
  const signatureHeader = req.headers['x-signature'];
  if (!signatureHeader) {
    return false;
  }

  // Extract the hex digest from "sha256=<hex>"
  const [algo, signature] = signatureHeader.split('=', 2);
  if (algo !== 'sha256' || !signature) {
    return false;
  }

  // Compute the expected signature using the RAW body
  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    // Buffer lengths differ — signatures cannot match
    return false;
  }
}

// Express middleware
app.post('/webhooks/smartticketqr', (req, res) => {
  const secret = process.env.SMARTTICKETQR_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(req, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventId = req.headers['x-webhook-id'];
  const eventType = req.headers['x-event-type'];

  // TODO: Check idempotency (skip if eventId already processed)
  // TODO: Process the webhook payload
  // TODO: Store eventId in your database to prevent duplicates

  console.log(`Received ${eventType} event:`, req.body);

  // Always return 200 quickly to avoid retries
  return res.status(200).json({ received: true });
});
```

#### PHP (Laravel)

```php
<?php

// routes/web.php or routes/api.php
Route::post('/webhooks/smartticketqr', function (Illuminate\Http\Request $request) {
    $secret = env('SMARTTICKETQR_WEBHOOK_SECRET');
    $signatureHeader = $request->header('X-Signature');

    if (!$signatureHeader) {
        return response()->json(['error' => 'Missing signature'], 401);
    }

    // Parse "sha256=<hex>"
    $parts = explode('=', $signatureHeader, 2);
    if (count($parts) !== 2 || $parts[0] !== 'sha256') {
        return response()->json(['error' => 'Invalid signature format'], 401);
    }

    $providedSignature = $parts[1];
    $rawBody = $request->getContent();

    // Compute HMAC-SHA256
    $expectedSignature = hash_hmac('sha256', $rawBody, $secret);

    // Timing-safe comparison (hash_equals prevents timing attacks)
    if (!hash_equals($expectedSignature, $providedSignature)) {
        return response()->json(['error' => 'Invalid signature'], 401);
    }

    // Extract metadata
    $eventId = $request->header('X-Webhook-Id');
    $eventType = $request->header('X-Event-Type');

    // Check idempotency — skip if already processed
    $existing = \DB::table('webhook_events')
        ->where('event_id', $eventId)
        ->first();

    if ($existing) {
        return response()->json(['status' => 'already_processed']);
    }

    // Process the event
    $payload = $request->json()->all();
    Log::info("Webhook received: {$eventType}", $payload);

    // Store event ID to prevent duplicates
    \DB::table('webhook_events')->insert([
        'event_id' => $eventId,
        'event_type' => $eventType,
        'payload' => json_encode($payload),
        'processed_at' => now(),
    ]);

    return response()->json(['received' => true]);
});
```

#### Key Verification Rules

1. **Always use timing-safe comparison** — `crypto.timingSafeEqual()` in Node.js, `hash_equals()` in PHP. Never use `===` for signature comparison, as it is vulnerable to timing attacks.
2. **Use the raw body** — Do not parse the JSON before computing the HMAC. Whitespace or key ordering differences will cause verification failure.
3. **Check idempotency** — Store the `X-Webhook-Id` in your database. If you receive a duplicate (due to retry), return `200 OK` without reprocessing.
4. **Return 200 quickly** — The platform retries on non-2xx responses. Do your processing asynchronously if needed, but always return `200 OK`.
5. **Verify `sha256=` prefix** — Ensure the algorithm in the header matches what you expect. This prevents algorithm confusion attacks.

---

## 5. Backup & Recovery

### 5.1 Backup Strategy

SmartTicketQR uses SQLite, which stores all data in a single file. Backups are performed using SQLite's `.backup` command, which creates a consistent snapshot even if the database is being written to concurrently.

#### What to Back Up

| Path | Contents | Priority |
|---|---|---|
| `db/custom.db` (local) or `/app/data/custom.db` (Docker) | SQLite database — **all application data** | **Critical** |
| `db/custom.db-wal` | Write-ahead log (for crash recovery) | **Critical** (backup simultaneously) |
| `db/custom.db-shm` | Shared memory file | Optional (auto-recreated) |
| `.env` | Environment variables and secrets | **Critical** |
| `Caddyfile` | Reverse proxy configuration | High |
| `prisma/schema.prisma` | Database schema definition | High |
| `mini-services/webhook-sender/` | Webhook sender service code | Medium |

> **IMPORTANT:** Always back up the **entire `db/` folder**, not just the `.db` file. The WAL and SHM files are required for a consistent restore if the database was active during backup.

### 5.2 Backup Rotation Policy

Implement a tiered rotation strategy to balance storage costs and recovery point objectives:

| Tier | Retention | Schedule | Total Backups |
|---|---|---|---|
| **Daily** | 7 days | Every day at 02:00 | 7 |
| **Weekly** | 4 weeks | Every Sunday at 03:00 | 4 |
| **Monthly** | 6 months | 1st of each month at 04:00 | 6 |
| **Total** | — | — | **17 backups max** |

#### Rotation Script with Tiered Retention

```bash
#!/bin/bash
# scripts/backup-rotated.sh
# Usage: ./scripts/backup-rotated.sh
set -euo pipefail

DB_PATH="${DB_PATH:-./db/custom.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)    # 1=Monday ... 7=Sunday
DAY_OF_MONTH=$(date +%d)   # 01-31

mkdir -p "${BACKUP_DIR}/daily"
mkdir -p "${BACKUP_DIR}/weekly"
mkdir -p "${BACKUP_DIR}/monthly"

# --- Create backup using SQLite .backup command ---
BACKUP_FILE="${BACKUP_DIR}/smartticketqr_${TIMESTAMP}.db"

if command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"
else
    # Fallback: file copy (less safe during writes)
    cp "$DB_PATH" "$BACKUP_FILE"
fi

gzip "$BACKUP_FILE"

# --- Route to appropriate tier ---
GZ_FILE="${BACKUP_FILE}.gz"

if [ "$DAY_OF_MONTH" = "01" ]; then
    # Monthly backup (1st of the month)
    mv "$GZ_FILE" "${BACKUP_DIR}/monthly/"
    echo "[$(date)] Monthly backup created: ${GZ_FILE}"
elif [ "$DAY_OF_WEEK" = "7" ]; then
    # Weekly backup (Sunday)
    mv "$GZ_FILE" "${BACKUP_DIR}/weekly/"
    echo "[$(date)] Weekly backup created: ${GZ_FILE}"
else
    # Daily backup
    mv "$GZ_FILE" "${BACKUP_DIR}/daily/"
    echo "[$(date)] Daily backup created: ${GZ_FILE}"
fi

# --- Rotate: keep only the most recent N backups per tier ---
# Daily: keep 7
ls -t "${BACKUP_DIR}/daily/"*.gz 2>/dev/null | tail -n +8 | xargs -r rm --
# Weekly: keep 4
ls -t "${BACKUP_DIR}/weekly/"*.gz 2>/dev/null | tail -n +5 | xargs -r rm --
# Monthly: keep 6
ls -t "${BACKUP_DIR}/monthly/"*.gz 2>/dev/null | tail -n +7 | xargs -r rm --

echo "[$(date)] Rotation complete."
```

#### Cron Setup for Tiered Backups

```bash
crontab -e

# Daily backup at 2:00 AM (script handles tier routing)
0 2 * * * /opt/smartticketqr/scripts/backup-rotated.sh >> /var/log/smartticketqr-backup.log 2>&1
```

### 5.3 Backup Script

The project includes a production-ready backup script at `scripts/backup-db.sh`:

```bash
# Docker
docker compose exec app bash /app/scripts/backup-db.sh

# Manual
./scripts/backup-db.sh
```

**Features:**
- Uses SQLite `.backup` command for consistent snapshots
- Compresses with gzip (80-90% size reduction)
- Verifies gzip integrity after creation
- Automatic cleanup of old backups (configurable via `RETENTION_DAYS`)
- Logs all operations with timestamps

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `/app/data/custom.db` | Path to the SQLite database |
| `BACKUP_DIR` | `/app/backups` | Directory for backup files |
| `RETENTION_DAYS` | `7` | Days to keep backups before cleanup |

### 5.4 Off-Site Storage

Backups stored on the same server are vulnerable to hardware failure or ransomware. Copy backups to off-site storage:

#### AWS S3

```bash
# Install AWS CLI
sudo apt-get install awscli

# Configure credentials
aws configure

# Sync backups to S3 (run daily via cron)
aws s3 sync /opt/smartticketqr/backups/ s3://your-bucket/smartticketqr-backups/ \
  --delete \
  --storage-class GLACIER

# Or upload only new/changed files
aws s3 cp /opt/smartticketqr/backups/ s3://your-bucket/smartticketqr-backups/ \
  --recursive
```

#### Rsync to Backup Server

```bash
# Daily sync to a remote backup server
rsync -avz --delete \
  -e "ssh -i /path/to/key.pem" \
  /opt/smartticketqr/backups/ \
  backup-user@backup-server:/backups/smartticketqr/
```

#### Cron for Off-Site Sync

```bash
# Sync to S3 every day at 3:00 AM (after backup completes at 2:00 AM)
0 3 * * * aws s3 sync /opt/smartticketqr/backups/ s3://your-bucket/smartticketqr-backups/ >> /var/log/smartticketqr-s3.log 2>&1
```

### 5.5 Restore Procedure

#### Docker Restore

```bash
# 1. Stop the application to prevent writes during restore
docker compose stop app

# 2. Verify which backup to restore
ls -la /opt/smartticketqr/backups/

# 3. Decompress and restore the database
# NOTE: This OVERWRITES the current database
gunzip -c /path/to/backup/smartticketqr_20250615_020000.db.gz > /tmp/restore.db
docker cp /tmp/restore.db smartticketqr-app-1:/app/data/custom.db
rm /tmp/restore.db

# 4. Fix file ownership (app runs as non-root user)
docker compose exec app chown nextjs:nodejs /app/data/custom.db

# 5. Verify database integrity
docker compose exec app sqlite3 /app/data/custom.db "PRAGMA integrity_check;"
# Expected output: ok

# 6. Start the application
docker compose start app

# 7. Verify the application is healthy
sleep 10
curl -s https://tickets.yourdomain.com/api/v1/health

# 8. Check application logs for any errors
docker compose logs app --tail=50
```

#### Manual Restore

```bash
# 1. Stop the application
pm2 stop smartticketqr

# 2. Backup the current database (just in case)
cp db/custom.db db/custom.db.broken.$(date +%Y%m%d)

# 3. Restore from backup
gunzip -c /path/to/backup/smartticketqr_20250615_020000.db.gz > db/custom.db

# 4. Verify integrity
sqlite3 db/custom.db "PRAGMA integrity_check;"

# 5. Restart the application
pm2 start smartticketqr
```

> **WARNING:** Restoring a backup is destructive — it completely replaces the current database. Always backup the current state before restoring.

---

## 6. Monitoring

### 6.1 Health Check Endpoint

```
GET /api/v1/health
```

This endpoint requires **no authentication** and returns the current service status.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-06-15T14:30:00.000Z",
    "version": "5.0.0"
  }
}
```

**Usage:**

```bash
# Check health
curl -s https://tickets.yourdomain.com/api/v1/health | jq .

# HTTP status code only (for monitoring scripts)
curl -s -o /dev/null -w "%{http_code}" https://tickets.yourdomain.com/api/v1/health
# Expected: 200
```

**Integration with monitoring tools:**

- **UptimeRobot:** Monitor `https://tickets.yourdomain.com/api/v1/health` with keyword `ok`
- **Healthchecks.io:** Ping after the monitor script completes
- **Prometheus:** Use a Blackbox Exporter to probe this endpoint
- **CloudWatch:** Configure a Route 53 health check against this URL

### 6.2 Monitor Script

The project includes a comprehensive health monitoring script at `scripts/monitor.sh`:

```bash
# Docker
docker compose exec app bash /app/scripts/monitor.sh

# Manual
./scripts/monitor.sh
```

**Checks performed:**

| Check | What it verifies | Alert Threshold |
|---|---|---|
| API Health | `GET /api/health` returns 200 | Any non-200 response |
| Public API | `GET /api/ticket/public` is reachable | Non-200/400/404 response |
| Database File | `custom.db` exists and is readable | File not found |
| Database Integrity | SQLite `PRAGMA integrity_check` | Any failure |
| Disk Usage | Partition containing data dir | > 90% usage |
| App Error Logs | Error count in last hour | > 10 errors |
| Memory Usage | System available memory | > 90% used |

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | Base URL for HTTP checks |
| `ERROR_THRESHOLD` | `10` | Max errors in 1 hour before alert |
| `ALERT_EMAIL` | *(none)* | Email address for failure alerts |
| `DATA_DIR` | `/app/data` | Database directory path |
| `LOG_FILE` | `/app/logs/app.log` | Application log file path |

**Cron setup (every 5 minutes):**

```bash
crontab -e

*/5 * * * * /opt/smartticketqr/scripts/monitor.sh >> /var/log/smartticketqr-monitor.log 2>&1
```

### 6.3 Log Monitoring

#### Docker Logs

```bash
# Real-time log streaming (all services)
docker compose logs -f

# App service only
docker compose logs -f app

# Last 100 lines
docker compose logs app --tail=100

# Logs since a specific time
docker compose logs app --since "2025-06-15T10:00:00"

# Filter for errors
docker compose logs app 2>&1 | grep -i "error\|fatal\|crash"

# Save logs to file for analysis
docker compose logs app --since 24h > /tmp/app-logs-24h.txt
```

#### Key Log Patterns to Monitor

| Pattern | Severity | Action |
|---|---|---|
| `WebhookDispatcher] Failed to dispatch` | Warning | Check webhook endpoint configuration |
| `WebhookDispatcher] Queue processing error` | Error | Investigate database connectivity |
| `rate limit exceeded` | Info | Normal — client hitting rate limits |
| `Invalid API key` | Warning | Possible unauthorized access attempt |
| `LOGIN_FAIL` | Warning | Check audit logs for brute force attempts |
| `ECONNREFUSED` | Critical | Service unreachable — check container status |
| `SQLITE_BUSY` | Warning | Database contention — increase timeout |
| `Out of memory` | Critical | Immediate restart and investigation |

### 6.4 Webhook Delivery Monitoring

#### Via Admin UI

Navigate to the admin dashboard: **Reports** > **Webhook Logs**

The logs page shows:
- Delivery status: `pending`, `delivered`, `failed`
- HTTP status code returned by the endpoint
- Number of attempts and next retry time
- Response body (truncated to 10,000 chars)

#### Via API

```bash
# List recent webhook logs
curl -H "Authorization: Bearer <token>" \
  https://tickets.yourdomain.com/api/webhooks/logs

# Retry a failed webhook
curl -X POST \
  -H "Authorization: Bearer <token>" \
  https://tickets.yourdomain.com/api/webhooks/retry?logId=<log_id>
```

#### Monitoring Alerts for Failed Webhooks

Set up an alert when webhook failure rate exceeds a threshold:

```bash
# Check for failed webhooks in the last hour (via monitor script addition)
FAILED_WEBHOOKS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://tickets.yourdomain.com/api/webhooks/logs?status=failed" \
  | jq '.items | length')

if [ "$FAILED_WEBHOOKS" -gt 5 ]; then
  echo "ALERT: $FAILED_WEBHOOKS failed webhooks in the last hour"
fi
```

### 6.5 Database Size Monitoring

#### Check Database Size

```bash
# Docker
docker compose exec app ls -lh /app/data/custom.db

# Manual
ls -lh db/custom.db

# Human-readable size
sqlite3 db/custom.db "SELECT page_count * page_size / 1024 / 1024 || ' MB' AS size FROM pragma_page_count(), pragma_page_size();"
```

#### Run VACUUM to Reclaim Space

SQLite databases do not automatically reclaim space from deleted records. Run `VACUUM` periodically:

```bash
# WARNING: VACUUM locks the database — run during low-traffic periods
sqlite3 db/custom.db "VACUUM;"

# Docker (stop the app first to prevent concurrent access)
docker compose stop app
docker compose exec app sqlite3 /app/data/custom.db "VACUUM;"
docker compose start app
```

#### Size Thresholds

| Size | Action |
|---|---|
| < 100 MB | Normal — no action needed |
| 100 MB – 500 MB | Monitor growth rate, consider running VACUUM |
| 500 MB – 1 GB | Plan data archival of old tickets/scans |
| > 1 GB | Implement data retention policies, archive old data |

#### Set Up Size Monitoring in Cron

```bash
# Check database size daily and alert if > 500 MB
0 6 * * * DB_SIZE=$(stat -c%s /opt/smartticketqr/db/custom.db 2>/dev/null || echo 0); \
  if [ "$DB_SIZE" -gt 524288000 ]; then \
    echo "ALERT: Database size is $(echo "scale=1; $DB_SIZE/1048576" | bc) MB" | \
    mail -s "SmartTicketQR: Large Database Alert" ops@yourdomain.com; \
  fi
```

### 6.6 Alerting

#### Email Alerts

The monitor script supports email alerts via the `mail` command:

```bash
# Set in crontab environment
ALERT_EMAIL=ops@yourdomain.com
ERROR_THRESHOLD=5
```

#### Slack Alerts

Add a Slack webhook notification to the monitor script:

```bash
# Add to the end of scripts/monitor.sh, before the exit:
if [ "$HAS_FAILURE" = true ]; then
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"⚠️ SmartTicketQR Health Check FAILED at $(date)\",
      \"attachments\": [{
        \"color\": \"danger\",
        \"fields\": [
          {\"title\": \"Server\", \"value\": \"$(hostname)\", \"short\": true},
          {\"title\": \"Checks\", \"value\": \"See monitor log for details\", \"short\": true}
        ]
      }]
    }"
fi
```

#### Healthchecks.io Integration

```bash
# Add to the end of scripts/monitor.sh
HEALTHCHECKS_URL="https://hc-ping.io/your-uuid-here"

if [ "$HAS_FAILURE" = true ]; then
  curl -s "$HEALTHCHECKS_URL/fail" > /dev/null
else
  curl -s "$HEALTHCHECKS_URL" > /dev/null
fi
```

---

## 7. Pre-Launch Checklist

Complete every item before going live. Print this section and check off each item.

### 7.1 Security

- [ ] **JWT_SECRET is set and strong** — Generate with `openssl rand -hex 32`. Must be 32+ characters. Verify in `.env`:
  ```bash
  grep JWT_SECRET .env | awk -F= '{print length($2)}'
  # Must output a number >= 32
  ```

- [ ] **WEBHOOK_PROCESS_SECRET is set** — Generate with `openssl rand -base64 48`. Verify the webhook sender service uses the same value:
  ```bash
  grep WEBHOOK_PROCESS_SECRET .env
  ```

- [ ] **API keys tested** — Create at least one production API key via the Admin UI. Verify it works:
  ```bash
  curl -H "X-API-Key: stq_live_..." https://tickets.yourdomain.com/api/v1/health
  # Must return 200 with CORS headers
  ```

- [ ] **Webhook signatures verified** — Set up a test endpoint (https://webhook.site), create a webhook endpoint in the Admin UI, trigger a ticket creation, and verify the HMAC signature matches:
  ```bash
  # Compare the X-Signature header value with your computed HMAC
  echo -n '<raw_payload>' | openssl dgst -sha256 -hmac '<your_endpoint_secret>'
  ```

- [ ] **Security headers confirmed** — Verify all headers are present on page and API v1 routes:
  ```bash
  curl -sI https://tickets.yourdomain.com | grep -iE "content-security|x-content-type|x-frame|strict-transport|referrer-policy|permissions-policy"
  # All 6 headers must be present
  ```

- [ ] **CORS origins restricted** — Verify `CORS_ORIGINS` is set to your exact domain(s), not `*`:
  ```bash
  grep CORS_ORIGINS .env
  ```

- [ ] **Default admin password changed** — The seed password is `Admin@123`. Change it immediately after first login.

- [ ] **Firewall configured** — Only ports 80 and 443 are exposed externally:
  ```bash
  sudo ufw status
  # Should show: 22/tcp, 80/tcp, 443/tcp ALLOW
  ```

### 7.2 Functionality

- [ ] **Multi-tenant isolation verified** — Create two test organizations. Verify that users in Org A cannot see Org B's tickets, events, or data:
  ```bash
  # Log in as Org A user, query events — should only return Org A events
  curl -H "Authorization: Bearer <org_a_token>" \
    https://tickets.yourdomain.com/api/events
  ```

- [ ] **QR code generation works** — Create a ticket via the Admin UI. Verify the QR code image loads and the encoded data can be scanned.

- [ ] **QR scanning works** — Use a mobile device or the in-app scanner to scan a generated QR code. Verify the ticket validation response is correct.

- [ ] **PWA offline mode works** — Open the application on a mobile device. Enable airplane mode. Verify the scanner still functions with cached ticket data and scans are queued for sync.

- [ ] **Payment integration tested** — For each supported payment method (Wave, Orange Money):
  - Initiate a test payment
  - Verify the webhook callback is received
  - Confirm subscription status is updated correctly

- [ ] **Webhook delivery confirmed** — Create a test webhook endpoint (https://webhook.site). Subscribe to `ticket.created`. Create a ticket and verify the webhook is delivered within 2 minutes.

- [ ] **CSV/PDF export works** — Navigate to Reports, export tickets as CSV and PDF. Verify the files download correctly.

- [ ] **Bulk ticket creation works** — Test the bulk creation endpoint with 10+ tickets. Verify all are created and have unique ticket codes.

### 7.3 Infrastructure

- [ ] **Docker containers healthy** — All services report healthy status:
  ```bash
  docker compose ps
  # Expected: app (healthy), redis (healthy), caddy (running)
  ```

- [ ] **Backups scheduled** — Cron jobs for backup and monitoring are installed:
  ```bash
  crontab -l
  # Should include:
  #   0 2 * * * .../backup-db.sh ...    (daily backup)
  #   */5 * * * * .../monitor.sh ...    (health check)
  ```

- [ ] **Backup restore tested** — Perform a test restore from the latest backup:
  ```bash
  # Follow the restore procedure in §5.5
  # Verify data integrity after restore
  ```

- [ ] **SSL/HTTPS configured** — Verify HTTPS is working with a valid certificate:
  ```bash
  curl -sI https://tickets.yourdomain.com | head -1
  # Expected: HTTP/2 200

  # Check certificate expiry
  echo | openssl s_client -servername tickets.yourdomain.com -connect tickets.yourdomain.com:443 2>/dev/null \
    | openssl x509 -noout -dates
  ```

- [ ] **Monitoring active** — Verify the monitor script runs successfully:
  ```bash
  /opt/smartticketqr/scripts/monitor.sh
  # Expected: All checks pass, exit code 0
  ```

- [ ] **Webhook sender running** — Verify the webhook sender service is active:
  ```bash
  # Check if the process is running
  ps aux | grep webhook-sender
  # Or check Docker
  docker compose logs webhook-sender --tail=10
  ```

- [ ] **Disk space sufficient** — At least 10 GB free:
  ```bash
  df -h /opt/smartticketqr
  ```

- [ ] **Off-site backup configured** — Backups are being synced to S3 or a remote server:
  ```bash
  aws s3 ls s3://your-bucket/smartticketqr-backups/ --recursive | tail -5
  ```

- [ ] **Error logging configured** — Application errors are being captured:
  ```bash
  docker compose logs app --since 1h | grep -i error
  # Check for unexpected errors
  ```

---

## Quick Reference

### Essential Commands

```bash
# Docker
docker compose up -d --build        # Build and start
docker compose ps                    # Check status
docker compose logs -f app           # View logs
docker compose restart app           # Restart app
docker compose exec app bash         # Shell into container

# Database
docker compose exec app sqlite3 /app/data/custom.db    # DB shell
sqlite3 db/custom.db "PRAGMA integrity_check;"         # Check integrity
sqlite3 db/custom.db "VACUUM;"                          # Reclaim space

# Backup
docker compose exec app bash /app/scripts/backup-db.sh  # Manual backup
./scripts/backup-rotated.sh                              # Rotated backup

# Health
curl -s https://tickets.yourdomain.com/api/v1/health | jq .   # Health check
./scripts/monitor.sh                                           # Full health check
```

### Emergency Procedures

| Situation | Immediate Action | Follow-Up |
|---|---|---|
| **App unresponsive** | `docker compose restart app` | Check logs, investigate root cause |
| **Database corrupted** | Stop app, restore from latest backup (§5.5) | Check disk health, review error logs |
| **SSL certificate issue** | `docker compose restart caddy` | Verify DNS, check Let's Encrypt rate limits |
| **High memory usage** | `docker compose restart app redis` | Review Redis maxmemory, check for memory leaks |
| **API key compromised** | Revoke key via Admin UI immediately | Rotate all keys, review audit logs |
| **Webhook endpoint down** | Webhooks will retry automatically (3 attempts) | Fix endpoint, manually retry failed logs |
| **Security incident** | Rotate all secrets, revoke all API keys | Review audit logs, notify affected users |
| **Ransomware / breach** | Isolate server, do NOT pay ransom | Restore from off-site backup, involve security team |

### Support Contacts

| Resource | Location |
|---|---|
| Source Code | Project repository |
| API Documentation | `/docs/openapi.yaml` (OpenAPI 3.0 spec) |
| Database Schema | `prisma/schema.prisma` |
| Security Headers | `src/middleware.ts` |
| API Key Logic | `src/lib/api-key-auth.ts` |
| Webhook Dispatcher | `src/lib/webhook-dispatcher.ts` |
| Webhook Sender | `mini-services/webhook-sender/index.ts` |
| Backup Script | `scripts/backup-db.sh` |
| Monitor Script | `scripts/monitor.sh` |

---

*This guide is part of the SmartTicketQR platform documentation. For the latest version, refer to the project repository.*
