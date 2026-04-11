#!/bin/bash
# =============================================================================
# SmartTicketQR — Health Monitor Script
# =============================================================================
# Performs periodic health checks on the application and reports status.
# Designed to run as a cron job with output logged for review.
#
# Usage:
#   ./scripts/monitor.sh
#
# Cron (every 5 minutes):
#   */5 * * * * /path/to/scripts/monitor.sh >> /var/log/smartticketqr-monitor.log 2>&1
#
# Environment Variables (optional overrides):
#   APP_URL          — Base URL of the application (default: http://localhost:3000)
#   ERROR_THRESHOLD  — Max acceptable recent errors before alerting (default: 10)
#   ALERT_EMAIL      — Email address for alerts (default: empty, no email alerts)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
APP_URL="${APP_URL:-http://localhost:3000}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-10}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
DATA_DIR="${DATA_DIR:-/app/data}"
LOG_FILE="${LOG_FILE:-/app/logs/app.log}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Track if any check failed
HAS_FAILURE=false

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
log_ok()   { echo "[$TIMESTAMP] ✓ $1"; }
log_fail() { echo "[$TIMESTAMP] ✗ $1"; HAS_FAILURE=true; }
log_warn() { echo "[$TIMESTAMP] ⚠ $1"; }

# ---------------------------------------------------------------------------
# Check 1: API Health Endpoint
# ---------------------------------------------------------------------------
echo "[$TIMESTAMP] Running SmartTicketQR health check..."

if command -v curl &> /dev/null; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" --max-time 10 || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    # Parse the health response for version info
    HEALTH_BODY=$(curl -s "${APP_URL}/api/health" --max-time 10 || echo "{}")
    log_ok "API health: OK (HTTP ${HTTP_CODE}) — ${HEALTH_BODY}"
  else
    log_fail "API health: FAIL (HTTP ${HTTP_CODE})"
  fi

  # ---------------------------------------------------------------------------
  # Check 2: Public Ticket Endpoint
  # ---------------------------------------------------------------------------
  PUBLIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/ticket/public" --max-time 10 || echo "000")
  if [ "$PUBLIC_CODE" = "200" ] || [ "$PUBLIC_CODE" = "400" ] || [ "$PUBLIC_CODE" = "404" ]; then
    log_ok "Public API: OK (HTTP ${PUBLIC_CODE})"
  else
    log_fail "Public API: FAIL (HTTP ${PUBLIC_CODE})"
  fi
else
  log_warn "curl not found — skipping HTTP health checks"
fi

# ---------------------------------------------------------------------------
# Check 3: Database File
# ---------------------------------------------------------------------------
if [ -f "${DATA_DIR}/custom.db" ]; then
  DB_SIZE=$(du -h "${DATA_DIR}/custom.db" | cut -f1)
  log_ok "Database: OK (${DB_SIZE})"

  # Check if database is locked or corrupted
  if command -v sqlite3 &> /dev/null; then
    if sqlite3 "${DATA_DIR}/custom.db" "PRAGMA integrity_check;" > /dev/null 2>&1; then
      log_ok "Database integrity: PASSED"
    else
      log_fail "Database integrity: FAILED (may be corrupted)"
    fi
  fi
else
  log_fail "Database file not found at ${DATA_DIR}/custom.db"
fi

# ---------------------------------------------------------------------------
# Check 4: Disk Usage
# ---------------------------------------------------------------------------
if [ -d "$DATA_DIR" ]; then
  DISK_USAGE=$(df -h "$DATA_DIR" | tail -1 | awk '{print $5}' | tr -d '%')
  if [ -n "$DISK_USAGE" ] && [ "$DISK_USAGE" -gt 90 ]; then
    log_warn "Disk usage at ${DISK_USAGE}% — consider cleanup or expansion"
  elif [ -n "$DISK_USAGE" ]; then
    log_ok "Disk usage: ${DISK_USAGE}%"
  fi
else
  log_warn "Data directory not found at $DATA_DIR"
fi

# ---------------------------------------------------------------------------
# Check 5: Application Log Errors (if log file exists)
# ---------------------------------------------------------------------------
if [ -f "$LOG_FILE" ]; then
  # Count error occurrences in the last hour
  ERROR_COUNT=$(awk -v cutoff="$(date -d '1 hour ago' '+%Y-%m-%dT%H' 2>/dev/null || date '+%Y-%m-%dT%H')" \
    '$0 >= cutoff && /ERROR|FATAL|crash/i { count++ } END { print count+0 }' "$LOG_FILE" 2>/dev/null || echo "0")

  if [ "$ERROR_COUNT" -gt "$ERROR_THRESHOLD" ]; then
    log_fail "Application errors in last hour: ${ERROR_COUNT} (threshold: ${ERROR_THRESHOLD})"
  elif [ "$ERROR_COUNT" -gt 0 ]; then
    log_warn "Application errors in last hour: ${ERROR_COUNT}"
  else
    log_ok "Application errors in last hour: 0"
  fi
else
  log_ok "Log file not found at $LOG_FILE (no errors to check)"
fi

# ---------------------------------------------------------------------------
# Check 6: Memory Usage (Linux only)
# ---------------------------------------------------------------------------
if [ -f /proc/meminfo ]; then
  TOTAL_MEM=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
  AVAILABLE_MEM=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
  if [ -n "$TOTAL_MEM" ] && [ -n "$AVAILABLE_MEM" ]; then
    USED_PERCENT=$(( (TOTAL_MEM - AVAILABLE_MEM) * 100 / TOTAL_MEM ))
    if [ "$USED_PERCENT" -gt 90 ]; then
      log_warn "Memory usage: ${USED_PERCENT}% — application may be under memory pressure"
    else
      log_ok "Memory usage: ${USED_PERCENT}%"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "[$TIMESTAMP] Health check complete."

if [ "$HAS_FAILURE" = true ]; then
  # Exit with error code so cron can detect failures
  echo "[$TIMESTAMP] ⚠ One or more checks FAILED."

  # Optional: Send email alert if configured
  if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
    echo "SmartTicketQR health check failed at $TIMESTAMP" | mail -s "⚠ SmartTicketQR Health Alert" "$ALERT_EMAIL"
  fi

  exit 1
fi

exit 0
