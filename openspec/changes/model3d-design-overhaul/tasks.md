# Tasks

## 1. Bold chrome tokens

- [x] 1.1 In `leoiot-3d/explorer/src/ui/styles.css`, add/strengthen the chrome tokens on `:root` (border width/colour, surface elevation, a bold font-weight token) without renaming or changing `--bg`, `--accent`, `--warn`, or any value read from `core/colours.ts` / `core/heatmap.ts`; verify with `grep -n "accent\|warn\|--bg" leoiot-3d/explorer/src/ui/styles.css` that those three values are unchanged from the pre-redesign file.
- [x] 1.2 Document the new tokens with a one-line comment each in `styles.css`; verify by reading the file top block.

## 2. Floor/view buttons and bar

- [x] 2.1 Restyle `.bar` and `.button` (and their `:hover`/`:disabled`/selected states) in `styles.css` for bold, high-contrast chrome, keeping the existing class names used by `controls.ts` and `navigation.ts`; verify by running the explorer dev server and visually confirming every floor button, the gym button and the heatmap toggle buttons render with the new style and still select/deselect on click.
- [x] 2.2 Verify no markup changes were needed in `controls.ts`/`navigation.ts` by running `git diff --stat leoiot-3d/explorer/src/ui/controls.ts leoiot-3d/explorer/src/ui/navigation.ts` and confirming it is empty (or review any change is non-behavioural).

## 3. Room info panel and loading screen

- [x] 3.1 Restyle the info panel classes consumed by `panel.ts` for the bold chrome look; verify by opening a room in the explorer and confirming the panel shows the same fields (room id, CO₂ with status, temperature) as before, now in the new style.
- [x] 3.2 Restyle the loading screen classes consumed by `loading.ts`; verify by reloading the explorer and confirming the loading screen still covers the view until models finish loading, then disappears, per `model3d/building-viewer`.

## 4. Route legend

- [x] 4.1 Restyle the legend container/entry classes consumed by `routeLegend.ts`, keeping each legend entry's own marker colour untouched; verify by triggering a route and confirming each legend entry's colour swatch still matches its marker's colour.

## 5. Regression check

- [x] 5.1 Run the explorer's existing test suite (`cd leoiot-3d/explorer && npm test --if-present`) and confirm it passes unchanged.
- [x] 5.2 Manually walk through: whole-building view, each floor view, the gym, both heatmaps, opening a room panel, and a route with its legend — confirm every control from before the redesign is still present and functional, only its look has changed.

## 6. Bottom dock layout

- [x] 6.1 Split `Controls` (`controls.ts`) into two dock-group elements — `element` (Floors: gym, floor buttons, reset) and `overlaysElement` (Overlays: heatmap toggles) — replacing the single `.bar`; verify with `npx tsc --noEmit` and that `Controls`' public API change compiles against its one caller (`main.ts`).
- [x] 6.2 Turn `Navigation`'s root (`navigation.ts`) into the Search dock-group (toggle + popover) and expose `nextFloorElement` separately from it; verify the same way.
- [x] 6.3 Assemble `.dock` in `main.ts` from `controls.element`, `controls.overlaysElement` and `navigation.element`, and append `navigation.nextFloorElement` directly to the app root, positioned above the dock; verify by running the dev server and confirming one bottom dock with three labelled groups (Floors, Overlays, Search) replaces the old left-middle bar and top-left search toggle.
- [x] 6.4 Restyle `.dock`/`.dock-group`/`.dock-group-label`/`.dock-group-buttons` in `styles.css` as a single-row, horizontally-scrolling (not wrapping) bar, and reposition `.nav-panel` to open upward as a `position: fixed` popover above the dock and `.next-floor` to sit above the dock; verify with a browser automation tool (Playwright) that the popover is actually visible when opened — not just that it exists in the DOM — since a `transform` on a centering ancestor can silently clip/mis-anchor a `position: fixed` descendant.
- [x] 6.5 Add `Navigation.closeOnRouteStarted()` and call it from `App.navigate()` on the success path only (not on a rejected destination); verify by starting a route from the search popover and confirming the popover closes and "Next floor" is fully visible, while a route to an unknown room still shows its error with the popover open.
- [x] 6.6 Re-run the full regression pass (tests, `tsc --noEmit`, production build, and a live walkthrough of floor switching, heatmap toggles, search → route → legend → next floor, at both a desktop and a narrow viewport) and confirm no behaviour changed, only the layout.

## 7. Selected-room watermark

- [x] 7.1 In `scene/viewer.ts`, create the `WebGLRenderer` with `alpha: true` and `setClearColor(0x000000, 0)` instead of an opaque `scene.background`; verify with a browser automation tool that the building model's own appearance (materials, shadows, edges) is visually unchanged against the page's `--bg`.
- [x] 7.2 Add `ui/watermark.ts` (`RoomWatermark`: `show(room)` / `hide()`), mount its element in `main.ts` before `stage` in DOM order (so the transparent canvas paints over it) and wire it from `app.ts`'s `render()` alongside `panel.show()`/`panel.hide()`; verify with `npx tsc --noEmit`.
- [x] 7.3 Style `.room-watermark` in `styles.css`: fixed, centred, `font-size: 85vh`, bold, using a new `--highlight` token matching `scene/materials.ts`' `HIGHLIGHT_COLOUR`; verify by selecting a room with a browser automation tool and confirming the room's number renders huge, behind the model (occluded where the model is opaque, visible around it), and matches the model's own highlight colour.
- [x] 7.4 Verify the watermark hides on deselect (closing the panel) and when a heatmap is toggled (which clears selection), with a browser automation tool checking the element's `hidden` state in both cases.
- [x] 7.5 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 8. Watermark refinement: tonal colour, fade, bigger

- [x] 8.1 Replace the `--highlight` token with `--watermark`, a shade barely lighter than `--bg`, and apply it to `.room-watermark`; verify by selecting a room with a browser automation tool and reading `getComputedStyle(...).color`.
- [x] 8.2 Increase `.room-watermark` to `font-size: 95vh` and `font-weight: 900`; verify the same way, reading `fontSize`/`fontWeight`.
- [x] 8.3 Switch `RoomWatermark.show()`/`hide()` from toggling the `hidden` attribute to toggling a `--visible` class, and give `.room-watermark` a `transition: opacity`, base `opacity: 0`; verify with a browser automation tool that a screenshot taken shortly after selecting a room shows the watermark mid-fade (partially visible), not at full opacity, and that `getComputedStyle(...).opacity` reaches `1` once the transition settles.
- [x] 8.4 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.
