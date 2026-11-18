# Tasks

## 1. Resolve the selected room's two colours each render

- [x] 1.1 In `app.ts`'s `render()`, for the selected room compute a temperature-side colour and a CO2-side colour using `cell('temperature', reading, now)` / `cell('co2', reading, now)` from `core/heatmap.ts`: `kind === 'current'` uses `cell.colour`, `kind === 'none'` or `kind === 'stale'` uses the generic fallback (`STATUS_COLOUR.green` for temperature, `STATUS_COLOUR.yellow` for CO2). Verified: `core/heatmap.ts`'s own `cell()` already covers all three `kind`s, and `core/colours.ts`'s existing `STATUS_COLOUR` is reused as-is (no new colour constants) — `npm test` (13 files / 135 tests, including `tests/colours.test.ts` and `tests/heatmap.test.ts`) passes unchanged.
- [x] 1.2 Verify this computation runs on every render while a room stays selected, not only at the moment `this.selected` changes (so a live reading update is picked up) — confirmed: the colour computation sits directly in `render()`'s existing `else` branch (same branch as `panel.show()`), which runs on every `schedule()`/`render()` call (store updates, the staleness re-judge interval, and view changes), not only inside `select()`.

## 2. `RoomWatermark`: accept and apply two colours

- [x] 2.1 Change `RoomWatermark.show(room: string)` to `show(room: string, temperatureColour: string, co2Colour: string)` and store the two colours as CSS custom properties (`--watermark-temp`, `--watermark-co2`) on `.room-watermark` via `style.setProperty`, so `styles.css` can reference them in the gradient. Implemented; not yet confirmed in a running browser (no browser automation tool available in this session) — visual check of the two halves still outstanding, see 4.1.
- [x] 2.2 Update `app.ts`'s call site to pass the two colours computed in task 1.1 into `RoomWatermark`. Verified: `tsc --noEmit && vite build` (`npm run build`) passes clean; `app.ts`/`main.ts` is the only call site (grepped for `watermark.show`/`.show(`), and it now matches the new three-argument signature.

## 3. Render the split fixed to the screen's centre, not the text's

- [x] 3.1 In `styles.css`, replace `.room-watermark`'s single `color: var(--watermark)` with a `background: linear-gradient(to right, var(--watermark-temp, var(--watermark)) 50%, var(--watermark-co2, var(--watermark)) 50%)` plus `background-clip: text` / `-webkit-background-clip: text` and `color: transparent`, on the element's existing `inset: 0` full-viewport box, so the gradient's 50% stop is the viewport's own centre. Implemented; the browser-measurement check (bounding-rect boundary at exactly half the viewport width, for both a short and a long room id) is outstanding — no browser automation tool available in this session, see 4.1.
- [x] 3.2 Resolved differently from the original plan, on request: removed `-webkit-text-stroke` entirely rather than keeping it as a single neutral tone — the glyphs are now outlined only by `font-weight: 900`, with no separate stroke colour to reconcile against the clipped gradient fill. `npm run build` passes after the removal.

## 4. Verify the full set of scenarios

- [x] 4.1 Verified by the user directly in the running dev server (`localhost:5180`, no browser automation tool available this session): selecting a room shows two distinct colours split left/right, the outline is gone, and the boundary reads as centred on the screen rather than on the text.
- [x] 4.2 Covered by the same manual check in 4.1 — no regression reported to the watermark's existing fit-to-width behaviour.
- [x] 4.3 Run `cd leoiot-3d/explorer && npm test --if-present && npm run build` and confirm it passes. Done: 135/135 tests pass, `tsc --noEmit && vite build` succeeds.
