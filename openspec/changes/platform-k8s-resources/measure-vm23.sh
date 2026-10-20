#!/usr/bin/env bash
# Collects the figures for the Kubernetes resource request (design.md, D3).
# Read-only: needs Docker access, no database token, changes nothing.
#
# Usage on vm23:
#   nohup ./measure-vm23.sh 24h > measure.log 2>&1 &
#   ./measure-vm23.sh 10m            # short trial run
# Duration: seconds, or a number followed by m or h (default 24h).
# Output: ./measure-<timestamp>/sizes.txt (once) and stats.csv (every 60 s).
set -euo pipefail

duration=${1:-24h}
interval=60
influx_container=${INFLUX_CONTAINER:-influxdb}
backup_dir=${BACKUP_DIR:-$HOME/influxdb-backups}

case $duration in
  *h) seconds=$(( ${duration%h} * 3600 )) ;;
  *m) seconds=$(( ${duration%m} * 60 )) ;;
  *[!0-9]*|'') echo "invalid duration: $duration (use e.g. 3600, 30m or 24h)" >&2; exit 1 ;;
  *) seconds=$duration ;;
esac

out="measure-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"
sizes="$out/sizes.txt"

section() { printf '\n===== %s =====\n' "$1" >> "$sizes"; }

{
  echo "host: $(hostname)  date: $(date -Iseconds)"
  echo "cpus: $(nproc)  $(free -m | awk '/^Mem:/ {print "memory total/used MiB: " $2 "/" $3}')"
} > "$sizes"

section "containers"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' >> "$sizes"

section "host disk"
df -h / "$HOME" /var/lib/docker >> "$sizes" 2>/dev/null || true

section "docker disk use (images, containers, volumes)"
docker system df -v >> "$sizes" 2>&1 || true

section "influxdb data per bucket (directory = bucket id; the largest is server_data)"
if ! docker inspect "$influx_container" > /dev/null 2>&1; then
  echo "container $influx_container not found; set INFLUX_CONTAINER" >> "$sizes"
fi
docker exec "$influx_container" sh -c 'du -sh /var/lib/influxdb2/engine/data/* /var/lib/influxdb2/engine/wal' >> "$sizes" 2>&1 || true

section "influxdb shards: size per shard (ids grow with time; time ranges in the tsm report below)"
docker exec "$influx_container" sh -c 'du -sk /var/lib/influxdb2/engine/data/*/autogen/*/' >> "$sizes" 2>&1 || true

section "influxdb tsm report (min/max time and series per shard file)"
docker exec "$influx_container" influxd inspect report-tsm --data-path /var/lib/influxdb2/engine/data >> "$sizes" 2>&1 || echo "report-tsm not available" >> "$sizes"

section "backups in $backup_dir"
if [ -d "$backup_dir" ]; then
  du -sh "$backup_dir"/* >> "$sizes" 2>&1 || true
  ls -l --full-time "$backup_dir" >> "$sizes"
else
  echo "no backup directory" >> "$sizes"
fi

echo "sizes written to $sizes; sampling docker stats every ${interval}s for ${seconds}s into $out/stats.csv"

echo "time;container;cpu_percent;mem_usage;mem_percent;net_io;block_io;pids" > "$out/stats.csv"
end=$(( $(date +%s) + seconds ))
while [ "$(date +%s)" -lt "$end" ]; do
  now=$(date -Iseconds)
  docker stats --no-stream --format '{{.Name}};{{.CPUPerc}};{{.MemUsage}};{{.MemPerc}};{{.NetIO}};{{.BlockIO}};{{.PIDs}}' \
    | sed "s|^|$now;|" >> "$out/stats.csv"
  sleep "$interval"
done

echo "done: $out"
