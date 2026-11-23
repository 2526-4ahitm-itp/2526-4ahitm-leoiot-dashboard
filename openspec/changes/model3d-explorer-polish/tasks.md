# Tasks

## 1. Spec delta

- [x] 1.1 Add the requirements "Enter starts navigation from the search box", "The destination room's number is shown behind the building" and "The active route can be printed" to `openspec/changes/model3d-room-navigation/specs/model3d/room-navigation/spec.md`. Verify with `openspec validate model3d-room-navigation --strict`.

## 2. Enter in the search box

- [x] 2.1 In `ui/navigation.ts`, a `keydown` listener on the input: Enter (not while composing) clears the suggestions and calls `go()`.

## 3. Room watermark

- [x] 3.1 Add `ui/roomWatermark.ts`, placed in the stage before the viewer's canvas: a 2D canvas, since CSS can't size text by its glyphs' height — the text is measured (`measureText` bounding box) and scaled so its glyphs span the full screen height, narrowed sideways only if wider than the screen; redrawn on resize. Make the renderer transparent (`alpha: true`) and drop the scene background; `.stage canvas` gets `position: relative` so it stacks above the watermark. Colour `--watermark: #53575e` against `--bg: #3a3d42`.
- [x] 3.2 In `app.ts`, remember the route's `destination` (cleared with the route and by Reset View) and show `destination ?? selected` on every render.

## 4. Printable route

- [x] 4.1 Add `Viewer.snapshot(root, route, markers)`: hides the live route, swaps in `root`, draws the given route and markers fully, renders once from a camera framed on the route and reads the canvas back as PNG, then restores everything.
- [x] 4.2 Add `ui/routePrint.ts` (hidden on screen; on paper replaces the page when not hidden) and a "Print route" button to `ui/routeLegend.ts`. In `app.ts`, `printSheet()` builds it on `beforeprint` from the full route: floors in `routeFloorSequence` order, markers numbered across floors with the colours `markerColour` gives them on screen.
- [x] 4.3 `npx tsc --noEmit`, `npm test` and `npm run build` pass.

## 5. Heatmap colour scale

- [x] 5.1 In `core/colours.ts`, export `scaleStops(kind)`: each stop's value, its position between the scale's ends (0–1) and its colour, from the same stop tables `temperatureColour`/`co2Colour` use. Test that each stop's colour equals what the heatmap paints a room with at that value. The project owner set the shown range to 5–30 °C and 400–1600 ppm (`LEGEND_RANGE`); room colours are unchanged, the range ends take the scale's own colour there.
- [x] 5.2 Add `ui/heatmapLegend.ts` (title, gradient from `scaleStops`, a tick per stop, an "Outdated" swatch in `STALE_COLOUR`), shown by `App.render` for the active heatmap only. First placed under the heatmap buttons in the left bar; the project owner wanted it on the right instead, so `main.ts` stacks it above the route legend in one right-hand column (`.side-right`), both panels the same width. Add the "The shown heatmap's colour scale is explained" requirement to `openspec/changes/model3d-building-explorer/specs/model3d/room-heatmap/spec.md`.
- [x] 5.3 Checked in headless Chrome: hidden without a heatmap; CO₂ and temperature scales shown; with route `203` and the CO₂ heatmap on floor 2 both panels stack on the right without overlapping, at 1400×900 and 400×800; hidden again after switching off.

## 6. Previous floor, watermark follow-ups

- [x] 6.1 In `ui/navigation.ts`, add "Previous floor ↓" (`onPreviousFloor`, `setPreviousFloorAvailable`) beside "Next floor ↑" in a bottom-centre `.floor-steps` group (replacing the single fixed `.next-floor`). In `app.ts`, `previousFloor()` steps one floor back along `routeFloorSequence`; `render()` shows it when the current floor's index in the sequence is above 0. Checked headless with `203`: Ground (next only) → Floor 1 (both) → Floor 2 (previous only) → back to Floor 1 → Ground.
- [x] 6.2 The watermark follows the room the user acted on last (`watermarkPrefers` in `app.ts`, set by `select` and `navigate`), so clicking a room during navigation shows that room instead of being overwritten by the destination. Glyphs fill 90 % of the screen height, centred (`HEIGHT_SHARE`).

- [x] 6.3 "Previous floor" gets Reset View's orange (`.floor-step-back`, `#e8b87a`, near-solid). `select()` in `app.ts` drops the route (`dropRoute()`, shared with `clearRoute()` and `reset()`) when the selected room is not the destination. New requirement "Selecting another room ends navigation" in the `model3d-room-navigation` delta.

- [x] 6.4 `Navigation.setQuery(room)`: `navigate()` writes the destination into the search box (so "Navigate here" fills it too), `dropRoute()` empties it when a route ends (another room selected, Clear, Reset View).

- [x] 6.5 `navigate()` selects the destination (replacing any other selection, switching a heatmap off like any selection); `setView()` keeps that selection on floors whose model lacks the room. New requirement "The destination is the selected room".

## 7. Manual verification

- [x] 7.1 Against the dev server with headless Chrome, room `203`: Enter in the search box started the route; the watermark showed `203` in `rgb(72, 76, 82) (since brightened to `#53575e`)`; the printed PDF had sections Ground floor (1. Stairs to Floor 1), Floor 1 (2. Stairs to Floor 2), Floor 2 (3./4. Right) with pictures showing the route and its coloured dots, and "Arrive at 203".
- [ ] 7.2 Project owner tries it locally and approves.
