# Proposal

## Why

The 3D building explorer's UI chrome (panels, buttons, overlays, loading screen, legends, typography) is plain and low-contrast, which undersells a public-facing wayfinding and room-climate tool. The explorer needs a bold, high-contrast visual identity for its surrounding chrome without touching the 3D building model's own appearance, without removing any feature, and without changing the semantic colour scales (temperature/CO₂ heatmap, route legend) that other model3d capabilities already define.

## What Changes

- Redesign the explorer's UI chrome: the floor/view buttons, the room info panel, the loading screen, the heatmap toggle buttons, and the route legend get a bold, high-contrast visual language (typography, spacing, borders, elevation).
- The 3D building model itself (materials, textures, camera, lighting) is **not** restyled; it keeps its current appearance.
- The semantic data colours already specified for the temperature heatmap, the CO₂ heatmap and the route legend markers are **not** changed; only the chrome around them (panel backgrounds, borders, button states, typography) is restyled.
- No feature is removed, hidden or renamed; every button, panel and interaction that exists today keeps working exactly as before.

## Capabilities

### New Capabilities
- `model3d/visual-design`: the bold, high-contrast visual language for the explorer's UI chrome (buttons, panels, overlays, legends, typography, spacing) — explicitly excluding the 3D model's own rendering and the semantic data colour scales owned by `model3d/room-heatmap` and `model3d/room-navigation`.

### Modified Capabilities
- None. `model3d/building-viewer`, `model3d/room-climate-view`, `model3d/room-heatmap` and `model3d/room-navigation` are not yet merged into `openspec/specs/` (they are still in-flight changes `model3d-building-explorer` and `model3d-room-navigation`); this change does not alter any of their requirements, so no delta against them is needed. If those changes land first, this change's chrome restyling applies on top of them without changing their behaviour.

## Impact

- Code: `leoiot-3d/explorer/src/ui/*.ts` (`controls.ts`, `loading.ts`, `navigation.ts`, `panel.ts`, `routeLegend.ts`, `strings.ts`, `dom.ts`) and `leoiot-3d/explorer/src/ui/styles.css`; no changes to `leoiot-3d/explorer/src/scene/*` or `leoiot-3d/explorer/src/core/*`.
- No API, broker, data-contract or backend changes; this is a front-end-only visual change within `leoiot-3d`.
- Overlaps in the same files with the other in-flight `model3d-*` changes (`model3d-building-explorer`, `model3d-room-navigation`, `model3d-route-wayfinding`, `model3d-floor-arrow-keys`); whichever change merges later should rebase its chrome markup/CSS on the other rather than reverting it.
