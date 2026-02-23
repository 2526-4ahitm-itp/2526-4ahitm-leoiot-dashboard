##!/usr/bin/env bash
#
#echo "=== Stopping Quarkus (if running) ==="
#pkill -f quarkus || true
#
#echo "=== Stopping Mosquitto ==="
#pkill -f mosquitto || true
#
#echo "=== Stopping InfluxDB ==="
#pkill -f influxd || true
#
#echo "=== Stopping Telegraf ==="
#sudo systemctl stop telegraf
#
#echo "=== Stopping Grafana ==="
#sudo systemctl stop grafana.service
#
#echo "=== All services stopped ==="

docker compose stop