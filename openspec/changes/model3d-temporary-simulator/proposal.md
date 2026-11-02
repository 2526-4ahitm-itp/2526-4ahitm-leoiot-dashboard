# Proposal

## Why

The 3D explorer reads room climate from the broker, and on vm23 nothing publishes it yet: the sensors collector and simulator are `sensors-…` changes that have not started. Until they exist, the explorer shows "No data for room" for every room, so there is nothing to look at or demonstrate. **This change is a temporary stopgap.** It only gets data displayed, and it is deleted as soon as real or faked data from the sensors team arrives.

## What Changes

- New component `leoiot-3d/temporary-simulator/`: publishes generated room-climate readings for every room of the building model once a minute, in the format of `platform/data-contract`, always marked `source` = `simulated`.
- New Compose service `temporary-simulator` in `leoiot-3d/compose.yaml`, behind a profile: it stays off unless `leoiot-3d/.env` on the host switches it on and holds its broker account.
- Written new; nothing is taken from `legacy/`. The legacy fake sensors are not read.
- Not in this change: storing readings in the database, realistic curves, any change to the explorer.

## Capabilities

### New Capabilities

- `model3d/temporary-simulator`: what the stopgap publishes, that it is off by default, and how it is removed.

### Modified Capabilities

None.

## Impact

- **Data**: publishes on the room-climate live interface of `platform/data-contract`; no new interface. Nothing reaches the database.
- **Ownership**: simulated room climate belongs to the sensors team (`leoiot-sensors/`). It lives in `leoiot-3d/` for now by decision of the 3D team (2026-10-30), so that nothing is added to the sensors team's folder.
- **vm23, by hand**: a broker account and `leoiot-3d/.env` are needed; agents do not do this.
- **Removal**: see `leoiot-3d/temporary-simulator/README.md`. It must happen before the sensors team publishes, or both write the same topics.
