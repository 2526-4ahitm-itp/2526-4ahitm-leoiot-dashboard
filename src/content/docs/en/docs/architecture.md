---
title: Architecture
description: Overview of the data pipeline from sensors to dashboards, with services, ports and the role of each component.
sidebar:
  order: 10
---

LeoIoT collects room climate data (temperature, CO₂) and photovoltaic data (Solax) and shows them in several user interfaces. All services are started via `docker-compose.yaml` and share the Docker network `leoiot`.

## Pipeline overview

1. **Sources** publish measurements to Mosquitto via MQTT: the real sensor boxes (ESPHome), the `fake-sensors` simulator, the Java generator `quarkus-app` and the `solax-collector` (PV data).
2. **Telegraf** subscribes to certain topics on Mosquitto and writes them to the InfluxDB bucket `server_data`.
3. The `solax-collector` additionally writes the PV figures directly into InfluxDB over HTTP (measurement `solax_stats`).
4. **Grafana** and the web frontends read history from InfluxDB (Flux queries).
5. **Live path:** the `mqtt-ws-bridge` subscribes to the same measurements on Mosquitto and forwards them to browsers over a WebSocket. Live PV data additionally comes from an external broker (see below).

```text
 Sensor boxes (ESPHome) --\
 fake-sensors ------------+--> Mosquitto (MQTT, :1883) --+--> Telegraf --> InfluxDB (:8086)
 quarkus-app -------------/            |                  |                  |   ^
                                       |                  |                  |   |
 Solax Cloud --> solax-collector ------+--(MQTT)          |                  |   +-- solax-collector
                       |                                                     |       (HTTP write, solax_stats)
                       +-----------------------------------------------------+
                                       |                                     |
                                       v                                     v
                               mqtt-ws-bridge (:8090)               Grafana (:3000)
                                       |  WebSocket                 Frontends (Flux queries
                                       v                             via path /influx)
                         Browser: 3D explorer, Dashboard v2, Kiosk
```

:::note
The reverse proxy config `deploy/nginx.conf` publishes the services under one domain: `/grafana/`, `/influx/`, `/ws` (WebSocket to the bridge), `/dashboard/`, `/kiosk/`, `/kiosk2/` to `/kiosk4/`, `/leogreen/`, `/solax/` (proxy to the Solax cloud API) and `/` (3D explorer, port 8080).
:::

## Services

Ports as published in `docker-compose.yaml`.

| Service | Port | Purpose |
|---|---|---|
| `mosquitto` | 1883 | MQTT broker (Eclipse Mosquitto), login required (`allow_anonymous false`) |
| `influxdb` | 8086 | Time-series database InfluxDB 2.7, organisation `leoiot`, bucket `server_data` |
| `telegraf` | - | Moves MQTT messages into InfluxDB (no published port) |
| `grafana` | 3000 | Dashboards; data source and dashboard are provisioned from `grafana/` |
| `frontend` | 8080 | 3D explorer (Vite dev server) |
| `dashboard-v2` | 8081 | Dashboard v2 (Vite dev server) |
| `kiosk` | 8082 | Kiosk variant (PV display) |
| `kiosk2` | 8083 | Kiosk variant (PV display) |
| `kiosk3` | 8084 | Kiosk variant (PV display) |
| `kiosk4` | 8085 | Kiosk variant (PV display) |
| `leogreen-kiosk` | 8087 | LeoGreen kiosk (PV display with live data via the bridge) |
| `mqtt-ws-bridge` | 8090 | WebSocket server relaying live MQTT values to browsers |
| `fake-sensors` | - | Simulator for room temperature and CO₂ |
| `quarkus-app` | - | Java generator (Quarkus), publishes via MQTT |
| `solax-collector` | - | Fetches PV data from the Solax cloud, writes to InfluxDB and MQTT |

## Role of the components

- **Mosquitto**: central broker. `config/mosquitto.conf` listens on port 1883 on all interfaces and forbids anonymous connections.
- **Telegraf**: two MQTT consumers in `telegraf.conf`. The first reads topics `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` as a number (`data_format = "value"`, type `float`). The second reads `room-temperature` as JSON and stores the value under measurement `room_temperature` with tag `room`. Output: InfluxDB bucket `server_data`.
- **InfluxDB**: stores all measurements. Organisation `leoiot` and bucket `server_data` are created at first start (`DOCKER_INFLUXDB_INIT_*`).
- **Grafana**: the data source `InfluxDB-Flux` (Flux, default bucket `server_data`) and the dashboard `grafana/dashboards/main-dashboard.json` are loaded at start.
- **mqtt-ws-bridge** (`mqtt-ws-bridge/index.js`): connects to Mosquitto, keeps the latest temperature and CO₂ value per room and pushes changes to browsers that subscribed to that room. PV data goes to all connected clients. The bridge also connects over TLS to an external PV broker (host, port, user and password via `PV_MQTT_*`).
- **solax-collector** (`solax-collector/index.js`): polls the Solax cloud every minute, writes the figures as measurement `solax_stats` into InfluxDB and publishes the raw record to `leoenergy/solax_pv/overall_inverter` (retained). `solax-collector/backfill.js` also exists but is not started in `docker-compose.yaml`.
- **fake-sensors** (`fake-sensors/index.js`): simulates over 100 rooms (`roomsConfig`) with a daily cycle and occupancy, publishing every 10 seconds by default (`UPDATE_INTERVAL`).
- **quarkus-app** (`backend/sensor-data-generator`): Quarkus application whose `application.properties` configures the MQTT channels `sine` and `room-temperature` towards Mosquitto.
- **Frontends**: see the next section.

## Frontends and which ones are current

| Frontend | Directory | Data sources in the code |
|---|---|---|
| 3D explorer | `frontend/` (`logic.js`) | Three.js building model; room values from InfluxDB (`room_temperature`, `mqtt_consumer`) and live via WebSocket |
| Dashboard v2 | `dashboard-v2/` (`dashboard.js`) | InfluxDB via `/influx`, live values via WebSocket `/ws`, PV data, Chart.js charts, DE/EN language switch |
| Kiosk (LeoGreen) | `leogreenKiosk/` (`kiosk.js`) | PV display: measurement `solax_stats` from InfluxDB plus live PV via WebSocket |
| Kiosk variants | `kiosk/`, `kiosk2/`, `kiosk3/`, `kiosk4/` | PV display (`solax_stats`); only `kiosk/` also uses the WebSocket |

What can be derived from the code: the 3D explorer (`frontend`) and Dashboard v2 are the room climate interfaces. Dashboard v2 also contains a PV view and a room table with status. The LeoGreen kiosk is the variant that explicitly depends on the bridge in `docker-compose.yaml`.

:::caution[Open]
The repository does not make clear which of the four kiosk variants (`kiosk` to `kiosk4`) and the LeoGreen kiosk is shown in production and which are outdated. All are listed in `docker-compose.yaml` and `deploy/nginx.conf`. The team has to clarify this.
:::

:::caution[Open]
In the compose setup the frontends run as Vite dev servers (`npm run dev`) in `node:20-alpine` containers; whether a separate production build exists for operation is not visible in the files read.
:::

:::caution[Security]
The repository contains credentials and an InfluxDB token as default values in source code in several places (for example `docker-compose.yaml`, `mqtt-ws-bridge/index.js`, `solax-collector/index.js` and the frontends). These values are deliberately not reproduced here; they should be moved to environment variables or secrets and rotated.
:::

## Sources in the repository

- `docker-compose.yaml`
- `telegraf.conf`
- `config/mosquitto.conf`
- `mqtt-ws-bridge/index.js`
- `solax-collector/index.js`
- `fake-sensors/index.js`, `fake-sensors/README.md`
- `backend/sensor-data-generator/src/main/resources/application.properties`
- `grafana/provisioning/`, `grafana/dashboards/main-dashboard.json`
- `deploy/nginx.conf`
- `frontend/logic.js`, `dashboard-v2/dashboard.js`, `leogreenKiosk/kiosk.js`, `kiosk/kiosk.js`, `kiosk2/kiosk2.js`, `kiosk3/kiosk3.js`, `kiosk4/kiosk4.js`
