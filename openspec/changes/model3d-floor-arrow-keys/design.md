# Design

## Context

`Controls` (`leoiot-3d/explorer/src/ui/controls.ts`) already defines the floor buttons' top-to-bottom order as a local `FLOOR_BUTTONS` constant (`['2', '1', 'E', 'U']`) and wires each button to `onView`, which `App` (`src/app.ts`) connects to `this.setView(view)`. `App.view` is one of `ViewId = 'full' | FloorId`, where `FloorId` includes the gym (`'T'`) alongside the four floors.

See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals:**
- Reuse the exact order the floor buttons already use — one source of truth — rather than re-deriving or hardcoding a second copy of it.
- Make the whole-building (start/reset) view a sensible part of the sequence rather than a dead end that has to be clicked out of first.

**Non-Goals:**
- Not adding a visible indicator or help text for the shortcut (out of scope; the floor buttons' own `aria-pressed` state already reflects the result).
- Not making the gym part of the vertical order — it's a separate wing in the model, not stacked with the floors, so there's no "up" or "down" from it that means anything.

## Decisions

- **Where the floor order lives**: `FLOOR_BUTTONS` is exported from `controls.ts` instead of duplicated in `app.ts`. `Controls` still owns building the buttons in that order; `App` only reuses the order for `indexOf`/clamping arithmetic.
- **Connecting the whole-building view**: treated as index `-1`, one step above Floor 2 (index `0`). This makes `ArrowDown` from the whole-building view enter Floor 2 (the natural "first floor down"), while `ArrowUp` there — and at Floor 2 itself — is a no-op, consistent with "already at the top" everywhere else in the sequence. The alternative (leaving the whole-building view disconnected, requiring a floor button click first) is exactly the awkwardness this change fixes.
- **Scope of the no-op**: any view not in `FLOOR_BUTTONS` and not `'full'` (i.e. the gym) is left alone — arrow keys do nothing. Guessing a "logical" neighbour for the gym (which floor is it "above" or "below"?) would be arbitrary; doing nothing is the safer default until asked for.
- **Input focus guard**: the `keydown` listener ignores the event when `e.target` is an `<input>`/`<textarea>`, so it doesn't interfere with typing in the room-search box (no keyboard behaviour is defined for that box's suggestions today, but this keeps the two features from fighting if that changes later).

## Risks / Trade-offs

- **A single global `keydown` listener on `window`, never removed**: acceptable — `App` is constructed once for the lifetime of the page (there's no teardown path today), so this matches every other listener already set up in `App`'s constructor (`store.subscribe`, `setInterval`).
- **No visual affordance that the shortcut exists**: acceptable for a first pass; discoverability can be added later (e.g. a tooltip on the floor buttons) without changing this behaviour.

## Migration Plan

None: a self-contained UI addition to `leoiot-3d/explorer`, shipped the normal way (`main` → `release` promotion). No data, config or deploy-target changes.
