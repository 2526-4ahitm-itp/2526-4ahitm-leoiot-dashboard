---
title: Interfaces
description: MQTT topics and payloads, the bridge WebSocket, InfluxDB data with a Flux example, Grafana dashboard, sensor box and CO₂ thresholds.
sidebar:
  order: 20
---

There is no REST API for sensor data. Data flows via MQTT, the bridge WebSocket and direct Flux queries against InfluxDB.

## MQTT topics

Broker: Mosquitto, port 1883, login required (`config/mosquitto.conf`).

| Topic | Payload | Producer | Evidence |
|---|---|---|---|
| `room-temperature` | JSON `{"room": "<room>", "temperature": <number>}` | `fake-sensors` (QoS 1), channel `room-temperature-out` in `quarkus-app` | `fake-sensors/index.js`, `application.properties` |
| `nili3/sensor/<room-lowercase>_co2/state` | plain number in ppm, e.g. `612.4` | `fake-sensors` (QoS 1) | `fake-sensors/index.js` |
| `nili3/sensor/nili3_co2/state`, `nili3/sensor/nili3_temperature/state` | plain number | real sensor box `nili3` (ESPHome); the bridge and Grafana evaluate these topics | `mqtt-ws-bridge/index.js`, `grafana/dashboards/main-dashboard.json` |
| `leoenergy/solax_pv/overall_inverter` | JSON raw record from the Solax cloud (`realtime_data` result), retained | `solax-collector` (and external PV broker) | `solax-collector/index.js` |
| `sine` | produced by the Quarkus generator (format not checked) | `quarkus-app` | `application.properties` |
| `co2/threshold/high`, `co2/threshold/middle` | number (CO₂ threshold in ppm) | subscribed to by the sensor box | `sensorbox/nili-ldr/nili-ldr.yaml` |

Room mapping examples in the bridge: `nili3/sensor/105_co2/state` becomes room `105`, `.../e10_co2/state` becomes `E10`, `.../1aula_co2/state` becomes `1Aula`; the sensor `nili3` is mapped to room `105`.

Telegraf (`telegraf.conf`) picks up:

- `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` as a number (`data_format = "value"`, `float`). In the frontends' Flux queries these appear as measurement `mqtt_consumer` with tag `topic` and field `value`.
- `room-temperature` as JSON with tag `room`, renamed to measurement `room_temperature` (field `temperature`, as queried in `frontend/logic.js`).

:::note
Solax data is additionally written by the `solax-collector` straight into InfluxDB over HTTP (measurement `solax_stats`, tag `plant_id`, fields `daily_yield`, `total_yield`, `consumption`, `daily_charged`, `daily_discharged`, `daily_imported`, `daily_exported`). The Solax record on MQTT does not pass through Telegraf.
:::

## Bridge WebSocket

- Server: `mqtt-ws-bridge`, port 8090 (variable `WS_PORT`). Reachable directly at `ws://<host>:8090`; behind the reverse proxy at path `/ws` (`deploy/nginx.conf`). The frontends use `:8090` locally and `/ws` otherwise (`wss:` on HTTPS).
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
| `{"type":"pv","data":{...}}` | PV data (Solax record plus `_ts`); sent to all clients without subscribing, a cached state is sent on connect |

`ts` is the timestamp (milliseconds) when the bridge received the value, not when the sensor measured it.

## InfluxDB

- Organisation `leoiot`, bucket `server_data` (`docker-compose.yaml`).
- Measurements used in the code: `mqtt_consumer` (tag `topic`, field `value`), `room_temperature` (tag `room`, field `temperature`), `solax_stats` (see above).
- The frontends reach InfluxDB through the path `/influx` (`fetch` to `/api/v2/query`, content type `application/vnd.flux`).

Example query (CO₂ history of one sensor; token as placeholder):

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

`grafana/dashboards/main-dashboard.json` is loaded via `grafana/provisioning/dashboards` (folder `Provisioned`). It contains one panel with a Flux query on `mqtt_consumer` for the topic `nili3/sensor/nili3_co2/state`. The data source `InfluxDB-Flux` is defined in `grafana/provisioning/datasources`. Grafana is served under `/grafana/` (`GF_SERVER_SERVE_FROM_SUB_PATH`).

## Sensor box and ESPHome

The configurations live in `sensorbox/` and send via MQTT (broker access through ESPHome `!secret`, not in the repository):

- `sensorbox/nili-ldr/nili-ldr.yaml` (device name `nili3`): temperature, pressure, humidity (BME280), illuminance (ADC), CO₂ (MH-Z19, sensor `nili3_CO2`), MH-Z19 temperature, motion, Wi-Fi signal. The LED indication follows the thresholds `co2/threshold/middle` and `co2/threshold/high` received via MQTT. MQTT discovery is switched off.
- `sensorbox/s3-mini-oled/s3_mini_oled.yaml` (device name `s3_mini_sensorbox`): SCD41 (CO₂, temperature, humidity), TSL2591 (light), LD2410 (presence), display, buzzer, backlight.
- Further variants: `sensorbox/blinking-leds/blink.yaml`, `sensorbox/original-config/`.

:::caution[Open]
The exact topic scheme of the ESPHome devices (default topic prefix) is not set explicitly in the YAML files. That `nili3/sensor/nili3_co2/state` comes from the box follows from the topics in the bridge and Grafana and the device name `nili3`. The values of the `co2/threshold/*` thresholds are not defined in the repository.
:::

## CO₂ thresholds in the code

| Location | Values |
|---|---|
| `dashboard-v2/dashboard.js` (room table) | OK up to 800 ppm; "Medium" above 800 up to 1000 ppm; "Alert" above 1000 ppm. Temperature outside 19 to 24 °C also yields "Alert". |
| `frontend/logic.js` (`getCO2Color`, 3D heatmap) | continuous gradient: 400 to 800 ppm dark green to light green, 800 to 1000 ppm yellow to orange, from 1000 ppm orange to red (fully red at 1700 ppm) |
| `dashboard-v2/dashboard.js` (CO₂ chart) | suggested axis range 400 to 1200 ppm (no traffic light) |

:::caution[Deviation from the specification]
`docs/functional-specification.md` (FR-07, AC-04) requires: green below 600 ppm, yellow from 600 to 1200 ppm, red above 1200 ppm. The code uses different values (800 and 1000 ppm; a continuous gradient in the 3D view). Which values should apply has to be clarified.
:::

## Sources in the repository

- `docker-compose.yaml`, `telegraf.conf`, `config/mosquitto.conf`
- `mqtt-ws-bridge/index.js`
- `fake-sensors/index.js`
- `solax-collector/index.js`
- `backend/sensor-data-generator/src/main/resources/application.properties`
- `grafana/provisioning/`, `grafana/dashboards/main-dashboard.json`
- `deploy/nginx.conf`
- `frontend/logic.js`, `dashboard-v2/dashboard.js`, `leogreenKiosk/kiosk.js`
- `sensorbox/nili-ldr/nili-ldr.yaml`, `sensorbox/s3-mini-oled/s3_mini_oled.yaml`
- `docs/functional-specification.md`
