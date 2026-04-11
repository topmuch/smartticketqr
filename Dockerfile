# =============================================================================
# SmartTicketQR — Multi-Stage Production Dockerfile
# =============================================================================
# Bun-powered Next.js 16 standalone build with SQLite + Prisma.
# Produces a minimal, secure production image (~200MB).
# Security: non-root user (nextjs:nodejs), no build tooling in final stage.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Dependencies
# ---------------------------------------------------------------------------
# Install all dependencies (including devDependencies needed for the build).
# Uses --frozen-lockfile for deterministic, reproducible builds.
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app

# Copy dependency manifests first to maximize Docker layer cache hits
COPY package.json bun.lock ./

# Install everything — devDependencies are needed for `next build`
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
# Compile the Next.js application with all source code.
# Prisma client is generated before the build so type-safe DB queries work.
# The `build` script in package.json handles:
#   1. next build (standalone output)
#   2. cp -r .next/static  → .next/standalone/.next/
#   3. cp -r public        → .next/standalone/
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS builder
WORKDIR /app

# Re-use cached node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy entire source tree
COPY . .

# Disable Next.js telemetry (no data sent to Vercel)
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client before build (required for type-safe DB access at build time)
RUN bunx prisma generate

# Build the Next.js application (standalone output configured in next.config.ts)
# The post-build copy steps in the `build` script ensure standalone has static + public
RUN bun run build

# ---------------------------------------------------------------------------
# Stage 3: Runner (Production)
# ---------------------------------------------------------------------------
# Minimal image: standalone server, static assets, public files, and Prisma schema.
# Runs as non-root user for security. Healthcheck baked in.
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS runner
WORKDIR /app

# --- Environment Variables ---
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# --- Non-Root User ---
# Create a dedicated user/group with fixed GID/UID for consistent permissions
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# --- Application Files ---
# Copy the entire standalone output to the app root.
# This includes server.js, node_modules (traced deps), and the
# public/ + .next/static/ dirs copied by the build script.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy Prisma schema for potential runtime DB migrations
COPY --from=builder /app/prisma ./prisma

# Ensure Prisma client engine is available at runtime (standalone may omit it)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# --- Security: Drop root privileges ---
USER nextjs

# --- Networking ---
EXPOSE 3000

# --- Health Check ---
# Uses curl to probe the /api/v1/health endpoint every 30 seconds.
# 3 consecutive failures mark the container as unhealthy.
# start_period=40s gives the server enough time to boot.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# --- Entrypoint ---
# Run the production Next.js standalone server via Bun runtime
CMD ["bun", "server.js"]
