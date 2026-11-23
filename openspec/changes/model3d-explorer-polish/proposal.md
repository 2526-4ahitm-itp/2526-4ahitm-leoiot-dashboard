# Proposal

## Why

Requests from the project owner after using the explorer: the destination should stay recognisable at a glance while the camera moves around the building, a route should be something you can take with you on paper, the search box should react to Enter like any other search field instead of requiring a click on "Go", and the heatmap colours need explaining without cluttering the view.

## What Changes

- The destination room's id (without a route: the selected room's id) is shown behind the building model, from the top to the bottom edge of the screen, in a grey slightly brighter than the background. The 3D canvas becomes transparent for this; the background colour itself moves from the scene to the page.
- A "Print route" button in the route legend prints the whole active route: the destination, one section per floor in walking order with a picture of that floor's part of the route framed on the route, its turns and stairs as numbered, colour-matched steps, and the arrival. The browser's own print command (Ctrl+P) prints the same; without a route it prints the page as before.
- Enter in the room search box starts navigation like "Go".
- A "Previous floor ↓" control next to "Next floor ↑" steps back to the floor the route crosses before the one shown, so an earlier floor can be looked at again; hidden on the route's first floor.
- "Previous floor" is orange (Reset View's colour), "Next floor" stays green.
- Starting navigation selects the destination (highlight and info panel), replacing any other selected room, and keeps it selected through the route's floors.
- Selecting a room other than the destination ends the navigation, as if "Clear" was pressed; selecting the destination keeps it. The search box always names the active destination ("Navigate here" fills it too) and is emptied when the route ends. The watermark shows the room the user chose last.
- While a heatmap is on, its colour scale appears as a panel on the right, titled with the heatmap and stacked above the route legend in one right-hand column: the same colours the rooms get, over a fixed range (temperature 5–30 °C; CO₂ 400–1600 ppm) labelled at the ends and at the scale's stops plus the stale grey ("Outdated"). Gone when the heatmap is off.
- The route legend is now shown for every active route (it carries the print button), even a route without any turn or stairs marker.
- Not in this change: a PDF download, or any change to the route itself or to the heatmap colours.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None in `openspec/specs/`. The requirements belong to `model3d/room-navigation` and `model3d/room-heatmap`, both still in open changes. Their delta specs are edited directly in this pull request, the same way `model3d-route-wayfinding` amended them: `openspec/changes/model3d-room-navigation/specs/model3d/room-navigation/spec.md` gets three ADDED requirements, `openspec/changes/model3d-building-explorer/specs/model3d/room-heatmap/spec.md` one.

## Impact

- `leoiot-3d/explorer/src/ui/navigation.ts`: Enter in the search input calls the same `go()` as the button; "Previous floor" sits with "Next floor" in one bottom-centre group (`.floor-steps`).
- `leoiot-3d/explorer/src/ui/roomWatermark.ts` (new): the room id behind the 3D canvas, drawn on its own 2D canvas so it can be sized by its glyphs' height.
- `leoiot-3d/explorer/src/ui/routePrint.ts` (new): the print-only sheet.
- `leoiot-3d/explorer/src/ui/routeLegend.ts`: a "Print route" button; `update` takes whether a route is active.
- `leoiot-3d/explorer/src/scene/viewer.ts`: transparent renderer, no scene background; `snapshot(root, route, markers)` renders one floor with its route into a PNG data URL without touching the live view.
- `leoiot-3d/explorer/src/app.ts`, `src/main.ts`, `src/ui/strings.ts`, `src/ui/styles.css`: wiring, texts, watermark and print styles.
- `leoiot-3d/explorer/src/core/colours.ts`: `scaleStops(kind)` gives the legend's range ends and the stops within it, each with the colour a room of that value gets, so the legend draws the same scale; tested in `tests/colours.test.ts`.
- `leoiot-3d/explorer/src/ui/heatmapLegend.ts` (new), shown by `App.render`; `main.ts` puts it and the route legend into one right-hand column (`.side-right`), which now holds the fixed positioning the route legend had itself.
- No change to the `platform` data contract, `leoiot-sensors/` or `leoiot-pv/`.
