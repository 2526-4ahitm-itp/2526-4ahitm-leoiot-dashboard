# Tasks

## 1. Spec delta

- [x] 1.1 In the still-open `openspec/changes/model3d-room-navigation/specs/model3d/room-navigation/spec.md` (not a file in this change's own directory — see `proposal.md` - Capabilities): reword "Multi-floor navigation crosses at a stairway" to drop the now-false "switches to the destination's floor" clause, and add `ADDED Requirements` for starting on the route's own first floor, the progressive multi-floor reveal with its "next floor" control, and the turn/stairs markers. Verify with `openspec validate model3d-room-navigation --strict`.

## 2. Share the floor order

- [x] 2.1 Move `FLOOR_ORDER` (the floor buttons' top-to-bottom order) from a private constant in `leoiot-3d/explorer/src/ui/controls.ts` into `src/core/rooms.ts`, exported, typed as a literal tuple via `satisfies readonly FloorId[]`. Update `ui/controls.ts` and `app.ts` (already using this order for arrow-key stepping) to import it from there instead. Verify with `tsc --noEmit`.

## 3. Floor-tagged route points

- [x] 3.1 In `leoiot-3d/explorer/src/nav/route.ts`, add `RoutePoint extends WorldPoint` with a `floor: FloorId`, and change `RouteResult`/`routeOnMainFloors` to use it (the per-node floor was already available via `GraphNode.floor`). Tag `routeInGym`'s result with `floor: 'T'` at its one call site in `routeTo` instead of touching that function's body. Verify with the existing `tests/route.test.ts`/`tests/nav-graph.test.ts` (unchanged, still passing — confirms adding a field breaks nothing).
- [x] 3.2 Add `routeFloors(points)` (the ordered distinct floor sequence) and `isFloorVisible(floor, view)`/`visibleRoutePoints(points, view)` (the same "floor and everything beneath it" rule the floor views use) to `nav/route.ts`. Verify with new `tests/route-view.test.ts`.

## 4. Turn and stairs markers

- [x] 4.1 Add `leoiot-3d/explorer/src/nav/markers.ts`: `turnMarkers(points)` (a left/right marker at each interior point where the corridor bends past a 25° threshold, skipping a floor change) and `stairMarkers(points)` (an up/down marker naming the destination floor at each point the route crosses floors). Verify with new `tests/markers.test.ts`, including the left/right sign convention locked in by a from-scratch synthetic case (walking `+X` then turning to `+Z` is a right turn).

## 5. Wiring into the viewer and navigation UI

- [x] 5.1 In `leoiot-3d/explorer/src/ui/navigation.ts`, add a "Next floor ↑" button next to "Clear" (hidden by default) with an `onNextFloor` callback and a `setNextFloorAvailable(available)` method. Add its text to `ui/strings.ts` (`navigation.nextFloor`) along with the marker label text (`routeMarker.turnLeft`/`turnRight`/`stairsUp`/`stairsDown`). Add a `.route-marker` badge style to `ui/styles.css`.
- [x] 5.2 In `leoiot-3d/explorer/src/app.ts`: track `activeRoute`/`routeFloorSequence`; `navigate(room)` now starts on `routeFloorSequence[0]` instead of the destination's floor; add `nextFloor()`, wired to `navigation.onNextFloor`; `render()` now calls `viewer.showRoute(visibleRoutePoints(...))`, appends the current floor's marker labels to the existing heatmap-label list passed to `viewer.setLabels(...)`, and calls `navigation.setNextFloorAvailable(...)`; `clearRoute()` resets the new state and re-renders. Verify with `tsc --noEmit` and `npm run build`.

## 6. Manual verification

- [x] 6.1 Verified against the real running dev server with a headless browser through the actual search → "Go" → "Next floor" → "Next floor" → "Clear" flow for room `203` (a ground-floor-to-floor-2 route): starts on "Ground floor" (not "Floor 2"); a "Stairs to Floor 1" marker is visible immediately; "Next floor" is visible and, clicked, advances to "Floor 1" and reveals a second "Stairs to Floor 2" marker; clicked again, advances to "Floor 2" and "Next floor" disappears (no further floor); "Clear" removes the route, every marker, and hides "Next floor" again.
- [x] 6.2 Verified a single-floor gym route (`T1`): starts on "Gym", "Next floor" never appears (only one floor in its sequence), and its own turn markers still show.
- [x] 6.3 `npm test` (131 tests, up from 114) and `npm run build` in `leoiot-3d/explorer` pass.

## 7. Markers beside the route, "Next floor" as its own control

- [x] 7.1 Project owner reported the markers should sit to the side of the route line, not on it, and that "Next floor" should be its own bigger, semi-transparent, bottom-centre control rather than a third button in the search panel. In `nav/markers.ts`, add a `sideOffset` (world-space XZ) to each `TurnMarker`/`StairMarker`, derived from the same `forward × up` geometry as the turn direction (outside of the bend for a turn; right of the approach direction for a stairs crossing), fixed at 2 world units. Verify with updated `tests/markers.test.ts`: each `sideOffset` is perpendicular to the relevant direction (zero dot product) and has the expected length, rather than asserting brittle literal coordinates.
- [x] 7.2 In `app.ts`'s `routeMarkerLabels()`, add each marker's `sideOffset` to its displayed position. In `ui/navigation.ts`, move `nextFloorButton` out of the `nav-panel`'s `nav-actions` row and append it directly to `Navigation.element` instead, with a new `next-floor` class. Style `.next-floor` in `ui/styles.css`: fixed, bottom-centre, bigger padding/font, a semi-transparent green background with a blur, and a smaller variant under the existing 600px breakpoint. Verify with `tsc --noEmit`, `npm test` (131 tests, unaffected), and `npm run build`.
- [x] 7.3 Verified against the real running dev server with a headless browser (room `203` again): the "Next floor" button renders fixed at the bottom centre of the viewport, visibly larger and translucent; marker badges (e.g. "↱ Right", "⬆ Stairs to Floor 1") are now offset from the stairwell/corridor point they mark rather than stacked exactly on it.

## 8. Coloured dots on the route, explained in a fixed legend on the right

- [x] 8.1 Project owner clarified "on the side" meant the side of the *screen* (a fixed 2D panel), not an offset in 3D space, and asked for each marker to get its own colour matched between a dot on the route and its explanation. In `nav/markers.ts`, drop `sideOffset` and the geometry behind it; add `pointIndex` to each marker (its position in the route's point list) and two new exports: `routeMarkers(points)` (turns and stairs crossings merged and sorted by `pointIndex`) and `markerColour(index)` (a small fixed palette, distinct from the route's own green, cycled by index). Verify with rewritten `tests/markers.test.ts`.
- [x] 8.2 Add `leoiot-3d/explorer/src/ui/routeLegend.ts`: `RouteLegend`, a fixed right-hand panel (hidden when empty) listing one coloured row per visible marker. Wire it into `main.ts` next to the other UI pieces and into `App`'s constructor.
- [x] 8.3 In `app.ts`, replace the old side-offset marker labels with `visibleRouteMarkers()`: colours are assigned from the *full*, unfiltered route (so a marker's colour doesn't change as more floors are revealed), then filtered by `isFloorVisible` for display. `render()` now adds one small coloured dot (`.route-dot`) per visible marker at its exact point, and calls `routeLegend.update(...)` with the matching coloured text rows. Replace `.route-marker` with `.route-dot` (a plain coloured circle) and add `.route-legend`/`.route-legend-row`/`.route-legend-swatch` to `ui/styles.css`. Verify with `tsc --noEmit`, updated `tests/markers.test.ts` (135 tests total), and `npm run build`.
- [x] 8.4 Extend the "Turn and stairs markers" requirement in the `model3d-room-navigation` spec delta: each marker is shown at its own exact point (no offset), and its colour matches a legend entry, so markers whose points are close together stay distinguishable. Verify with `openspec validate model3d-room-navigation --strict`.
- [x] 8.5 Verified against the real running dev server with a headless browser (room `203`, which has 4 markers clustered near one stairwell by the time floor 2 is reached): each dot and its legend row share the exact same colour (confirmed by reading both the dot's and the swatch's CSS colour, not just eyeballing a screenshot); a marker's colour is unchanged after advancing to the next floor; "Clear" empties and hides the legend and removes every dot; the gym route (`T1`, 3 turn markers, no stairs) shows a matching 3-row legend with no "next floor" button.
