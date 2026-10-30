# Design

## Context

See `proposal.md`. `platform/data-contract` fixes the message shape and the retained per-room topic; `platform/broker` requires an account on port 1883 that may publish only on its own topics. The deployment never passes `--profile`, and a required variable that is missing stops the rollout (`.github/ci/deploy.sh`). The PV collector already solves this with a profile and optional variables.

## Goals / Non-Goals

**Goals:** rooms show values on vm23 soon; easy to delete without a trace; impossible to mistake for a permanent part of the system.

**Non-Goals:** realistic values, storage, device mapping, anything the sensors collector will do.

## Decisions

### D1. Temporary, and marked as such everywhere

The word is in the folder, package, service, profile, device name, start-up log, spec and README. Readings carry `device` = `temporary-simulator` and `source` = `simulated`, so they can be told apart from any other source.

### D2. A new generator instead of forwarding the legacy fake sensors

Decided by the user on 2026-10-30. Forwarding would read legacy topics, which `platform/data-contract` does not allow for new sub-projects, and would have to merge separate CO₂ and temperature messages and restore lowercased room ids.

### D3. Lives in `leoiot-3d/`, as its own component

Decided by the user on 2026-10-30, although the data belongs to the sensors team (`proposal.md`, Impact). A component of its own keeps the explorer image free of it, and deleting the folder removes it.

### D4. Off by default through a profile

`profiles: ["temporary-simulator"]`, with `COMPOSE_PROFILES=temporary-simulator` in the host's `leoiot-3d/.env`. Without it nothing changes on deployment, and a missing password cannot stop the rollout. The program exits and names a missing variable. *Alternative:* a required variable (rejected: it would stop the deployment of every later unit).

### D5. Its own broker account

`model3d-simulator`, allowed to write only `leoiot/room-climate/#` (`platform/broker`), set up by hand on vm23. *Alternative:* the prepared `sensors-collector` account (rejected: it belongs to the sensors team and can read everything).

### D6. Values

A slow sine per room with a room-dependent phase: CO₂ about 420–1400 ppm, temperature about 19–26 °C, so that every colour and FR-07 status appears at any time of day. Clearly synthetic on purpose. One message a minute per room, retained, the rate the contract's design expects from a simulator. The rooms are the 107 of the building model, checked by a test against the model files.

## Risks / Trade-offs

- [Viewers cannot tell the values are fake: the explorer does not show `source`, as decided in `model3d-building-explorer`] → accepted by the user for now; the removal ends it.
- [Retained messages stay on the broker after the service stops] → rooms would show as stale forever, so `--clear` is a required removal step.
- [The sensors team starts publishing while this runs] → both would write the same topics; the removal comes first, and the README says so.
- [A stopgap stays for good] → the README names the trigger for deleting it.
