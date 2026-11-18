# Design

## Context

The explorer's chrome is styled entirely through CSS custom properties and plain classes in `leoiot-3d/explorer/src/ui/styles.css` (`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent`, `--warn`), consumed by `controls.ts`, `panel.ts`, `loading.ts`, `navigation.ts` and `routeLegend.ts`. There is no component framework or build-time theming layer — elements are built with plain DOM calls and styled by class name. See proposal.md - Why for the motivation.

## Goals / Non-Goals

**Goals:**
- Make the chrome bold and high-contrast (stronger borders/elevation, heavier type weight for labels and buttons, more deliberate use of the existing accent colour) while keeping the same `:root` custom-property names, so every consumer keeps working unchanged.
- Keep the change CSS/markup-only wherever possible; avoid touching `core/` or `scene/` logic.

**Non-Goals:**
- Introducing a design system, CSS framework or build step (Tailwind, CSS-in-JS). The project has none today and this change does not need one for a single stylesheet.
- Changing the `--bg`, `--accent`, `--warn` values or the heatmap/legend colour constants in `core/colours.ts` and `core/heatmap.ts` — those stay as specified by `model3d/room-heatmap` and `model3d/room-navigation` (proposal.md - What Changes).
- Restyling the 3D canvas, camera or model materials.

## Decisions

- **Keep the existing custom-property names, change their values and add new ones for the bold treatment** (e.g. a heavier border width/colour token, a bolder font-weight token) rather than renaming variables. Alternative considered: introduce a new token set and migrate call sites — rejected, it touches every UI file for no behavioural gain and raises merge-conflict risk against the other in-flight `model3d-*` changes editing the same files.
- **Style purely through `styles.css` class rules**, not inline styles in the `.ts` files, so the visual language stays in one place and existing class names (`.bar`, `.button`, `.panel`, …) keep their meaning for the other in-flight changes that add markup under these classes.
- **Leave `core/colours.ts` and `core/heatmap.ts` untouched** so the semantic heatmap/legend colours are provably unchanged (proposal.md - Capabilities / `model3d/visual-design`).

## Risks / Trade-offs

- [Merge conflicts with `model3d-building-explorer`, `model3d-room-navigation`, `model3d-route-wayfinding` and `model3d-floor-arrow-keys`, which touch the same `ui/` files] → Land this change by restyling existing selectors/tokens rather than restructuring markup, so the diff is additive and rebases cleanly; coordinate merge order with the other changes' authors.
- [A bolder, high-contrast chrome could reduce legibility of the heatmap/legend colours it sits next to] → Keep chrome surfaces and the 3D view visually separated (panel backgrounds, borders) so chrome contrast changes don't bleed into how heatmap/legend colours read against the model.
