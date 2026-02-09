#!/usr/bin/env bash
set -e

BREW_PREFIX=$(brew --prefix)
TELEGRAF_DIR="$BREW_PREFIX/etc/telegraf.d"
TELEGRAF_CONF="$TELEGRAF_DIR/mqtt-sine.conf"

echo "=== Ensuring Telegraf config directory exists ==="
mkdir -p "$TELEGRAF_DIR"

echo "=== Writing Telegraf MQTT config ==="
cat <<EOF > "$TELEGRAF_CONF"
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
EOF

echo "=== Starting Services ==="

# Mosquitto starten
brew services restart mosquitto

# InfluxDB starten (Falls brew service fehlschlägt, manuell im Hintergrund)
if brew services start influxdb 2>/dev/null; then
    echo "InfluxDB started via Brew"
else
    echo "Brew service failed, starting influxd manually..."
    nohup influxd > /dev/null 2>&1 &
fi

# Grafana starten
brew services restart grafana

# Telegraf starten (Telegraf braucht oft die Haupt-Config + dein Verzeichnis)
brew services restart telegraf

echo "=== Waiting for services to settle (5s) ==="
sleep 5

echo "=== Starting Quarkus ==="
mvn clean quarkus:dev