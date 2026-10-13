---
title: Architecture
description: Overview of the data pipeline from sensors to dashboards, with services, ports and the role of each component.
sidebar:
  order: 10
---

LeoIoT collects room climate data (temperature, CO₂) and photovoltaic data (Solax) and shows them in several user interfaces. The services of the old stack are started via `legacy/docker-compose.yaml` and run as Docker containers (self-contained program packages) in the shared network `leoiot`. The main kiosk is a separate Compose project called `leoiot-pv` (`leoiot-pv/compose.yaml`) that attaches to the network of the old stack. Two terms in brief: Solax is the manufacturer of the PV inverter, and a kiosk is a full-screen display without interaction.

## Pipeline overview

1. **Sources** send measurements via MQTT to Mosquitto, the message broker: the real sensor boxes (programmed with ESPHome), the `fake-sensors` simulator, the Java generator `quarkus-app` and the `solax-collector` (PV data).
2. **Telegraf** (a data-transfer tool) listens to certain topics on Mosquitto and stores the values in the InfluxDB bucket `server_data` (a bucket is a storage area).
3. The `solax-collector` additionally writes the PV figures directly into InfluxDB over HTTP (measurement `solax_stats`).
4. **Grafana** and the web frontends read history from InfluxDB (using Flux, InfluxDB’s query language).
5. **Live path:** the `mqtt-ws-bridge` (a bridge between MQTT and the browser) receives the same measurements from Mosquitto and forwards them at once over a WebSocket (a connection that stays open to the browser). Live PV data additionally comes from an external PV broker (see `mqtt-ws-bridge` under “Role of the components”).

![Architecture: data flow from the sensors to the dashboards](../../../../assets/diagrams/architecture.en.svg)

The diagram does not yet show the main kiosk from `leoiot-pv/`.

:::note[Public paths]
A reverse proxy (Nginx; a router that sends each request to the right service) makes all interfaces reachable under one domain (configuration: `legacy/deploy/nginx.conf`). The paths are listed in the section [Nginx routing](../operations/#nginx-routing) of the Operations page.
:::

## Services

Ports as published in `legacy/docker-compose.yaml` and, for the main kiosk, in `leoiot-pv/compose.yaml`.

| Service | Port | Purpose |
|---|---|---|
| `mosquitto` | 1883 | MQTT broker (Eclipse Mosquitto), login required (`allow_anonymous false`) |
| `influxdb` | 8086 | Time-series database InfluxDB 2.7, organisation `leoiot`, bucket `server_data` |
| `telegraf` | – | Moves MQTT messages into InfluxDB (no published port) |
| `grafana` | 3000 | Dashboards; data source and dashboard are provisioned from `legacy/grafana/` |
| `frontend` | 8080 | 3D explorer (Vite dev server) |
| `dashboard-v2` | 8081 | Dashboard v2 (Vite dev server) |
| `kiosk` | 8082 | superseded: former kiosk variant (PV display); container is temporarily still running |
| `kiosk2` | 8083 | superseded: former kiosk variant (PV display); container is temporarily still running |
| `kiosk3` | 8084 | superseded: former kiosk variant (PV display); container is temporarily still running |
| `kiosk4` | 8085 | superseded: former kiosk variant (PV display); container is temporarily still running |
| `leogreen-kiosk` | 8087 | superseded: former LeoGreen kiosk; container is temporarily still running |
| `kiosk` (project `leoiot-pv`) | 8088 | Main kiosk (PV display) at `/kiosk/`, nginx image, listens on `127.0.0.1` only |
| `mqtt-ws-bridge` | 8090 | Bridge between MQTT and browser (WebSocket server); passes on live readings |
| `fake-sensors` | – | Simulator for room temperature and CO₂ |
| `quarkus-app` | – | Java generator (Quarkus), publishes via MQTT |
| `solax-collector` | – | Fetches PV data from the Solax cloud, writes to InfluxDB and MQTT |

## Role of the components

- **Mosquitto**: the central MQTT broker, i.e. the switchboard: sensors send messages to it, other services pick them up. `legacy/config/mosquitto.conf` accepts connections on port 1883 from the whole network and forbids anonymous connections.
- **Telegraf**: two MQTT consumers in `legacy/telegraf.conf`. The first reads topics `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` as a number (`data_format = "value"`, type `float`). The second reads `room-temperature` as JSON and stores the value under measurement `room_temperature` with tag `room`. Output: InfluxDB bucket `server_data`.
- **InfluxDB**: stores all measurements. Organisation `leoiot` and bucket `server_data` are created at first start (`DOCKER_INFLUXDB_INIT_*`).
- **Grafana**: the data source `InfluxDB-Flux` (Flux, default bucket `server_data`) and the dashboard `legacy/grafana/dashboards/main-dashboard.json` are loaded at start.
- **mqtt-ws-bridge** (`legacy/mqtt-ws-bridge/index.js`): connects to Mosquitto, keeps the latest temperature and CO₂ value per room and pushes changes to browsers that subscribed to that room. PV data goes to all connected clients. The bridge also connects over TLS to an external PV broker (host, port, user and password via `PV_MQTT_*`).
- **solax-collector** (`legacy/solax-collector/index.js`): polls the Solax cloud every minute, writes the figures as measurement `solax_stats` into InfluxDB and publishes the raw record to the topic `leoenergy/solax_pv/overall_inverter` (retained, i.e. the broker remembers the last value for new subscribers). `legacy/solax-collector/backfill.js` also exists but is not started in `legacy/docker-compose.yaml`.
- **fake-sensors** (`legacy/fake-sensors/index.js`): simulates 117 rooms (`roomsConfig`) with a daily cycle and occupancy, publishing every 10 seconds by default (`UPDATE_INTERVAL`).
- **quarkus-app** (`legacy/backend/sensor-data-generator`): Quarkus application whose `application.properties` configures the MQTT channels `sine` and `room-temperature` towards Mosquitto.
- **Frontends**: see the next section.

## Frontends and their status

| Frontend | Directory | Data sources in the code |
|---|---|---|
| 3D explorer | `legacy/frontend/` (`logic.js`) | Three.js building model; room values from InfluxDB (`room_temperature`, `mqtt_consumer`) and live via WebSocket |
| Dashboard v2 | `legacy/dashboard-v2/` (`dashboard.js`) | InfluxDB via `/influx`, live values via WebSocket `/ws`, PV data (measurement `solax_stats` and direct Solax cloud queries via `/solax/`), Chart.js charts, DE/EN language switch |
| Main kiosk | `leoiot-pv/kiosk/` (Vite, TypeScript, Vitest) | PV display at `/kiosk/`: queries via `POST /kiosk/api/query` to InfluxDB (the kiosk's nginx adds a read-only token, the browser gets none) and live values via WebSocket `/kiosk/ws`, then `/ws` |
| LeoGreen kiosk (superseded) | `legacy/leogreenKiosk/` (`kiosk.js`) | PV display: measurement `solax_stats` from InfluxDB plus live PV via WebSocket |
| Kiosk variants (superseded) | `legacy/kiosk/`, `legacy/kiosk2/`, `legacy/kiosk3/`, `legacy/kiosk4/` | PV display (`solax_stats`); only `legacy/kiosk/` also uses the WebSocket |

The 3D explorer (`frontend`) and Dashboard v2 display the room climate. Dashboard v2 also contains the PV view and a room table with status. The main kiosk from `leoiot-pv/kiosk/` at `/kiosk/` is the one shown in production; it attaches to the network of the old stack, which therefore has to be running. The former addresses `/leogreen/`, `/kiosk2/`, `/kiosk3/` and `/kiosk4/` redirect there. The five former kiosks (`kiosk` to `kiosk4` and `leogreenKiosk`) are superseded (a kiosk is a full-screen display without interaction).

:::note[Operation]
The frontends of the old stack run as Vite dev servers (`npm run dev`) in `node:20-alpine` containers; the main kiosk runs as a built image. Deployment and further limitations are described on the [Operations](../operations/) page.
:::

:::caution[Security]
The repository contains credentials and an InfluxDB token as default values in source code in several places (for example `legacy/docker-compose.yaml`, `legacy/mqtt-ws-bridge/index.js`, `legacy/solax-collector/index.js` and the frontends). These values are deliberately not reproduced here; they should be removed from the source code (e.g. into environment variables or secret stores) and replaced with new values. Further notes: [Operations](../operations/#known-limitations) page.
:::

## Sources in the repository

- `legacy/docker-compose.yaml`
- `legacy/telegraf.conf`
- `legacy/config/mosquitto.conf`
- `legacy/mqtt-ws-bridge/index.js`
- `legacy/solax-collector/index.js`
- `legacy/fake-sensors/index.js`
- `legacy/backend/sensor-data-generator/src/main/resources/application.properties`
- `legacy/grafana/provisioning/`, `legacy/grafana/dashboards/main-dashboard.json`
- `legacy/deploy/nginx.conf`
- `leoiot-pv/kiosk/`, `leoiot-pv/compose.yaml`, `leoiot-pv/.env.example`
- `legacy/frontend/logic.js`, `legacy/dashboard-v2/dashboard.js`, `legacy/leogreenKiosk/kiosk.js`, `legacy/kiosk/kiosk.js`, `legacy/kiosk2/kiosk2.js`, `legacy/kiosk3/kiosk3.js`, `legacy/kiosk4/kiosk4.js`
