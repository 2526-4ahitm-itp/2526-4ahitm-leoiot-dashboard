# Proposal

> **DEMO. Not a permanent part of the system.** Everything this change adds is named `demo` and is deleted again ("Dump" below).

## Why

Only room 105 has a real sensor box. For showing the project, the 3D explorer's CO₂ and temperature maps and the sensors dashboard should show values for every room of the building model. Decided with Elias Pointinger on 2026-11-20: the sensors team runs a demo generator for all rooms, marked as demo so that it can be removed completely afterwards.

## What Changes

- New component `leoiot-sensors/demo/`: generates CO₂, temperature and humidity for every room of the 3D building model except rooms with a real sensor (105). Once a minute it publishes each room's live message and writes the same reading to `room_climate`. Every reading carries `source` = `simulated` and `device` = `demo`; the live message also carries `demo: true`.
- On every start it fills the last 7 days of history at 5-minute steps, so the dashboard's charts are not empty. The values are a deterministic function of room and time, so writing them again overwrites the same points.
- `--clear` empties the retained message of every demo room and deletes every `room_climate` point with `device` = `demo`.
- New Compose service `demo` in `leoiot-sensors/compose.yaml` behind the profile `demo`: off unless `COMPOSE_PROFILES=demo` is set in `leoiot-sensors/.env` on the host. It uses the collector's broker account and database token (the account may write `leoiot/room-climate/#` already).
- The room ids are a copy of the 3D model's rooms (107 ids from `ModelFull.gltf` and `ModelT.gltf`, as listed on 2026-11-20). This is a deliberate one-off exception to the rule that a sub-project copies nothing from a sibling; it is deleted with the demo.

Not in this change: changes to the collector, the dashboard, the explorer or the data contract.

## Capabilities

### New Capabilities

- `sensors/demo`: what the demo publishes and writes, that it is off by default, how it is told apart from real readings and how it is removed.

### Modified Capabilities

None.

## Impact

- `leoiot-sensors/demo/` (new), `leoiot-sensors/compose.yaml` (service `demo` behind a profile), `leoiot-sensors/README.md` (a short note).
- Data: about 106 rooms × 1 point per minute in `room_climate`, all tagged `device` = `demo` and `source` = `simulated`; the dashboard shows them with its "simuliert" pill.
- vm23: one line `COMPOSE_PROFILES=demo` in `leoiot-sensors/.env`; no broker or secret change.
- The 3D team's `leoiot-3d/temporary-simulator` stays off; running both would write the same topics.

## Dump

1. On vm23 in `leoiot-sensors/`: `docker compose --profile demo stop demo`, then `docker compose --profile demo run --rm demo node index.mjs --clear`, then remove `COMPOSE_PROFILES=demo` from `.env` and run `docker compose up -d --remove-orphans`.
2. In a pull request: delete `leoiot-sensors/demo/`, the `demo` service in `leoiot-sensors/compose.yaml`, the note in `leoiot-sensors/README.md` and this change folder. Never archive this change.
