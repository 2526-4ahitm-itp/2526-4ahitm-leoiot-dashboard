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

## 12. Floor stepper, and the rest of the menu moves left

- [x] 12.1 Add `ui/floorStepper.ts` (`FloorStepper`): an up button, a current-floor label, a down button, and a separate Gym button; `update(view)` sets the label text, disables the up/down buttons at either end of `FLOOR_ORDER` or in the gym, and sets Gym's `aria-pressed`. Add `strings.views.full` ("Overview") and `strings.floorStepper` (up/down aria-labels); verify with `npx tsc --noEmit`.
- [x] 12.2 In `controls.ts`, remove the floor/gym buttons and the `views` map entirely (now owned by `FloorStepper`); rename its "Floors" dock-group (`element`) to a "View" dock-group (`resetElement`) holding only Reset View. Update `strings.dock` accordingly (`floors` → `view`).
- [x] 12.3 In `app.ts`, extract the arrow-key handler's floor-index math into `step(direction: 1 | -1): boolean` (returns whether it moved, so `handleKey` still only calls `preventDefault()` on an actual move); wire `floorStepper.onStep = (d) => this.step(d)` and `floorStepper.onGym = () => this.setView('T')`; call `floorStepper.update(this.view)` in `render()` alongside `controls.update(...)`. Verify with `npx tsc --noEmit` and that `tests/*.test.ts` (unaffected core/nav logic) still pass.
- [x] 12.4 In `main.ts`, construct `FloorStepper`, append its element to the app root (not into `.dock`), assemble `.dock` from `controls.resetElement`, `controls.overlaysElement` and `navigation.element`, and pass `floorStepper` into `new App(...)`.
- [x] 12.5 Style `.floor-stepper`/`.floor-stepper-stack`/`.floor-stepper-arrow`/`.floor-stepper-label` in `styles.css`: a small floating control at the same left edge as the dock (`left: 16px`), up arrow on top, label, down arrow on bottom, Gym button beside the stack.
- [x] 12.6 Change `.dock` from centred (`left:0;right:0;width:fit-content;margin:0 auto`) to left-aligned (`left: 16px`), keeping it `transform`-free (task 6.4's containing-block fix still applies); update `.next-floor` to the same left edge (`left: 16px`, no `transform`) since it's paired with the dock.
- [x] 12.7 Add `Navigation.positionPanel()`: reads the Search toggle's `getBoundingClientRect()` and sets `.nav-panel`'s `left` to its centre, called on open and on window `resize` while open; remove `.nav-panel`'s fixed `left: 50%` (now a JS-set value, `transform: translateX(-50%)` stays static). Verify with a browser automation tool that opening the popover positions it above the Search toggle, not screen-centre.
- [x] 12.8 Verify end-to-end with a browser automation tool: step through floors with the stepper's buttons (label and disabled states update correctly at each end and in the gym), confirm the up/down arrow keys still produce the identical moves, activate Gym, start a route via search and confirm the popover/"Next floor" pairing still works with the dock in its new left-aligned position.
- [x] 12.9 Fix a pre-existing CSS specificity bug found while verifying 12.8: `.button:hover:not(:disabled)` outranked `.button[aria-pressed='true']`, so hovering the pressed Gym button (confirmed with `getComputedStyle`) showed the plain hover tint instead of the accent fill. Exclude `[aria-pressed='true']` from the generic hover rule and add `.button[aria-pressed='true']:hover:not(:disabled)` with a brighter accent; re-verify with `getComputedStyle`.
- [x] 12.10 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 13. Floor switching as bare buttons, not a boxed stepper

- [x] 13.1 Rework `FloorStepper` (`floorStepper.ts`): drop the `.floor-stepper` wrapper, the stack layout and the floor-name label; expose `upElement`, `downElement` and `gymElement` as three independent `<button>`s instead of one `element`. `update(view)` keeps the same disabled/`aria-pressed` logic, just with no label to set. Remove the now-unused `strings.views.full` ("Overview"). Verify with `npx tsc --noEmit`.
- [x] 13.2 In `main.ts`, append the three elements directly to the app root instead of one wrapper.
- [x] 13.3 Restyle in `styles.css`: `.floor-arrow` (bare `.button`, `left: 50%; transform: translateX(-50%)`) with `.floor-arrow-up` (`top: 16px`) and `.floor-arrow-down` (`bottom: 16px`); `.floor-gym` on the right. Remove `.floor-stepper`/`.floor-stepper-stack`/`.floor-stepper-arrow`/`.floor-stepper-label` and their mobile-media-query counterparts.
- [x] 13.4 Verify with a browser automation tool that `.floor-arrow-down` and `.dock` (now both near the bottom of the screen, one centred and one left-aligned) don't overlap, by comparing their bounding rects — confirmed a 32px gap at 1280px width, not assumed from a screenshot.
- [x] 13.5 Found with a browser automation tool while verifying 13.4: `.floor-gym`, first placed at `right: 16px; top: 50%` (vertically centred, same as `.route-legend`), was fully covered by the legend during an active route — not a rare edge case, the two shared the exact same anchor. Move `.floor-gym` to `bottom: 16px` instead; re-verify by measuring both elements' bounding rects against this building's actual longest route (a floor-2 destination, 3 floors) rather than the short single-floor route used in earlier checks, confirming no overlap in the real worst case, not just the common one.
- [x] 13.6 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 14. Captioned arrows, Gym as a right-pointing arrow

- [x] 14.1 Rework `FloorStepper`: `upElement`/`downElement`/`gymElement` become small layout-only wrapper `<div>`s (`.floor-arrow-group`, no background/border/shadow), each holding its arrow `<button>` (`.floor-arrow`) and a caption `<span>` (`.floor-arrow-caption`). Gym's glyph changes from the text "Gym" to "▶"; add `strings.floorStepper.gym` as its `aria-label` (the visible caption now carries the "Gym" text instead). Verify with `npx tsc --noEmit`.
- [x] 14.2 `update(view)` sets each caption from the floor one step in that arrow's direction (`FLOOR_ORDER[index ± 1]`), left empty when that arrow is disabled rather than naming a destination that doesn't exist; Gym's caption is the constant "Gym". Up/down disabled logic is unchanged from task 13.
- [x] 14.3 Restyle in `styles.css`: `.floor-arrow-group` (`position: fixed; display: flex`) with `.floor-arrow-group-up`/`-down` (`flex-direction: column`, centred horizontally) and `.floor-arrow-group-gym` (`flex-direction: row`, at the previously-fixed bottom-right position — unchanged from task 13.5's collision fix); `.floor-arrow-caption` (small bold text with a `text-shadow`, no background, since it floats directly over the model/sky with no panel behind it).
- [x] 14.4 Verify with a browser automation tool: captions update correctly when stepping floors (e.g. the down arrow reads "Floor 2" from the whole-building view, "Floor 1" from floor 2) and go empty exactly when their arrow is disabled (top floor, basement, gym); Gym shows "GYM ▶" and its pressed/hover states still work.
- [x] 14.5 Re-verify the task-13.5 collision fix still holds with Gym's new (wider, captioned) bounding box: measured against this building's actual longest route (a floor-2 destination, 3 floors) with a browser automation tool — no overlap with `.route-legend`.
- [x] 14.6 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 15. Gym back to the middle, plus a back arrow from the gym

- [x] 15.1 Move `.floor-arrow-group-gym` from `bottom: 16px` back to `top: 50%; transform: translateY(-50%)` (vertically centred on the right), on request. Re-verify with a browser automation tool against this building's longest real route whether this reinstates the `.route-legend` collision from task 13.5 — confirmed `intersects: true`, not assumed.
- [x] 15.2 Mitigate rather than silently ship: reorder `main.ts`'s `root.append(...)` so `routeLegend.element` comes before the floor-arrow elements, keeping Gym painted on top of (not hidden under) the legend when they overlap. Re-verify with a browser automation tool that Gym stays visible/clickable; the panels can still visually overlap, which is reported to the user as a known cosmetic trade-off of the requested position, not resolved further.
- [x] 15.3 Add `FloorStepper.backElement`: a left-pointing arrow (`◀`) captioned "Overview" (`strings.views.full`, reinstated), shown only while `view === 'T'` (`update()` sets `.hidden`), positioned vertically centred on the left (mirroring Gym). `onBack` wired in `app.ts` to `setView('full')` — a plain view change, not `reset()`, so it doesn't clear an unrelated heatmap or route. Verify with a browser automation tool: hidden outside the gym, shown and functional inside it, hidden again after use.
- [x] 15.4 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.

## 16. Simpler chevron arrows, no boxy look

- [x] 16.1 In `floorStepper.ts`, replace the four Unicode glyphs (▲▼▶◀) with one `">"` character per button, dropping the shared `button` class in favour of direction classes (`floor-arrow-up`/`-down`/`-left`/`-right`) plus the base `floor-arrow` class.
- [x] 16.2 In `styles.css`, rewrite `.floor-arrow` as a minimal, unboxed control (no border/background), add `transform: rotate()` per direction class to turn the one glyph into up/down/left/right, and redefine hover/disabled/`aria-pressed`/focus states through colour (`var(--accent)`/`var(--muted)`) instead of a background fill, since `.button`'s rules no longer apply.
- [x] 16.3 Verify with a browser automation tool: each arrow renders as a plain rotated chevron with no border or background, Gym's pressed state and the disabled up/down states still read correctly through colour alone.
- [x] 16.4 Run the full regression pass (tests, `tsc --noEmit`, production build) and confirm no existing behaviour changed.
