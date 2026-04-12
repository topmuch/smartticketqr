#!/usr/bin/env bash
# ============================================================
# SmartTicketQR — Webhook Queue Processing Cron Script
# ============================================================
# Triggers the webhook queue processor to deliver pending
# webhook events to configured endpoints.
#
# Usage: ./scripts/webhook-cron.sh
# Cron:  */2 * * * * /app/scripts/webhook-cron.sh >> /var/log/webhook-cron.log 2>&1
#
# This calls POST /api/webhooks/process with the process secret
# to trigger delivery of all pending webhook messages.
# ============================================================

set -euo pipefail

# ---- Configuration ----
APP_URL="${APP_URL:-http://localhost:3000}"
PROCESS_SECRET="${WEBHOOK_PROCESS_SECRET:-}"

if [ -z "$PROCESS_SECRET" ]; then
    echo "[$(date -Iseconds)] ERROR: WEBHOOK_PROCESS_SECRET is not set. Exiting."
    exit 1
fi

# ---- Trigger webhook processing ----
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${APP_URL}/api/webhooks/process" \
    -H "Content-Type: application/json" \
    -H "X-Process-Secret: ${PROCESS_SECRET}" \
    --max-time 30 \
    --connect-timeout 10 \
    2>/dev/null || echo "CURL_FAILED\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "000" ]; then
    echo "[$(date -Iseconds)] ERROR: Failed to connect to $APP_URL"
    exit 1
fi

if [ "$HTTP_CODE" = "200" ]; then
    PROCESSED=$(echo "$BODY" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*' || echo "0")
    FAILED=$(echo "$BODY" | grep -o '"failed":[0-9]*' | grep -o '[0-9]*' || echo "0")
    echo "[$(date -Iseconds)] OK: processed=$PROCESSED failed=$FAILED"
else
    echo "[$(date -Iseconds)] WARNING: HTTP $HTTP_CODE - $BODY"
fi
