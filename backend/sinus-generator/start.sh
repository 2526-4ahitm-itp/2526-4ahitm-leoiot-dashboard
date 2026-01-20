#!/usr/bin/env bash
set -e

TELEGRAF_DIR="/etc/telegraf/telegraf.d"
TELEGRAF_CONF="$TELEGRAF_DIR/mqtt-sine.conf"

echo "=== Ensuring Telegraf config directory exists ==="
if [ ! -d "$TELEGRAF_DIR" ]; then
  sudo mkdir -p "$TELEGRAF_DIR"
fi

echo "=== Writing Telegraf MQTT config ==="
sudo tee "$TELEGRAF_CONF" > /dev/null <<'EOF'
[agent]
  interval = "1s"
  round_interval = true

[[inputs.mqtt_consumer]]
  servers = ["tcp://127.0.0.1:1883"]
  topics = ["sine"]

  data_format = "value"
  data_type = "float"

  name_override = "sine"

[[outputs.influxdb_v2]]
  urls = ["http://127.0.0.1:8086"]
  token = "ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A=="
  organization = "leoiot"
  bucket = "server_data"

  namepass = ["sine"]
EOF

echo "=== Starting Mosquitto (MQTT broker) ==="
mosquitto -v -p 1883 &

sleep 1

echo "=== Starting InfluxDB (2.x) ==="
influxd &

sleep 3

echo "=== Restarting Telegraf ==="
sudo systemctl restart telegraf

echo "=== Starting Grafana ==="
sudo systemctl start grafana.service

sleep 2

echo "=== Starting Quarkus (MQTT publisher) ==="
mvn clean quarkus:dev
