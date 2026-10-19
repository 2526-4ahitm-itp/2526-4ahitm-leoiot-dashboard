---
title: Interfaces
description: MQTT topics and payloads, the bridge WebSocket, InfluxDB data with a Flux example, Grafana dashboard, sensor box and CO₂ thresholds.
sidebar:
  order: 20
---

There is no classic web interface (REST API) for sensor data. Data flows via MQTT (a lightweight messaging protocol for sensors), via the bridge WebSocket (the `mqtt-ws-bridge` program, which passes readings from MQTT on to the browser) and via direct Flux queries against InfluxDB (see [Architecture](../architecture/) for the terms).

## MQTT topics

Broker (message relay): Mosquitto, port 1883, login required (`legacy/config/mosquitto.conf`).

A topic is the “mailbox” name of an MQTT message, the payload is its content, QoS is the delivery guarantee (1 = at least once).

| Topic | Payload | Producer | Source file |
|---|---|---|---|
| `room-temperature` | JSON `{"room": "<room>", "temperature": <number>}` | `fake-sensors` (QoS 1), channel `room-temperature-out` in `quarkus-app` | `legacy/fake-sensors/index.js`, `application.properties` |
| `nili3/sensor/<room-lowercase>_co2/state` | number as text in ppm (parts per million), e.g. `612.4` | `fake-sensors` (QoS 1) | `legacy/fake-sensors/index.js` |
| `nili3/sensor/nili3_co2/state`, `nili3/sensor/nili3_temperature/state` | number as text | real sensor box `nili3` (ESPHome); the bridge and Grafana evaluate these topics | `legacy/mqtt-ws-bridge/index.js`, `legacy/grafana/dashboards/main-dashboard.json` |
| `leoenergy/solax_pv/overall_inverter` | JSON raw record from the Solax cloud (Solax: manufacturer of the PV system inverter) (`realtime_data` result), retained (the broker remembers the last value for new subscribers) | collector from `leoiot-pv/collector/` (and external PV broker) | `leoiot-pv/collector/src/main.ts` |
| `sine` | number as text (sine wave, every second), test channel of the Quarkus generator (Quarkus is a Java framework) | `quarkus-app` | `application.properties` |
| `co2/threshold/high`, `co2/threshold/middle` | number (CO₂ threshold in ppm) | subscribed to by the sensor box | `legacy/sensorbox/nili-ldr/nili-ldr.yaml` |

Example: from the topic `nili3/sensor/105_co2/state` the bridge derives room `105`, from `.../e10_co2/state` room `E10`, from `.../1aula_co2/state` room `1Aula`. The real sensor box `nili3` belongs to room `105`.

Telegraf (`legacy/telegraf.conf`) is the program that transfers MQTT messages into the database. Telegraf reads two groups of topics:

- `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` as a number (`data_format = "value"`, `float`). In the frontends' Flux queries these appear as measurement `mqtt_consumer` with tag `topic` and field `value`.
- `room-temperature` as JSON with tag `room`, renamed to measurement `room_temperature` (field `temperature`, as queried in `legacy/frontend/logic.js`).

:::note
Solax data is additionally written by the collector from `leoiot-pv/collector/` straight into InfluxDB over HTTP (measurement `solax_stats`, tag `plant_id`, fields `daily_yield`, `total_yield`, `consumption`, `daily_charged`, `daily_discharged`, `daily_imported`, `daily_exported`). The Solax record on MQTT does not pass through Telegraf.
:::

## Bridge WebSocket

A WebSocket is a permanent connection between browser and bridge; the browser receives new values immediately without asking. A snapshot is the last known state, sent right after subscribing.

- Server: `mqtt-ws-bridge`, port 8090 (variable `WS_PORT`). Reachable directly at `ws://<host>:8090`; behind the reverse proxy (Nginx, which bundles all services under one address) at path `/ws` (`legacy/deploy/nginx.conf`). The main kiosk (`leoiot-pv/kiosk/`) connects via `/kiosk/ws` first (its own nginx passes the WebSocket on to the bridge) and via `/ws` afterwards. Dashboard v2 uses `:8090` locally (`localhost`, `127.0.0.1`) and `/ws` otherwise (`wss:` on HTTPS); the 3D explorer always connects via `/ws` and therefore needs the Nginx proxy or a Vite proxy (Vite is the frontends' development server). The superseded kiosks connected as follows: the LeoGreen kiosk like Dashboard v2, `legacy/kiosk/` always via `/ws`.
- Messages are JSON objects.

Client to server:

| Message | Effect |
|---|---|
| `{"type":"subscribe","room":"105"}` | subscribe to a room; reply `subscribed` and a snapshot of the latest values |
| `{"type":"unsubscribe","room":"105"}` | end the subscription (reply `unsubscribed`) |
| `{"type":"unsubscribeAll"}` | end all subscriptions (reply `unsubscribedAll`) |

Server to client:

| Message | Content |
|---|---|
| `{"type":"hello","wsPort":8090}` | right after connecting |
| `{"type":"temp","room":"105","value":21.2,"ts":<ms>}` | temperature; snapshots additionally carry `"snapshot":true` |
| `{"type":"co2","room":"105","value":640,"ts":<ms>}` | CO₂ in ppm; snapshots additionally carry `"snapshot":true` |
| `{"type":"pv","data":{...}}` | PV (photovoltaics) data (Solax record plus `_ts`); sent to all clients without subscribing, a cached state is sent on connect |

`ts` is the timestamp (milliseconds) when the bridge received the value, not when the sensor measured it.

## InfluxDB

- Organisation `leoiot`, bucket `server_data` (`legacy/docker-compose.yaml`).
- Measurements used in the code: `mqtt_consumer` (tag `topic`, field `value`), `room_temperature` (tag `room`, field `temperature`), `solax_stats` (see above).
- The frontends of the old stack query InfluxDB through the path `/influx` (`/api/v2/query`). Flux is InfluxDB's query language.
- The main kiosk queries via `POST /kiosk/api/query`. Its nginx passes the request on to InfluxDB and adds a read-only token from the environment variable `KIOSK_INFLUX_TOKEN`; the token stays on the server and the browser never receives it.
- For `server_data` there is, besides the admin token, a read-only token and a write-only token (for the PV team). The values are not part of the documentation.

The example below fetches the CO₂ history of one sensor for the last 24 hours as 10-minute averages (token is a placeholder):

```bash
curl -s -X POST "http://<HOST>:8086/api/v2/query?org=leoiot" \
  -H "Authorization: Token <TOKEN>" \
  -H "Content-Type: application/vnd.flux" \
  -H "Accept: application/csv" \
  --data 'from(bucket: "server_data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "mqtt_consumer")
  |> filter(fn: (r) => r.topic == "nili3/sensor/nili3_co2/state")
  |> filter(fn: (r) => r._field == "value")
  |> aggregateWindow(every: 10m, fn: mean, createEmpty: false)'
```

## Grafana dashboard

Grafana is a tool for charts. The dashboard is stored as the file `legacy/grafana/dashboards/main-dashboard.json` in the repository and loaded automatically at start (provisioning via `legacy/grafana/provisioning/dashboards`, folder `Provisioned`). It contains one panel with a Flux query on `mqtt_consumer` for the topic `nili3/sensor/nili3_co2/state`. The data source `InfluxDB-Flux` is defined in `legacy/grafana/provisioning/datasources`. Grafana is served under `/grafana/` (`GF_SERVER_SERVE_FROM_SUB_PATH`).

## Sensor box and ESPHome

ESPHome is software that programs the sensor box through a configuration file. The codes (BME280, MH-Z19, etc.) are the model names of the sensor chips used.

The `nili-ldr` and `s3-mini-oled` configurations live in `legacy/sensorbox/` and send via MQTT (broker access through ESPHome `!secret`, not in the repository):

- `legacy/sensorbox/nili-ldr/nili-ldr.yaml` (device name `nili3`): temperature, pressure, humidity (BME280), illuminance (ADC), CO₂ (MH-Z19, sensor `nili3_CO2`), MH-Z19 temperature, motion, Wi-Fi signal. The LED indication follows the thresholds `co2/threshold/middle` and `co2/threshold/high` received via MQTT. MQTT discovery is switched off.
- `legacy/sensorbox/s3-mini-oled/s3_mini_oled.yaml` (device name `s3_mini_sensorbox`): SCD41 (CO₂, temperature, humidity), TSL2591 (light), LD2410 (presence), display, buzzer, backlight.
- Further variants: `legacy/sensorbox/blinking-leds/blink.yaml`, `legacy/sensorbox/original-config/` (older configurations).

## CO₂ thresholds in the code

| Location | Values |
|---|---|
| `legacy/dashboard-v2/dashboard.js` (room table) | OK up to 800 ppm; “Medium” above 800 up to 1000 ppm; “Alert” above 1000 ppm. Temperature outside 19 to 24 °C also yields “Alert”. |
| `legacy/frontend/logic.js` (`getCO2Color`, heatmap in the 3D model) | continuous gradient: 400 to 800 ppm dark green to light green, 800 to 1000 ppm yellow to orange, from 1000 ppm orange to red (fully red at 1700 ppm) |
| `legacy/dashboard-v2/dashboard.js` (CO₂ chart) | suggested axis range 400 to 1200 ppm (no traffic light) |

:::note[Note on differing values]
The code and the slides use 800 and 1000 ppm. The functional specification (`docs/functional-specification.md`, requirement FR-07, acceptance criterion AC-04) states 600 and 1200 ppm; the web interfaces do not implement these values. Only the LED of the `nili3` sensor box starts with exactly these default thresholds (`legacy/sensorbox/nili-ldr/nili-ldr.yaml`) until new values arrive via MQTT.
:::

## Sources in the repository

- `legacy/docker-compose.yaml`, `legacy/telegraf.conf`, `legacy/config/mosquitto.conf`
- `legacy/mqtt-ws-bridge/index.js`
- `legacy/fake-sensors/index.js`
- `leoiot-pv/collector/src/main.ts`
- `legacy/backend/sensor-data-generator/src/main/resources/application.properties`
- `legacy/grafana/provisioning/`, `legacy/grafana/dashboards/main-dashboard.json`
- `legacy/deploy/nginx.conf`
- `leoiot-pv/kiosk/`
- `legacy/frontend/logic.js`, `legacy/dashboard-v2/dashboard.js`
- `legacy/sensorbox/nili-ldr/nili-ldr.yaml`, `legacy/sensorbox/s3-mini-oled/s3_mini_oled.yaml`
- `docs/functional-specification.md`
