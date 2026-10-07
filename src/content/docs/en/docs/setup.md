---
title: Setup
description: Prerequisites, starting with Docker Compose, ports, required files and local development of the LeoIoT services.
sidebar:
  order: 30
---

This page describes how to start the whole system locally. Docker Compose (a tool for starting several containers together) starts all services with one command.

## Prerequisites

- Docker with the Compose plugin (start via `docker compose`).
- The Node services (JavaScript programs) run in containers (`node:20-alpine`) and install their libraries themselves at start (`npm install`). Node therefore does not have to be installed on your own computer.
- The `quarkus-app` service is built from `backend/sensor-data-generator` using its Dockerfile (`src/main/docker/Dockerfile`).
- The `mosquitto` service needs the file `config/pwfile` (see below).

## Start

```bash
# in the repository root (main folder of the project)
docker compose up -d
```

Without `-d` the logs stay in the foreground. Logs of one service: `docker compose logs -f dashboard-v2`; stop: `docker compose down`.

Compose starts these services (all on the `leoiot` network):

| Service | Image / source | Purpose |
|---|---|---|
| `mosquitto` | `eclipse-mosquitto:latest` | MQTT broker (message relay) |
| `influxdb` | `influxdb:2.7` | Time-series database (setup mode on first start) |
| `telegraf` | `telegraf:latest` | Reads MQTT topics and writes to InfluxDB (`telegraf.conf`) |
| `grafana` | `grafana/grafana:latest` | Dashboards (provisioning from `grafana/`) |
| `quarkus-app` | Build from `backend/sensor-data-generator` | Sensor data generator (publishes e.g. `sine`, `room-temperature`) |
| `frontend` | `node:20-alpine`, `./frontend` | 3D explorer (Vite dev server) |
| `dashboard-v2` | `node:20-alpine`, `./dashboard-v2` | Dashboard (room climate and PV, Vite dev server) |
| `kiosk`, `kiosk2`, `kiosk3`, `kiosk4` | `node:20-alpine`, one directory each | Kiosk displays (Vite dev server) |
| `leogreen-kiosk` | `node:20-alpine`, `./leogreenKiosk` | LeoGreen kiosk |
| `mqtt-ws-bridge` | `node:20-alpine`, `./mqtt-ws-bridge` | Bridge: passes MQTT readings on to the browser via WebSocket |
| `solax-collector` | `node:20-alpine`, `./solax-collector` | Fetches Solax data, writes it to InfluxDB and publishes it via MQTT |
| `fake-sensors` | `node:20-alpine`, `./fake-sensors` | Simulated sensors for testing |

## Ports

| Port | Service |
|---|---|
| 1883 | Mosquitto (MQTT) |
| 8086 | InfluxDB |
| 3000 | Grafana |
| 8080 | `frontend` (3D explorer) |
| 8081 | `dashboard-v2` |
| 8082 / 8083 / 8084 / 8085 | `kiosk` / `kiosk2` / `kiosk3` / `kiosk4` |
| 8087 | `leogreen-kiosk` |
| 8090 | `mqtt-ws-bridge` (WebSocket) |

`quarkus-app`, `telegraf`, `fake-sensors` and `solax-collector` publish no ports.

## Required files and variables

| Name | Where | Meaning |
|---|---|---|
| `config/mosquitto.conf` | in the repository | Listener 1883, `allow_anonymous false`, `password_file /mosquitto/config/pwfile` |
| `config/pwfile` | **not** in the repository (`.gitignore`) | Broker password file |
| `telegraf.conf` | in the repository | MQTT credentials (user/password) and InfluxDB token; the values are not given here for security reasons |
| `MQTT_HOST` | Compose environment of `quarkus-app`, `fake-sensors`, `mqtt-ws-bridge` | Broker hostname (`mosquitto` on the Compose network) |
| `MQTT_PORT`, `UPDATE_INTERVAL` | optional, `fake-sensors` | Broker port (default 1883), publish interval in ms (default 10000) |
| `WS_PORT` | `mqtt-ws-bridge` | WebSocket bridge port (8090 in Compose) |
| `PV_MQTT_HOST`, `PV_MQTT_PORT`, `PV_MQTT_USER`, `PV_MQTT_PASS` | `mqtt-ws-bridge` | Access to an external MQTT broker (photovoltaics) |
| `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET` | `solax-collector` | InfluxDB access |
| `DOCKER_INFLUXDB_INIT_*` | `influxdb` | Initial setup (mode, user, password, organisation, bucket, admin token) |

:::caution[Credentials]
For credentials and tokens in the repository, see [Operations](../operations/), section “Known limitations”.
:::

## Missing `config/pwfile`

Mosquitto only accepts logged-in users. This needs a password file (`config/pwfile`, `/mosquitto/config/pwfile` in the container). For security it is listed in `.gitignore` and is therefore missing after a fresh clone (download of the project); only `config/mosquitto.conf` is in the repository. The `config/` directory is attached as a volume (a folder shared with the container).

The file is created with the Mosquitto tool `mosquitto_passwd`. Principle (placeholders, no real values):

```bash
# create the file, add the first user (asks for a password)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd -c /mosquitto/config/pwfile <USER>

# add another user (without -c, otherwise the file is overwritten)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd /mosquitto/config/pwfile <OTHER_USER>
```

The users/passwords must match the clients: Telegraf, `fake-sensors` and the backend (`quarkus-app`) log in to the broker with a user name and password (configured in `telegraf.conf`, `fake-sensors/index.js` and the backend `application.properties`).

## Fake sensors for testing

The `fake-sensors` service starts automatically with `docker compose up -d`. On its own:

```bash
docker compose up -d fake-sensors
```

It publishes simulated temperature and CO₂ values for 117 rooms (`roomsConfig` in `fake-sensors/index.js`; default interval 10 s, `UPDATE_INTERVAL`):

| Value | Topic | Format |
|---|---|---|
| Temperature | `room-temperature` | JSON, e.g. `{"room": "105", "temperature": 21.5}` |
| CO₂ | `nili3/sensor/{room_id}_co2/state` | plain number in ppm |

Standalone (against a broker on `localhost:1883`): `cd fake-sensors && npm install && npm start`; another broker via `MQTT_HOST`.

## Local frontend development

All seven frontends use Vite (development server and build tool for web interfaces). Scripts according to `package.json`:

| Project | `npm run dev` | Port |
|---|---|---|
| `frontend` | `vite` | Vite default; `--port 8080` in Compose |
| `dashboard-v2` | `vite --port 8081` | 8081 |
| `kiosk` | `vite --port 8082` | 8082 |
| `kiosk2` | `vite --port 8083` | 8083 |
| `kiosk3` | `vite --port 8084` | 8084 |
| `kiosk4` | `vite --port 8085` | 8085 |
| `leogreenKiosk` | `vite --port 8087` | 8087 |

All seven also provide `npm run build` (`vite build`) and `npm run preview`; Compose does not use the build, its dev servers run with `--host 0.0.0.0`. `frontend` depends on `three`; the others only have Vite as a dependency.

```bash
cd dashboard-v2
npm install
npm run dev
```

## Sources in the repository

- `docker-compose.yaml`
- `config/mosquitto.conf`, `.gitignore`
- `telegraf.conf`
- `fake-sensors/index.js`
- `backend/sensor-data-generator/src/main/resources/application.properties`
- `frontend/package.json`, `dashboard-v2/package.json`, `leogreenKiosk/package.json`
