# Tasks

## 1. Spec delta

- [x] 1.1 Add one new `ADDED Requirement` to the still-open `openspec/changes/model3d-building-explorer/specs/model3d/building-viewer/spec.md` (not a file in this change's own directory — see `proposal.md` - Capabilities): arrow keys move one floor up/down in the floor buttons' own order, the whole-building view connects to the top of that order, and the gym / text-input focus are excluded. Verify with `openspec validate model3d-building-explorer --strict`.

## 2. Share the floor order

- [x] 2.1 In `leoiot-3d/explorer/src/ui/controls.ts`, export the existing `FLOOR_BUTTONS` constant instead of keeping it module-private, so `app.ts` reuses the same top-to-bottom order the floor buttons already use. Verify by reading the diff: no behaviour change to `Controls` itself, only the added `export`.

## 3. Arrow-key handling in the viewer

- [x] 3.1 In `leoiot-3d/explorer/src/app.ts`, add a `keydown` listener on `window` (registered in the constructor) that calls a private `handleKey` method. `handleKey` ignores keys other than `ArrowUp`/`ArrowDown`, ignores the event while focus is in an `<input>`/`<textarea>`, computes the current index in `FLOOR_BUTTONS` (treating the whole-building view as index `-1`, one above floor 2), and calls `this.setView(...)` on the floor one step up/down, clamped so that index `-1` (whole building) and `FLOOR_BUTTONS.length` (past the basement) are no-ops; any other view (the gym) is also a no-op. Verify with `tsc --noEmit` and `npm run build` in `leoiot-3d/explorer`.

## 4. Manual verification

- [x] 4.1 Verified against the real running dev server (`npm run dev`) by driving a headless browser: from the whole-building view, ArrowDown selects Floor 2; repeated ArrowDown walks Floor 2 → Floor 1 → Ground floor → Basement and then stays at Basement; ArrowUp walks back up and stays at Floor 2 (and at the whole-building view) once there's nowhere higher to go.
- [x] 4.2 `npm test` in `leoiot-3d/explorer` passes unchanged (114 tests) — this feature has no unit-testable pure logic of its own beyond `FLOOR_BUTTONS`'s existing order, and `App`/`Viewer` need a DOM/WebGL context the test environment doesn't have (same reason `showRoute`/`clearRoute` and the rest of `App`'s UI wiring aren't unit-tested either); covered instead by the headless browser check in 4.1.
