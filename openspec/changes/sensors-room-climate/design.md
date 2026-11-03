# Design

## Context

See `proposal.md` for motivation; the behaviour is in `specs/sensors/collector/spec.md` and `specs/sensors/dashboard/spec.md`. Facts that shape the approach:

| Statement | Source |
|---|---|
| The box `nili3` (ESPHome, MQTT discovery off) measures temperature and humidity (BME280, every 10 s) and CO₂ (MH-Z19) and publishes each value on its own topic `nili3/sensor/<object id>/state`; the object ids follow its sensor names `${name}_Temperature`, `${name}_Humidity`, `${name}_CO2` | `legacy/sensorbox/nili-ldr/nili-ldr.yaml` (read as a fact source, nothing is copied) |
| `legacy/fake-sensors` publishes generated CO₂ on `nili3/sensor/<room in lower case>_co2/state`, including `nili3/sensor/105_co2/state` | archived design of `platform-data-contract-sensors` |
| The broker ACL template gives `sensors-collector` `read #` and `write leoiot/room-climate/#`; the account itself does not exist yet | `leoiot-platform/broker/acl.example` |
| The write-only token `SENSORS_INFLUX_TOKEN` is in `/home/solmqadmin/leoiot-host-secrets/sensors-collector.env` on vm23, outside the checkout | continuation `sensors-first-dashboard` |
| InfluxDB (`influxdb:8086`) and the broker (`mosquitto:1883`) are reachable on the shared network `2526-4ahitm-leoiot-dashboard_leoiot`; browsers reach the broker at `/mqtt` | `leoiot-pv/compose.yaml`, `platform/broker` |
| A folder `leoiot-*/` with a `compose.yaml` becomes a deploy unit; its `.env` exists only on vm23; `docker compose config -q` runs in CI with `.env.example` | operations page, `AGENTS.md` |
| The visual direction is chosen: "Classroom Air Light", contract in `leoiot-sensors/.impeccable/surfaces/dashboard.md`, product facts in `leoiot-sensors/PRODUCT.md`, preview with sample data in `leoiot-sensors/.impeccable/previews/room-105/` (not committed) | Impeccable round of 2026-10-23 |

## Goals / Non-Goals

**Goals:**

- Real readings of room 105 in `room_climate` and on the live topic, with nothing generated mixed in.
- A dashboard that is complete for one room and does not need rework when more rooms arrive.
- The same stack and deployment pattern as `leoiot-pv/`, so that both teams can read each other's code, without sharing code.

**Non-Goals:**

- Mapping more devices, the simulator, the sensor overview, a room list: later `sensors-…` changes.
- Long-term aggregation or downsampling: the contract keeps every reading.

## Decisions

### D1. TypeScript on Node 22 for the collector, Vite for the dashboard

Both components use TypeScript and Vitest like `leoiot-pv/`. The collector uses `mqtt` (as the PV collector does) and writes to InfluxDB with plain HTTP line protocol (`POST /api/v2/write`), so it needs no database client library. *Alternative:* Java/Quarkus (rejected 2026-10-22 by the team lead: one language across the sub-projects' web and service code).

### D2. One point per delivered value

ESPHome sends each quantity as its own message, so every message becomes one single-field point stamped at receipt. Two values received in the same millisecond get timestamps a few nanoseconds apart, because InfluxDB would otherwise merge them into one point. ESPHome publishes its states retained, so the broker replays the last value of every device topic on each subscribe; such a replay carries the retain flag and is ignored (logged once), since stamping it with the receipt time would invent a reading. *Alternative:* collect temperature and humidity that arrive within a short window into one point (rejected: an arbitrary window, a reading would be delayed, and the contract explicitly allows single-field points).

### D3. Exact topic subscriptions, never a pattern

The collector subscribes to the three topics named in the mapping (`nili3/sensor/nili3_co2/state`, `nili3/sensor/nili3_temperature/state`, `nili3/sensor/nili3_humidity/state`), not to `nili3/sensor/#`. The pattern would also deliver the legacy simulator's `nili3/sensor/105_co2/state`, and generated values would be stored as `source = sensor` for room 105, which the contract forbids. The topic names are derived from the box's configuration and are checked on vm23 before the first release (task 6.2).

### D4. The device mapping is a file in Git

`leoiot-sensors/collector/devices.json` lists device, room, source and one topic per quantity. It is validated at start (spec "Devices are read through a mapping"); adding a device is a reviewed change. *Alternative:* mapping in the `.env` on vm23 (rejected: not reviewed, not tested).

### D5. Live message from the device's last values

The collector keeps the last value of each quantity per device in memory and publishes all of them with every reading, retained, QoS 1. After a restart the message carries only what arrived since; the contract allows that. *Alternative:* read the retained message back at start (rejected for now: simple to add later, and a stale value would be re-published with a new `ts`).

### D6. A bounded write buffer

Points go to the database in batches every two seconds. When a write fails, they stay in an in-memory queue of at most one hour (about 1 100 points for `nili3`) and are written in order once the database answers. A batch that InfluxDB rejects as invalid (HTTP 400 or 422) is dropped and logged instead of retried, so one bad point cannot block the queue; every other error is retried. A restart loses the queue; the box keeps no history either, so a longer outage loses readings in any case.

### D7. Health from a status file

Like the PV collector, the process writes the times of its last broker connection and last successful write to a file that a small `healthcheck.mjs` reads (spec "Health is reported"). A silent device does not change health; staleness is shown by the dashboard from `ts`.

### D8. Credentials through an env file outside the checkout

`leoiot-sensors/compose.yaml` loads the collector's secrets with `env_file: { path: ${SENSORS_COLLECTOR_ENV_FILE:-/home/solmqadmin/leoiot-host-secrets/sensors-collector.env}, required: false }`. The file holds `SENSORS_INFLUX_TOKEN`, `SENSORS_MQTT_USER` and `SENSORS_MQTT_PASSWORD`; the collector refuses to start without them. `required: false` keeps `docker compose config -q` working in CI, where the file does not exist. The dashboard's read token `SENSORS_DASHBOARD_INFLUX_TOKEN` comes from `leoiot-sensors/.env` like `KIOSK_INFLUX_TOKEN` in `leoiot-pv/`. *Alternative:* everything in `leoiot-sensors/.env` (possible, but the write token already lives in the host secrets folder, and moving it means handling it again).

### D9. The dashboard is a static build behind its own nginx

As in `leoiot-pv/dashboard/`: the image serves the build under `/sensors/` and offers `POST /sensors/api/query`, which forwards Flux queries to `influxdb:8086` with the read token added by nginx, so the browser never sees a token. Live values come straight from the platform route `/mqtt` (MQTT over WebSocket, anonymous, read-only), so the dashboard needs no WebSocket proxy of its own. The container listens on `127.0.0.1:${SENSORS_DASHBOARD_PORT:-8092}`; the host route `/sensors/` in `leoiot-platform/proxy/nginx.conf` forwards there. *Alternative:* query InfluxDB through a small Node API (rejected: one more service for a fixed set of queries).

### D10. Queries

History: one Flux query per range, filtered on `room`, all three fields, `aggregateWindow(every: 5m | 30m, fn: mean, createEmpty: true)`, pivoted to rows, so that empty windows come back as gaps. Latest values and their times: `last()` per field, used at start and by the fallback poll. "Since when above the limit" is computed in the browser from the five-minute series: the start of the current uninterrupted run above 800 (or 1000) ppm. The source of the shown readings decides the "simuliert" marking.

### D11. Charts with Apache ECharts 6

ECharts 6 is imported per module (`echarts/core` with the line chart, grid, tooltip, axis pointer, mark area, mark line and the SVG renderer) to keep the bundle small. The temperature chart and the two-panel CO₂/humidity chart are linked with `echarts.connect`, so one pointer runs through all three panels. *Alternative:* Chart.js 4 like PV (rejected: threshold bands, multi-grid layouts and synced pointers are built into ECharts, and PV and sensors share no chart code anyway).

### D12. Look and design process

The dashboard follows the direction contract in `leoiot-sensors/.impeccable/surfaces/dashboard.md`; the preview is the reference, not code to copy. The face is Lexend, served from the image (SIL Open Font License), so the page makes no request to a third party; Atkinson Hyperlegible was dropped because its slashed zero changes room ids such as `105`. The build ends with Impeccable's finish review and a `leoiot-sensors/DESIGN.md` written from the built page. Previews, mocks and decision pages under `leoiot-sensors/.impeccable/` stay out of Git; `PRODUCT.md`, the surface brief and `.impeccable/config.json` are committed.

## Risks / Trade-offs

- [The derived topic names are wrong and nothing arrives] → task 6.2 checks them on vm23 with the new account before the release; the mapping is a one-line fix.
- [`nili3` is offline when the dashboard goes live] → the dashboard shows "Keine Daten für Raum 105" or the outdated state, which is the truth; checked before announcing the page.
- [History starts empty, so the 7-day view is mostly gaps in its first week] → accepted for a first version; copying the legacy history is an open question.
- [The read token can read all of `server_data`, including PV data] → it stays on the server side in nginx and only fixed queries come from the page; same model as the PV dashboard.
- [The `leoiot-sensors` unit fails on its first deployment because `.env` or the secrets file is missing] → `docker compose config -q` fails early on vm23 and the other units are untouched; tasks 6.1 to 6.3 come before the release.
- [The ECharts bundle is large] → modular import; the size is noted in the pull request.

## Migration Plan

1. Merge this change's specs and code into `main` (CI green); nothing is deployed yet.
2. On vm23, by a person: broker account and ACL block, broker restart; read token; `leoiot-sensors/.env`; free port checked.
3. Pull request in `leoiot-platform/proxy/nginx.conf` for `/sensors/`; merge.
4. Release `main` → `release`; the new unit starts. Install the nginx file on the host and reload.
5. Check data in `room_climate`, the live message at `/mqtt` and the dashboard at `/sensors/`; then add `/sensors/` to `.github/ci/smoke-routes` in a pull request of its own.

Rollback: `docker compose down` in `leoiot-sensors/` and the route removed; `room_climate` points and the retained message are additions that no legacy reader uses.

## Open Questions

- Copy the box's history from `mqtt_consumer` into `room_climate` once? A one-off task of its own if the team wants a full week from the start.
- Should the collector later read its retained live messages back at start (D5) to keep all three values after a restart?
