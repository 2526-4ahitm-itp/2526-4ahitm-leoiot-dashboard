#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/influxdb-backups"
DATE=$(date +%Y-%m-%d)
TOKEN="ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A=="
KEEP_WEEKS=8

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup $DATE..."

docker exec influxdb influx backup \
  --token "$TOKEN" \
  "/backups/$DATE"

docker cp "influxdb:/backups/$DATE" "$BACKUP_DIR/$DATE"

# Prune old backups, keep last KEEP_WEEKS
ls -dt "$BACKUP_DIR"/*/  | tail -n +$((KEEP_WEEKS + 1)) | xargs -r rm -rf

echo "[$(date)] Backup $DATE completed. Kept last $KEEP_WEEKS backups."
