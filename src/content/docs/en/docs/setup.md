---
title: Setup
description: Prerequisites, starting the platform unit in leoiot-platform/, the old stack in legacy/ and the main kiosk in leoiot-pv/ with Docker Compose, ports, required files and local development.
sidebar:
  order: 30
---

This page describes how to start the platform unit in `leoiot-platform/` (broker and shared network), the old stack in `legacy/` and, in addition, the main kiosk in `leoiot-pv/` locally. Docker Compose (a tool for starting several containers together) starts the services of a stack with one command.

## Prerequisites

- Docker with the Compose plugin (start via `docker compose`).
- The Node services (JavaScript programs) run in containers (`node:20-alpine`) and install their libraries themselves at start (`npm install`). Node therefore does not have to be installed on your own computer.
- The `quarkus-app` service is built from `legacy/backend/sensor-data-generator` using its Dockerfile (`src/main/docker/Dockerfile`).
- The `mosquitto` service (in `leoiot-platform/`) needs the files `leoiot-platform/broker/pwfile` and `leoiot-platform/broker/acl` (see below).

## Start

```bash
# first in the leoiot-platform/ folder: broker and shared network
docker compose up -d

# then in the legacy/ folder of the repository
docker compose up -d
```

Without `-d` the logs stay in the foreground. Logs of one service: `docker compose logs -f dashboard-v2`; stop: `docker compose down`.

The platform unit (`leoiot-platform/compose.yaml`) starts the broker `mosquitto` (`eclipse-mosquitto:2.0.22`) and creates the shared network `2526-4ahitm-leoiot-dashboard_leoiot`. In `legacy/`, Compose starts these services (all on that network, which the old stack joins as an external one):

| Service | Image / source | Purpose |
|---|---|---|
| `influxdb` | `influxdb:2.7` | Time-series database (setup mode on first start) |
| `telegraf` | `telegraf:latest` | Reads MQTT topics and writes to InfluxDB (`legacy/telegraf.conf`) |
| `grafana` | `grafana/grafana:latest` | Dashboards (provisioning from `legacy/grafana/`) |
| `quarkus-app` | Build from `legacy/backend/sensor-data-generator` | Sensor data generator (publishes e.g. `sine`, `room-temperature`) |
| `frontend` | `node:20-alpine`, `./frontend` | 3D explorer (Vite dev server) |
| `dashboard-v2` | `node:20-alpine`, `./dashboard-v2` | Dashboard (room climate and PV, Vite dev server) |
| `mqtt-ws-bridge` | `node:20-alpine`, `./mqtt-ws-bridge` | Bridge: passes MQTT readings on to the browser via WebSocket |
| `fake-sensors` | `node:20-alpine`, `./fake-sensors` | Simulated sensors for testing |

## Ports

| Port | Service |
|---|---|
| 1883 | Mosquitto (MQTT, `leoiot-platform/`) |
| 9001 | Mosquitto (MQTT over WebSocket, on `127.0.0.1` only; reachable from outside at `/mqtt` through nginx) |
| 8086 | InfluxDB |
| 3000 | Grafana |
| 8080 | `frontend` (3D explorer) |
| 8081 | `dashboard-v2` |
| 8088 | Main kiosk (`leoiot-pv/`, on `127.0.0.1` only) |
| 8090 | `mqtt-ws-bridge` (WebSocket) |

`quarkus-app`, `telegraf` and `fake-sensors` publish no ports.

## Main kiosk

The main kiosk lives in `leoiot-pv/kiosk/` and runs as its own Compose project `leoiot-pv` (`leoiot-pv/compose.yaml`). It attaches to the shared network (`2526-4ahitm-leoiot-dashboard_leoiot`), which the platform unit creates; the platform unit therefore has to be running.

```bash
# in the leoiot-pv/ folder of the repository
cp .env.example .env
# enter the read-only InfluxDB token in .env (KIOSK_INFLUX_TOKEN)
docker compose up -d --build
```

Afterwards the kiosk is reachable at `http://localhost:8088/kiosk/`. The read token stays in the kiosk's nginx; the browser does not receive it.

For development (Node 20 or newer):

```bash
cd leoiot-pv/kiosk
npm ci
npm run dev
```

The tests run with `npm test`. How to start the kiosk with sample data and no data source (mock mode, `KIOSK_MOCK`) is described in `leoiot-pv/kiosk/README.md`.

## Required files and variables

| Name | Where | Meaning |
|---|---|---|
| `leoiot-platform/broker/mosquitto.conf` | in the repository | Listener 1883 with accounts only (`pwfile`, `acl`); listener 9001 (WebSocket) anonymous and read-only on `leoiot/room-climate/#` (`acl-websocket`) |
| `leoiot-platform/broker/pwfile` | **not** in the repository (`.gitignore`) | Broker password file |
| `leoiot-platform/broker/acl` | **not** in the repository (`.gitignore`) | Access rules of the accounts; shape in `acl.example` |
| `legacy/telegraf.conf` | in the repository | MQTT credentials (user/password) and InfluxDB token; the values are not given here for security reasons |
| `MQTT_HOST` | Compose environment of `quarkus-app`, `fake-sensors`, `mqtt-ws-bridge` | Broker hostname (`mosquitto` on the Compose network) |
| `MQTT_PORT`, `UPDATE_INTERVAL` | optional, `fake-sensors` | Broker port (default 1883), publish interval in ms (default 10000) |
| `WS_PORT` | `mqtt-ws-bridge` | WebSocket bridge port (8090 in Compose) |
| `PV_MQTT_HOST`, `PV_MQTT_PORT`, `PV_MQTT_USER`, `PV_MQTT_PASS` | `mqtt-ws-bridge` | Access to an external MQTT broker (photovoltaics) |
| `COLLECTOR_SOLAX_CLIENT_ID`, `COLLECTOR_SOLAX_CLIENT_SECRET`, `COLLECTOR_SOLAX_USERNAME`, `COLLECTOR_SOLAX_PASSWORD`, `COLLECTOR_SOLAX_PLANT_ID`, `COLLECTOR_INFLUX_TOKEN`, `COLLECTOR_MQTT_USER`, `COLLECTOR_MQTT_PASSWORD` | `leoiot-pv/.env`, service `collector` (only with the profile `collector`) | Required: Solax access, InfluxDB write token, MQTT access; optional among others `COLLECTOR_INFLUX_BUCKET`, `COLLECTOR_PUBLISH`; details in `leoiot-pv/collector/README.md` |
| `DOCKER_INFLUXDB_INIT_*` | `influxdb` | Initial setup (mode, user, password, organisation, bucket, admin token) |

:::caution[Credentials]
For credentials and tokens in the repository, see [Operations](../operations/), section “Known limitations”.
:::

## Missing `leoiot-platform/broker/pwfile` or `acl`

On port 1883 Mosquitto only accepts logged-in users. This needs a password file (`leoiot-platform/broker/pwfile`, `/mosquitto/config/pwfile` in the container) and the access rules of the accounts (`leoiot-platform/broker/acl`). For security both are listed in `.gitignore` and are therefore missing after a fresh clone (download of the project); the repository has `mosquitto.conf`, `acl-websocket` and the example `acl.example`. The `leoiot-platform/broker/` directory is attached read-only as a volume (a folder shared with the container), so both files must be readable for everyone (`chmod 644`).

The file is created with the Mosquitto tool `mosquitto_passwd`. Principle (placeholders, no real values):

```bash
# in leoiot-platform/: create the file, add the first user (asks for a password)
docker run --rm -it -v "$PWD/broker:/mosquitto/config" eclipse-mosquitto:2.0.22 \
  mosquitto_passwd -c /mosquitto/config/pwfile <USER>

# in leoiot-platform/: add another user (without -c, otherwise the file is overwritten)
docker run --rm -it -v "$PWD/broker:/mosquitto/config" eclipse-mosquitto:2.0.22 \
  mosquitto_passwd /mosquitto/config/pwfile <OTHER_USER>
```

The users/passwords must match the clients: Telegraf, `fake-sensors` and the backend (`quarkus-app`) log in to the broker with a user name and password (configured in `legacy/telegraf.conf`, `legacy/fake-sensors/index.js` and the backend `application.properties`). Then copy `broker/acl.example` to `broker/acl` and give every account a block; an account without one can connect but neither publish nor subscribe. More in `leoiot-platform/README.md`.

## Fake sensors for testing

The `fake-sensors` service starts automatically with `docker compose up -d`. On its own (in the `legacy/` folder):

```bash
docker compose up -d fake-sensors
```

It publishes simulated temperature and CO₂ values for 117 rooms (`roomsConfig` in `legacy/fake-sensors/index.js`; default interval 10 s, `UPDATE_INTERVAL`):

| Value | Topic | Format |
|---|---|---|
| Temperature | `room-temperature` | JSON, e.g. `{"room": "105", "temperature": 21.5}` |
| CO₂ | `nili3/sensor/{room_id}_co2/state` | plain number in ppm |

Standalone (against a broker on `localhost:1883`): `cd legacy/fake-sensors && npm install && npm start`; another broker via `MQTT_HOST`.

## Local frontend development

Both frontends in the `legacy/` folder use Vite (development server and build tool for web interfaces). Scripts according to `package.json`; the main kiosk is described in the section [Main kiosk](#main-kiosk):

| Project | `npm run dev` | Port |
|---|---|---|
| `legacy/frontend` | `vite` | Vite default; `--port 8080` in Compose |
| `legacy/dashboard-v2` | `vite --port 8081` | 8081 |

Both also provide `npm run build` (`vite build`) and `npm run preview`; Compose does not use the build, its dev servers run with `--host 0.0.0.0`. `frontend` depends on `three`; `dashboard-v2` only has Vite as a dependency.

```bash
cd legacy/dashboard-v2
npm install
npm run dev
```

## Sources in the repository

- `legacy/docker-compose.yaml`
- `leoiot-platform/compose.yaml`, `leoiot-platform/broker/` (`mosquitto.conf`, `acl-websocket`, `acl.example`, `.gitignore`), `leoiot-platform/README.md`
- `legacy/telegraf.conf`
- `legacy/fake-sensors/index.js`
- `legacy/backend/sensor-data-generator/src/main/resources/application.properties`
- `legacy/frontend/package.json`, `legacy/dashboard-v2/package.json`
- `leoiot-pv/compose.yaml`, `leoiot-pv/.env.example`, `leoiot-pv/kiosk/package.json`, `leoiot-pv/kiosk/README.md`
