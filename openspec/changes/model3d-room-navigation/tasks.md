# Tasks

Three approaches were attempted before this one (see `design.md` D1); this list reflects the final, implemented approach — legacy's own hand-placed waypoints and greedy pathfinding, re-typed as data and re-implemented in code, per the project owner's explicit direction after the earlier approaches were checked and rejected.

## 1. Corridor waypoint data

- [x] 1.1 Re-typed legacy's hand-placed `start`/`stairs`/intersection waypoints per floor (`legacy/frontend/waypoints.gltf`) and the gym's entrance/intersections (`waypoints_t.gltf`) as plain data in `src/nav/legacyData.ts` (read-only reference, never imported — see `design.md` D2 for why this is data, not code). Verified by `tests/nav-graph.test.ts` ("every floor with waypoints has a start, stairs and at least one intersection", "the gym has an entrance and several intersections").
- [x] 1.2 Re-typed legacy's hallway `segments` array (ring, wing corridors, Aula cross, basement extension, gym hall) into the same file, used to snap a room's centre to its door point. Verified by `tests/nav-graph.test.ts` ("every segment has a finite, non-degenerate length").
- [x] 1.3 Added `scripts/generate-room-positions.mjs`, reading every room's real (x, z) centre and each floor's walking height from the models into `src/nav/room-positions.generated.ts` — the one piece still derived from geometry, since door-snapping needs a real room centre. Verified by `tests/nav-graph.test.ts` ("ROOM_POSITIONS floor matches floorOf(room)", "FLOOR_Y has a value for every floor used").

## 2. Pathfinding

- [x] 2.1 Implemented the greedy walk (`src/nav/route.ts`, `routeTo`) matching legacy's `window.startNavigation`: always move to the reachable waypoint that most reduces the remaining distance to the destination, branching the same way legacy did (ground floor / gym / another floor via the stairs waypoint), including the gym's per-room intersection rules (e.g. room `T6` detours via `intersection_thirteen`, room `T2` skips the first hop). Verified by `tests/route.test.ts` (starts at the right entrance, climbs via both floors' stairs, goes via the target floor's start point) and `tests/nav-graph.test.ts`'s real-data check that every known room except `T12` reaches its own door.
- [x] 2.2 `routeTo` returns `{ ok: false, reason: 'unknown-room' }` for an unrecognised room id; a known room the walk can't fully reach (`T12` — never named in legacy's own gym rules either) is not separately rejected, matching legacy. Verified by `tests/nav-graph.test.ts` ("rejects an unknown room").

## 3. Route rendering

- [x] 3.1 Added `Viewer.showRoute(points)` (a `TubeGeometry` along straight `LineCurve3` segments between waypoints, lifted slightly above the floor to avoid z-fighting) and `Viewer.clearRoute()` in `src/scene/viewer.ts`. Straight segments, not legacy's smoothed `CatmullRomCurve3`: an earlier iteration used the smoothed curve and the project owner reported it looked "vague" and could bow away from the corridor; switching to straight segments resolved that and was not asked to be reverted when 1:1 matching legacy was requested for the pathfinding itself. No automated test (`Viewer` needs a `WebGLRenderer`/DOM, the test environment is plain Node); covered by the dev-stack checks in 3.2/5.2.
- [x] 3.2 Confirmed by the project owner across several rounds of screenshots from the running dev stack, each round fixing what was reported wrong (entrance location, stairs location, a curved/vague path, a route cutting through a room) until the request to match legacy directly.

## 4. Navigation UI

- [x] 4.1 Built the `Navigation` UI component (`src/ui/navigation.ts`): a toggle, a search input with a suggestions list, "Go" and "Clear" actions, following the `Controls`/`InfoPanel` pattern. Suggestion filtering is a pure function, `filterRooms` in `src/core/roomSearch.ts`, unit-tested without a DOM. Verified by `tests/roomSearch.test.ts`.
- [x] 4.2 Added the navigation toggle as its own always-visible control (`.nav` in `src/ui/styles.css`, top-left, independent of the `Controls` bar), consistent with FR-11. Confirmed visible in the dev stack.
- [x] 4.3 `App.navigate` (`src/app.ts`) calls `navigation.showError(strings.navigation.notFound)` and returns before calling `Viewer.showRoute` when `routeTo` rejects an unknown room. No unit test: exercising this requires constructing `App`/`Viewer` (no DOM in the test environment, same reason as 3.1); the rejection itself is covered by `tests/nav-graph.test.ts`.

## 5. Wiring into App

- [x] 5.1 `App.navigate(room)` / `App.clearRoute()` in `src/app.ts`: on navigate, switches `view` to the destination room's floor and calls `Viewer.showRoute`; on clear, calls `Viewer.clearRoute`. `Navigation`'s callbacks are wired in the `App` constructor the same way `Controls`/`panel` are; `navigation.setRooms(knownRooms())` populates search suggestions. `tsc --noEmit` and `vite build` both pass.
- [x] 5.2 Verified end-to-end in the dev stack by the project owner: same-floor, cross-floor and gym routes, across several iterations of this change.

## 6. Documentation

- [x] 6.1 Updated `leoiot-3d/README.md`'s Navigation section and layout diagram to describe the final approach (`legacyData.ts`, `route.ts`, `generate-room-positions.mjs`) and the known `T12` gap, in place of the earlier geometry-derived-grid description.
