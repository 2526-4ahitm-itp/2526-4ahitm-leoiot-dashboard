# Tasks

## 1. Bold chrome tokens

- [ ] 1.1 In `leoiot-3d/explorer/src/ui/styles.css`, add/strengthen the chrome tokens on `:root` (border width/colour, surface elevation, a bold font-weight token) without renaming or changing `--bg`, `--accent`, `--warn`, or any value read from `core/colours.ts` / `core/heatmap.ts`; verify with `grep -n "accent\|warn\|--bg" leoiot-3d/explorer/src/ui/styles.css` that those three values are unchanged from the pre-redesign file.
- [ ] 1.2 Document the new tokens with a one-line comment each in `styles.css`; verify by reading the file top block.

## 2. Floor/view buttons and bar

- [ ] 2.1 Restyle `.bar` and `.button` (and their `:hover`/`:disabled`/selected states) in `styles.css` for bold, high-contrast chrome, keeping the existing class names used by `controls.ts` and `navigation.ts`; verify by running the explorer dev server and visually confirming every floor button, the gym button and the heatmap toggle buttons render with the new style and still select/deselect on click.
- [ ] 2.2 Verify no markup changes were needed in `controls.ts`/`navigation.ts` by running `git diff --stat leoiot-3d/explorer/src/ui/controls.ts leoiot-3d/explorer/src/ui/navigation.ts` and confirming it is empty (or review any change is non-behavioural).

## 3. Room info panel and loading screen

- [ ] 3.1 Restyle the info panel classes consumed by `panel.ts` for the bold chrome look; verify by opening a room in the explorer and confirming the panel shows the same fields (room id, CO₂ with status, temperature) as before, now in the new style.
- [ ] 3.2 Restyle the loading screen classes consumed by `loading.ts`; verify by reloading the explorer and confirming the loading screen still covers the view until models finish loading, then disappears, per `model3d/building-viewer`.

## 4. Route legend

- [ ] 4.1 Restyle the legend container/entry classes consumed by `routeLegend.ts`, keeping each legend entry's own marker colour untouched; verify by triggering a route and confirming each legend entry's colour swatch still matches its marker's colour.

## 5. Regression check

- [ ] 5.1 Run the explorer's existing test suite (`cd leoiot-3d/explorer && npm test --if-present`) and confirm it passes unchanged.
- [ ] 5.2 Manually walk through: whole-building view, each floor view, the gym, both heatmaps, opening a room panel, and a route with its legend — confirm every control from before the redesign is still present and functional, only its look has changed.
