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

## 9. Watermark: fill the screen height, stay legible

- [x] 9.1 Measure the watermark's actual rendered glyph box (not just the `font-size` CSS value) with a browser automation tool — a `Range` bounding rect around the text — since font metrics and the stroke make the ink noticeably taller than `font-size` itself; use that to calibrate, rather than guessing a `vh` number.
- [x] 9.2 Add `-webkit-text-stroke` (same colour as the fill) to `.room-watermark`, since `font-weight` tops out at 900 and the stroke is the only further way to thicken the glyph edges for a bolder look.
- [x] 9.3 Set `font-size: min(82vh, 55vw)` (replacing a plain `vh` value), calibrated from the 9.1 measurement so a typical 3-character room id both nearly touches the top and bottom of the screen and stays fully on-screen horizontally — a plain large `vh` value pushed a 3-digit id off both edges, which was verified and rejected before landing this value. Verify by selecting a room with a browser automation tool, reading the text's bounding rect, and confirming it's both ≥90% of the viewport height and ≤95% of the viewport width.
- [x] 9.4 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 10. Watermark: taller still, a squarer font

- [x] 10.1 Switch `.room-watermark`'s `font-family` to a system monospace stack (`ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace`), for squarer, blockier digit shapes than the page's proportional sans; no external font load, so no new network dependency for a kiosk-style app.
- [x] 10.2 Re-measure the rendered glyph box the same way as 9.1 (the width/height-per-`font-size` ratios change with the font) and recalibrate `font-size` to `min(100vh, 54vw)`, loosening both caps from 9.3 so the text reaches, and now even just overflows, the top/bottom edge (clipped by the pre-existing `overflow: hidden` on `body`/`#app`) while staying within ~95% of the viewport width. Verify the same way as 9.3.
- [x] 10.3 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 11. Watermark: fit room ids longer than the calibrated case

- [x] 11.1 Confirm real room ids exceed the 3-character case `min(100vh, 54vw)` was calibrated for (`grep` `leoiot-3d/explorer/src/nav/room-positions.generated.ts`: ids up to 7 characters, e.g. `UBiolab`, `U74.1`, `134_1`); a fixed CSS formula can't fit every length, so sizing needs to measure the actual id at runtime.
- [x] 11.2 Add `RoomWatermark.refit()`: resets any inline `font-size` override to the CSS baseline, measures the rendered text width, and — only if it exceeds 94% of the viewport width — scales `font-size` down proportionally via an inline style; called from `show()` and on `window`'s `resize` event. Short ids are unaffected (no inline override needed); verify with `npx tsc --noEmit`.
- [x] 11.3 Measure with a browser automation tool, not just by eye: confirmed `Element.scrollWidth` under-reports the width of text that overflows symmetrically under `justify-content: center` (compared directly against a `Range` bounding-rect measurement of the same text at two font sizes, which stayed linear with font-size while `scrollWidth` did not) — so `refit()` measures via a `Range` around the text instead of `scrollWidth`.
- [x] 11.4 Change `-webkit-text-stroke` from `1.4vh` to `0.016em`: a fixed (`vh`) stroke width doesn't shrink proportionally with `font-size`, which would have made `refit()`'s single proportional scaling step inaccurate for a badly-overflowing id.
- [x] 11.5 Verify end-to-end with a browser automation tool: select a real room (sets a short id and exercises the normal `show()` path), then swap in a long real id (`UBiolab`) and dispatch a `resize` event to exercise the same `refit()` code path the app itself uses, confirming the rendered width stays within the viewport while the text remains legible.
- [x] 11.6 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.
