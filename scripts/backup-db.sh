#!/usr/bin/env bash
# ============================================================
# SmartTicketQR — SQLite Database Backup Script
# ============================================================
# Creates timestamped backups of the SQLite database files.
# Designed to be run via cron (e.g., every 6 hours).
#
# Usage: ./scripts/backup-db.sh
# Cron:  0 */6 * * * /app/scripts/backup-db.sh >> /var/log/backup-db.log 2>&1
#
# Rotation: Keeps 7 daily, 4 weekly, 6 monthly backups.
# ============================================================

set -euo pipefail

# ---- Configuration ----
DB_DIR="${DB_DIR:-./db}"
BACKUP_DIR="${BACKUP_DIR:-./backups/db}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday
DAY_OF_MONTH=$(date +%d)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

echo "[$(date -Iseconds)] Starting database backup..."

# ---- Find database files ----
DB_FILES=$(find "$DB_DIR" -name "*.db" -o -name "*.db-journal" -o -name "*.db-wal" -o -name "*.db-shm" 2>/dev/null || true)

if [ -z "$DB_FILES" ]; then
    echo "[$(date -Iseconds)] WARNING: No database files found in $DB_DIR"
    exit 0
fi

# ---- Create backup using SQLite online backup API (hot backup) ----
BACKUP_FILE="$BACKUP_DIR/daily/smartticketqr_$TIMESTAMP.db"

# Use sqlite3 if available for a proper backup (safer than file copy)
if command -v sqlite3 &>/dev/null; then
    for db_file in $DB_FILES; do
        # Skip journal/wal/shm files - only backup .db files
        case "$db_file" in
            *.db)
                DB_NAME=$(basename "$db_file")
                sqlite3 "$db_file" ".backup '$BACKUP_DIR/daily/${DB_NAME%.db}_$TIMESTAMP.db'"
                echo "[$(date -Iseconds)] Backed up: $db_file -> $BACKUP_DIR/daily/${DB_NAME%.db}_$TIMESTAMP.db"
                ;;
        esac
    done
else
    # Fallback: use file copy with advisory lock
    for db_file in $DB_FILES; do
        case "$db_file" in
            *.db)
                DB_NAME=$(basename "$db_file")
                cp "$db_file" "$BACKUP_DIR/daily/${DB_NAME%.db}_$TIMESTAMP.db"
                echo "[$(date -Iseconds)] Copied: $db_file -> $BACKUP_DIR/daily/${DB_NAME%.db}_$TIMESTAMP.db"
                ;;
        esac
    done
fi

# ---- Rotation ----

# Daily: keep last 7 days
echo "[$(date -Iseconds)] Rotating daily backups (keeping last 7)..."
find "$BACKUP_DIR/daily" -name "*.db" -type f -mtime +7 -delete 2>/dev/null || true
DAILY_COUNT=$(find "$BACKUP_DIR/daily" -name "*.db" -type f | wc -l)
echo "[$(date -Iseconds)] Daily backups: $DAILY_COUNT"

# Weekly: keep if Monday, last 4 weeks
if [ "$DAY_OF_WEEK" = "1" ]; then
    echo "[$(date -Iseconds)] Creating weekly backup..."
    cp "$BACKUP_FILE" "$BACKUP_DIR/weekly/smartticketqr_weekly_$TIMESTAMP.db"
    find "$BACKUP_DIR/weekly" -name "*.db" -type f -mtime +28 -delete 2>/dev/null || true
fi

# Monthly: keep if 1st of month, last 6 months
if [ "$DAY_OF_MONTH" = "01" ]; then
    echo "[$(date -Iseconds)] Creating monthly backup..."
    cp "$BACKUP_FILE" "$BACKUP_DIR/monthly/smartticketqr_monthly_$TIMESTAMP.db"
    find "$BACKUP_DIR/monthly" -name "*.db" -type f -mtime +180 -delete 2>/dev/null || true
fi

# ---- Summary ----
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "[$(date -Iseconds)] Backup complete. Total backup size: $TOTAL_SIZE"
echo "[$(date -Iseconds)] Done."
