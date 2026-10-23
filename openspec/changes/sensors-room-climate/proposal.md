# Proposal

## Why

The room-climate contract (`platform/data-contract`) and the platform broker with its browser endpoint `/mqtt` are in place, but nothing writes `room_climate` yet and nobody can see it: the only real sensor box, `nili3` in room 105, still reaches people only through the frozen legacy dashboard. This first `sensors` change makes `leoiot-sensors/` real: one collector that turns the box's readings into contract data, and a dashboard that shows room 105 live and over the last 24 hours or 7 days. It is a first version on purpose; more rooms, the simulator and the sensor overview follow in later changes.

## What Changes

- Add `leoiot-sensors/collector/` (Node 22, TypeScript, Vitest): reads the device topics of the devices in its own mapping (today `nili3` → room `105`), stores every reading in `room_climate` and publishes the room's live message, both as `platform/data-contract` specifies.
- Add `leoiot-sensors/dashboard/` (Vite, TypeScript, Vitest, Apache ECharts 6) at `/sensors/`: the room's air state as a three-lamp traffic light with one status sentence (CO₂ thresholds 800 and 1000 ppm), the current CO₂, temperature and humidity with their age, a temperature chart and a CO₂/humidity chart with two panels on one time axis, for the last 24 hours (default) and 7 days; German and English, light and dark. The visual direction ("Classroom Air Light") is chosen and recorded in `leoiot-sensors/PRODUCT.md` and `leoiot-sensors/.impeccable/surfaces/dashboard.md`.
- Add `leoiot-sensors/compose.yaml` with both services, so that the deployment picks the sub-project up as a new unit, and `leoiot-sensors/.env.example`.
- In pull requests of their own: the host route `/sensors/` in `leoiot-platform/proxy/nginx.conf` and the smoke route in `.github/ci/smoke-routes`.
- On vm23 (by a person): the broker account `sensors-collector`, a read-only InfluxDB token for the dashboard, `leoiot-sensors/.env`.

Not in this change:

- The simulator that replaces `legacy/fake-sensors` and the generated rooms; other real devices (the `s3_mini_sensorbox` type); the sensor overview with every room; a room picker beyond the address.
- Copying the box's legacy history (`mqtt_consumer`) into `room_climate`. History starts when the collector starts.
- Any change to `legacy/`: Telegraf, the legacy dashboard and the legacy bridge keep reading the box's topics as before.
- Any change to the contract.

## Capabilities

### New Capabilities

- `sensors/collector`: turning the readings of mapped devices into `room_climate` points and room live messages, including device mapping and behaviour on errors.
- `sensors/dashboard`: the room-climate view of one room: air state, current values and their age, history charts, ranges, languages, themes and the states outdated, no data and simulated.

### Modified Capabilities

None.

## Impact

- **Depends on** `platform-data-contract-sensors` and `platform-broker` (both archived): measurement `room_climate`, the live topic, the browser endpoint `/mqtt`, the broker account rules. The write-only token `SENSORS_INFLUX_TOKEN` exists on vm23 outside the checkout.
- **New code**: `leoiot-sensors/collector/`, `leoiot-sensors/dashboard/`, `leoiot-sensors/compose.yaml`, `leoiot-sensors/.env.example`. No new dependency between sub-projects; nothing from `legacy/` is read or copied.
- **Shared files** (separate pull requests): `leoiot-platform/proxy/nginx.conf` (route `/sensors/`), `.github/ci/smoke-routes`. A new deploy unit `leoiot-sensors` starts on the first release after merge.
- **vm23**: one broker account and its ACL block, one read token, one `.env`, the nginx route installed and reloaded by a person; a free local port for the dashboard.
- **Data**: about 26 000 values a day from `nili3` into `server_data`, as estimated in the contract's design.
- **Legacy readers**: unchanged; the collector only subscribes to the box's topics in addition to Telegraf.
