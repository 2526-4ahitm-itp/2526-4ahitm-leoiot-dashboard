# Proposal

## Why

The 3D building explorer's UI chrome (panels, buttons, overlays, loading screen, legends, typography) is plain, low-contrast and scattered across five separate floating panels with no grouping by purpose, which undersells a public-facing wayfinding and room-climate tool and makes the controls harder to scan. The explorer needs a bold, high-contrast visual identity and a more practical control layout, without touching the 3D building model's own appearance, without removing any feature, and without changing the semantic colour scales (temperature/CO₂ heatmap, route legend) that other model3d capabilities already define.

## What Changes

- Redesign the explorer's UI chrome: the floor/view buttons, the room info panel, the loading screen, the heatmap toggle buttons, and the route legend get a bold, high-contrast visual language (typography, spacing, borders, elevation).
- Consolidate the heatmap toggles, Reset View and the room search — previously separate floating panels — into one fixed dock with three labelled groups: **View** (Reset View), **Overlays** (temperature/CO₂ toggles) and **Search** (destination search, opening upward as a popover above the dock). Primary target is desktop browser use.
- Replace the one-button-per-floor list with three bare arrow buttons, not grouped into a panel: an up arrow near the top of the screen, a down arrow near the bottom, and a right-pointing arrow to the gym on the right, moving one floor at a time the same way the existing up/down arrow keys already do. Each arrow is captioned with the name of the floor or view it leads to (no caption when disabled). None of these three are inside the dock or any other panel.
- The dock (View, Overlays, Search) is left-aligned instead of centred.
- The room info panel and the route legend remain where they were (top-right and right-middle): they are contextual results, shown only when relevant, not part of the always-visible controls.
- The "Next floor" control sits just above the dock, on the same left edge.
- The 3D building model itself (materials, textures, camera, lighting) is **not** restyled; it keeps its current appearance.
- The semantic data colours already specified for the temperature heatmap, the CO₂ heatmap and the route legend markers are **not** changed; only the chrome around them (panel backgrounds, borders, button states, typography) is restyled.
- No feature is removed, hidden or renamed; every button, panel and interaction that exists today keeps working exactly as before — including the visible, non-hidden search control required by `model3d/room-navigation` ("Visible controls to start and clear navigation"): the dock's Search toggle and its popover are always reachable, never a hidden gesture.
- Selecting a room now also shows its number as a giant, bold watermark behind the 3D model, close to the full height of the screen: visible around the building's silhouette, occluded by the building itself where it's solid, so it reads as sitting behind the model rather than on top of it. It fades in on selection and fades out when deselected (closing the panel, switching to a heatmap, or changing floor away from the room), in a shade close to the page background so it reads as a tonal mark rather than a loud colour.

## Capabilities

### New Capabilities
- `model3d/visual-design`: the bold, high-contrast visual language for the explorer's UI chrome (buttons, panels, overlays, legends, typography, spacing) — explicitly excluding the 3D model's own rendering and the semantic data colour scales owned by `model3d/room-heatmap` and `model3d/room-navigation`.

### Modified Capabilities
- None. `model3d/building-viewer`, `model3d/room-climate-view`, `model3d/room-heatmap` and `model3d/room-navigation` are not yet merged into `openspec/specs/` (they are still in-flight changes `model3d-building-explorer` and `model3d-room-navigation`); this change does not alter any of their requirements, so no delta against them is needed. If those changes land first, this change's chrome restyling applies on top of them without changing their behaviour.

## Impact

- Code: `leoiot-3d/explorer/src/ui/*.ts` (`controls.ts`, `loading.ts`, `navigation.ts`, `panel.ts`, `routeLegend.ts`, `strings.ts`, `dom.ts`, new `watermark.ts`, new `floorStepper.ts`), `leoiot-3d/explorer/src/ui/styles.css`, `leoiot-3d/explorer/src/main.ts`, `leoiot-3d/explorer/src/app.ts`; and `leoiot-3d/explorer/src/scene/viewer.ts` (the renderer now clears to transparent instead of an opaque scene background, so the watermark can show through where the scene draws no geometry).
- No API, broker, data-contract or backend changes; this is a front-end-only visual change within `leoiot-3d`.
- Overlaps in the same files with the other in-flight `model3d-*` changes (`model3d-building-explorer`, `model3d-room-navigation`, `model3d-route-wayfinding`, `model3d-floor-arrow-keys`); whichever change merges later should rebase its chrome markup/CSS on the other rather than reverting it.
