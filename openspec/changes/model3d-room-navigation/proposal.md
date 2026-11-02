# Proposal

## Why

`leoiot-3d/explorer` (built by `model3d-building-explorer`) has no way to walk a user from the building view to a room: that capability was deliberately deferred to this change. The only existing navigation logic is in the frozen `legacy/frontend/logic.js` — its waypoint graph routes some rooms through walls and does not always take the shortest path, and its UI controls do not exist in the new explorer at all. Rather than patch the frozen legacy code, this change specifies and implements room navigation natively in `leoiot-3d/explorer`, using the legacy behaviour only as reference for what "correct" looks like, per FR-11 ("clear and visible navigation/actions without hidden primary controls").

## What Changes

- New navigation capability in `leoiot-3d/explorer`: a pathfinder over per-floor corridor waypoints and stairways. Implemented to match legacy's own navigation behaviour (see `design.md` D1), at the project owner's explicit direction after stricter from-scratch alternatives were built and found unacceptable in practice — it does not guarantee a shortest or wall-free route, the same trade-off legacy always had.
- Multi-floor routes: when the selected room is on a different floor than the current view, the path crosses a stairway node and the viewer switches floors along the route.
- UI controls to start navigation (pick/search a destination room), show the resulting path in the 3D view, and clear/cancel an active route. These controls do not exist today in `leoiot-3d/explorer` and must be (re-)added.
- Waypoint data for the corridor graph: whether it is authored fresh for `leoiot-3d`'s models or adapted from legacy's `waypoints.gltf`/`waypoints_t.gltf` as a data-only input (same kind of exception already made for the building models) is a design decision of this change, not a foregone conclusion — legacy code itself is never reused.
- No changes to `legacy/`: it stays frozen: this change only replaces the missing functionality in the new sub-project.

## Capabilities

### New Capabilities
- `model3d/room-navigation`: computing and displaying a walkable path from the current view to a chosen room, confined to corridors/stairways, together with the UI to request and clear that path.

### Modified Capabilities
- None. `model3d/building-viewer` and `model3d/room-climate-view` (from `model3d-building-explorer`) are not yet merged into `openspec/specs/`, so there is nothing there to amend; this change only adds a new capability that builds on top of the explorer once that change lands.

## Impact

- Affected code: `leoiot-3d/explorer/src/` — a new navigation module (graph + pathfinding), new UI controls (extends `src/ui/`), and new waypoint/corridor data for the existing glTF models.
- Depends on the building/scene plumbing added by `model3d-building-explorer` (floor switching, room meshes, model loading); no dependency on `legacy/`.
- No platform data-contract changes expected: navigation is static building geometry, not room-climate telemetry.
- No impact on `leoiot-sensors/` or `leoiot-pv/`.
