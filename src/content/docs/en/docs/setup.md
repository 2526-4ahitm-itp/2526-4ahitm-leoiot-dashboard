---
title: Setup
description: Prerequisites, starting with Docker Compose, ports, required files and local development of the LeoIoT services.
sidebar:
  order: 30
---

This page describes how to start the whole system locally. All statements come from `docker-compose.yaml`, `config/` and the `package.json` files.

## Prerequisites

- Docker with the Compose plugin (start via `docker compose`).
- The Node-based services run in containers (`node:20-alpine`) and run `npm install` themselves on startup; no local Node installation is needed for Compose.
- The `quarkus-app` service is built from `backend/sensor-data-generator` using its Dockerfile (`src/main/docker/Dockerfile`).
- The `mosquitto` service needs the file `config/pwfile` (see below).

## Start

```bash
# in the repository root
docker compose up -d
```

Without `-d` the logs stay in the foreground. Logs of one service: `docker compose logs -f dashboard-v2`; stop: `docker compose down`.

Compose starts these services (all on the `leoiot` network):

| Service | Image / source | Purpose |
|---|---|---|
| `mosquitto` | `eclipse-mosquitto:latest` | MQTT broker |
| `influxdb` | `influxdb:2.7` | Time-series database (setup mode on first start) |
| `telegraf` | `telegraf:latest` | Reads MQTT topics and writes to InfluxDB (`telegraf.conf`) |
| `grafana` | `grafana/grafana:latest` | Dashboards (provisioning from `grafana/`) |
| `quarkus-app` | Build from `backend/sensor-data-generator` | Sensor data generator (publishes e.g. `sine`, `room-temperature`) |
| `frontend` | `node:20-alpine`, `./frontend` | 3D building view (Vite dev server) |
| `dashboard-v2` | `node:20-alpine`, `./dashboard-v2` | Sensor dashboard (Vite dev server) |
| `kiosk`, `kiosk2`, `kiosk3`, `kiosk4` | `node:20-alpine`, one directory each | Kiosk views (Vite dev server) |
| `leogreen-kiosk` | `node:20-alpine`, `./leogreenKiosk` | LeoGreen kiosk |
| `mqtt-ws-bridge` | `node:20-alpine`, `./mqtt-ws-bridge` | WebSocket bridge to MQTT |
| `solax-collector` | `node:20-alpine`, `./solax-collector` | Writes Solax data to InfluxDB |
| `fake-sensors` | `node:20-alpine`, `./fake-sensors` | Simulated sensors for testing |

## Ports

| Port | Service |
|---|---|
| 1883 | Mosquitto (MQTT) |
| 8086 | InfluxDB |
| 3000 | Grafana |
| 8080 | `frontend` (3D view) |
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
| `telegraf.conf` | in the repository | MQTT credentials (user/password) and InfluxDB token; values intentionally not listed here |
| `MQTT_HOST` | Compose environment of `quarkus-app`, `fake-sensors`, `mqtt-ws-bridge` | Broker hostname (`mosquitto` on the Compose network) |
| `MQTT_PORT`, `UPDATE_INTERVAL` | optional, `fake-sensors` | Broker port (default 1883), publish interval in ms (default 10000) |
| `WS_PORT` | `mqtt-ws-bridge` | WebSocket bridge port (8090 in Compose) |
| `PV_MQTT_HOST`, `PV_MQTT_PORT`, `PV_MQTT_USER`, `PV_MQTT_PASS` | `mqtt-ws-bridge` | Access to an external MQTT broker (photovoltaics) |
| `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET` | `solax-collector` | InfluxDB access |
| `DOCKER_INFLUXDB_INIT_*` | `influxdb` | Initial setup (mode, user, password, organisation, bucket, admin token) |

:::danger[Secrets in the repository]
`docker-compose.yaml`, `backup/*.sh`, `telegraf.conf` and the backend configuration contain credentials and tokens in plain text. This documentation deliberately does not reproduce them. For any public operation they should be moved out and rotated.
:::

## Missing `config/pwfile`

The broker configuration forbids anonymous connections and points to `/mosquitto/config/pwfile`. The `config/` directory is mounted into `/mosquitto/config`; `config/pwfile` is listed in `.gitignore` and is therefore missing after a fresh clone. Only `config/mosquitto.conf` is in the repository.

The file is created with the Mosquitto tool `mosquitto_passwd`. Principle (placeholders, no real values):

```bash
# create the file and add the first user (prompts for the password)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd -c /mosquitto/config/pwfile <USER>

# add another user (without -c, otherwise the file is overwritten)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd /mosquitto/config/pwfile <OTHER_USER>
```

The users/passwords must match the clients: Telegraf, `fake-sensors` and the backend (`quarkus-app`) log in to the broker with a user name and password (configured in `telegraf.conf`, `fake-sensors/index.js` and the backend `application.properties`). Those files show which credentials are used.

The users are created with `mosquitto_passwd` (also in the production system).

## Fake sensors for testing

The `fake-sensors` service starts automatically with `docker compose up -d`. On its own:

```bash
docker compose up -d fake-sensors
```

It publishes simulated temperature and CO2 values (default interval 10 s, `UPDATE_INTERVAL`):

| Value | Topic | Format |
|---|---|---|
| Temperature | `room-temperature` | JSON, e.g. `{"room": "105", "temperature": 21.5}` |
| CO2 | `nili3/sensor/{room_id}_co2/state` | plain number in ppm |

Standalone (against a broker on `localhost:1883`): `cd fake-sensors && npm install && npm start`; another broker via `MQTT_HOST`.

:::note
The README mentions 7 rooms; `index.js` configures 117 rooms and is authoritative.
:::

## Local frontend development

All frontends use Vite. Scripts according to `package.json`:

| Project | `npm run dev` | Port |
|---|---|---|
| `frontend` | `vite` | Vite default; `--port 8080` in Compose |
| `dashboard-v2` | `vite --port 8081` | 8081 |
| `leogreenKiosk` | `vite --port 8087` | 8087 |

All three also provide `npm run build` (`vite build`) and `npm run preview`. In Compose the dev servers run with `--host 0.0.0.0`. `frontend` depends on `three`; the other two only have Vite as a dependency.

```bash
cd dashboard-v2
npm install
npm run dev
```

Backend locally (from the outdated `backend/guide-sine-generator.adoc`, see below): start Mosquitto (`mosquitto -v -p 1883`), listen with `mosquitto_sub -h localhost -t sine -v` and start Quarkus with `mvn quarkus:dev`.

## Outdated guides and files

- `guide-sine-generator.adoc` is outdated: it describes anonymous Mosquitto operation, while the Compose broker forbids anonymous connections; replaced by `fake-sensors`.
- `api/requests.http` is an outdated demo leftover: the backend only offers `/hello` and a WebSocket, no `/api/sensors`.

## Sources in the repository

- `docker-compose.yaml`
- `config/mosquitto.conf`, `.gitignore`
- `telegraf.conf`
- `fake-sensors/README.md`, `fake-sensors/index.js`
- `backend/guide-sine-generator.adoc`, `backend/sensor-data-generator/src/main/resources/application.properties`
- `frontend/package.json`, `dashboard-v2/package.json`, `leogreenKiosk/package.json`
- `api/requests.http`, `README.adoc`
