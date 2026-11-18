# Design

## Context

The explorer's chrome is styled entirely through CSS custom properties and plain classes in `leoiot-3d/explorer/src/ui/styles.css` (`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent`, `--warn`), consumed by `controls.ts`, `panel.ts`, `loading.ts`, `navigation.ts` and `routeLegend.ts`. There is no component framework or build-time theming layer — elements are built with plain DOM calls and styled by class name. See proposal.md - Why for the motivation.

## Goals / Non-Goals

**Goals:**
- Make the chrome bold and high-contrast (stronger borders/elevation, heavier type weight for labels and buttons, more deliberate use of the existing accent colour) while keeping the same `:root` custom-property names, so every consumer keeps working unchanged.
- Consolidate the primary always-visible controls (floor/view switching, heatmap toggles, room search) — previously three separate floating panels — into one grouped bottom dock, for desktop-browser use primarily.
- Keep the purely-visual part of the change (tokens, colours, type) CSS-only; the dock restructuring necessarily touches markup (`controls.ts`, `navigation.ts`, `main.ts`), but only to regroup existing elements, not to change what they do.

**Non-Goals:**
- Introducing a design system, CSS framework or build step (Tailwind, CSS-in-JS). The project has none today and this change does not need one for a single stylesheet.
- Changing the `--bg`, `--accent`, `--warn` values or the heatmap/legend colour constants in `core/colours.ts` and `core/heatmap.ts` — those stay as specified by `model3d/room-heatmap` and `model3d/room-navigation` (proposal.md - What Changes).
- Restyling the 3D canvas, camera or model materials.
- Optimizing the dock for touch/kiosk or mobile layouts: on narrow viewports the dock stays a single compact row and scrolls horizontally rather than wrapping or stacking, which is functional but not a first-class mobile design (desktop browser is the stated primary context).
- Moving the room info panel or the route legend into the dock: they are contextual results (shown only when a room is selected or a route is active), not primary controls, so they keep their existing floating positions.

## Decisions

- **Keep the existing custom-property names, change their values and add new ones for the bold treatment** (e.g. a heavier border width/colour token, a bolder font-weight token) rather than renaming variables. Alternative considered: introduce a new token set and migrate call sites — rejected, it touches every UI file for no behavioural gain and raises merge-conflict risk against the other in-flight `model3d-*` changes editing the same files.
- **Style purely through `styles.css` class rules**, not inline styles in the `.ts` files, so the visual language stays in one place.
- **Leave `core/colours.ts` and `core/heatmap.ts` untouched** so the semantic heatmap/legend colours are provably unchanged (proposal.md - Capabilities / `model3d/visual-design`).
- **One `.dock` wrapper, assembled in `main.ts`, holding three dock-group elements owned by their existing classes**: `Controls` now exposes `element` (Floors: gym + floor buttons + reset) and `overlaysElement` (Overlays: heatmap toggles) instead of one `.bar`; `Navigation.element` becomes the Search dock-group (toggle + popover), with `nextFloorElement` exposed separately since it is positioned above the dock, not inside it. Alternative considered: a single new `Dock` class owning all of this directly — rejected, it would merge `Controls`' view/heatmap state and `Navigation`'s search/route state into one class for a purely presentational grouping; `main.ts` composing existing components' elements is a smaller, more reversible change.
- **The search popover (`.nav-panel`) opens upward as a `position: fixed` overlay anchored above the dock**, and `Navigation.closeOnRouteStarted()` closes it once `App.navigate()` actually starts a route (called from `app.ts`, not on a rejected destination, so the error message in the popover stays visible per `model3d/room-navigation` "Invalid destination does not start navigation"). This keeps the popover from overlapping the repositioned "Next floor" control, which now sits directly above the dock instead of alone at the bottom-centre.
- **`.dock` is centred with `left: 0; right: 0; width: fit-content; margin: 0 auto`, not `left: 50%; transform: translateX(-50%)`.** A `transform` on an ancestor becomes the containing block for any `position: fixed` descendant (here, the search popover), which silently re-anchors and clips it instead of letting it escape to the viewport — found by actually opening the popover in a browser, not by static review. Avoiding `transform` on `.dock` keeps `.nav-panel`'s fixed positioning relative to the viewport as intended.

## Risks / Trade-offs

- [Merge conflicts with `model3d-building-explorer`, `model3d-room-navigation`, `model3d-route-wayfinding` and `model3d-floor-arrow-keys`, which touch the same `ui/` files] → The dock restructuring is an additional, separate commit on top of the earlier pure-CSS restyle, so a conflict there is easier to isolate; coordinate merge order with the other changes' authors.
- [A bolder, high-contrast chrome could reduce legibility of the heatmap/legend colours it sits next to] → Keep chrome surfaces and the 3D view visually separated (panel backgrounds, borders) so chrome contrast changes don't bleed into how heatmap/legend colours read against the model.
- [A CSS `position: fixed` + transformed-ancestor bug like the one above is easy to reintroduce silently] → Verified by actually opening the popover with a browser automation tool after the change, not just by `tsc`/unit tests (which don't touch the UI layer at all); any future change to `.dock`'s positioning should be re-verified the same way.
