#!/bin/bash
set -euo pipefail

# Usage: ./restore.sh <YYYY-MM-DD>
# Example: ./restore.sh 2026-05-04

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <YYYY-MM-DD>"
  echo "Available backups:"
  ls "$HOME/influxdb-backups/"
  exit 1
fi

DATE=$1
BACKUP_DIR="$HOME/influxdb-backups"
TOKEN="ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A=="

if [ ! -d "$BACKUP_DIR/$DATE" ]; then
  echo "Backup $DATE not found in $BACKUP_DIR"
  exit 1
fi

echo "[$(date)] Restoring backup $DATE..."

docker cp "$BACKUP_DIR/$DATE" "influxdb:/backups/restore-$DATE"

docker exec influxdb influx restore \
  --token "$TOKEN" \
  --full \
  "/backups/restore-$DATE"

echo "[$(date)] Restore $DATE completed."
