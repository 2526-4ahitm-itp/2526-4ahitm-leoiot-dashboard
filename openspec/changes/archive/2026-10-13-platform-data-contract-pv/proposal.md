# Proposal

## Why

The repository rules say a sub-project may only rely on interfaces that are written down in the `platform` spec group, and there is no data contract yet. The PV team has a rebuilt kiosk ready to move into `leoiot-pv/` and a collector to rebuild, and both are blocked until the PV data they read and write is specified. This change writes down the PV part of the contract exactly as the running system behaves today, so the new PV parts and the legacy ones can run side by side on the same data.

## What Changes

- Create the capability `platform/data-contract` with the PV interfaces only:
  - the stored PV readings (bucket, measurement, tag, fields, units, write interval, timestamp),
  - the PV live topic on the broker and the two message shapes that arrive on it,
  - how PV live messages reach a browser over the WebSocket channel,
  - how a PV reader and a PV writer get access to the database.
- State that these interfaces stay as they are while legacy and new parts run in parallel.
- Check each statement against vm23 before the change is merged, because parts of it are known only from reading consumer code.

Not in this change:

- Sensor topics, room-climate measurements and their WebSocket messages. The sensors team adds them to the same capability.
- Any improvement of the interfaces (a battery-aware consumption field, one message shape instead of two, momentary power in the database). Those are later `platform-…` changes, proposed once nothing in `legacy/` reads the old form.
- Code. Applying this change means verifying and agreeing, not building.

## Capabilities

### New Capabilities

- `platform/data-contract`: the shared data interfaces between sub-projects. This change adds the PV part.

### Modified Capabilities

None.

## Impact

- **Unblocks** `pv-main-kiosk` and `pv-solax-collector`, which refer to this contract and do not restate it.
- **Ownership**: `platform` has no assigned owner. This change covers PV interfaces only and the PV team decides on it itself (decided 2026-10-13); no review by the project lead is needed. The capability name is the one `openspec/specs/README.md` reserves for the contract, so the sensors part lands in the same spec file.
- **vm23**: sample data and the bucket's retention are read once over the public addresses; one read-only and one write-only token are created.
- **No running service changes.**
