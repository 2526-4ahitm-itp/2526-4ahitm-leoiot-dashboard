# Tasks

All paths below are in `leoiot-sensors/dashboard/`.

## 1. Core

- [ ] 1.1 Replace `rangeBounds()` in `src/core/ranges.ts` with the selection type and `selectionBounds()` (D1): 24 h, 7 days, fixed dates (local midnight to local midnight after the last day) and dates ending today (capped at now), with live flag; verify unit tests for each, including ranges over 29 March and 25 October 2026.
- [ ] 1.2 Add the window table (D2), the allowed span (today minus 13 months up to today) and a validator for `YYYY-MM-DD` pairs (both in span, first not after last); verify tests at each threshold (2, 14, 93 days) and for invalid input.
- [ ] 1.3 Make `historyQuery()` in `src/core/flux.ts` take bounds and window with the Europe/Vienna location (D3) and adapt its callers; verify the existing 24 h and 7 d query tests still pass and new tests cover a `4h` and a `1d` query.
- [ ] 1.4 Update `src/core/chartOptions.ts` and `renderChartFrame()` for chosen dates (D6: window text, axis labels by span, tooltip window name); verify tests for one day, several days, a long range and a range ending today in DE and EN.

## 2. Page

- [ ] 2.1 Add the third segment and its date panel to `index.html` and their texts to `src/core/i18n.ts` (D5); verify a frame test checks labels, `aria-expanded`, `aria-pressed`, `min`/`max` and the prefilled dates.
- [ ] 2.2 Panel behaviour in `src/ui/` (open, prefill, validation message, apply on Enter or "Anzeigen", close on Escape or outside click, focus handling); verify tests for apply, cancel, the "first after last" message and focus return.
- [ ] 2.3 Keep the selection in `src/app.ts` (D4, D7): fixed dates load once, dates ending today keep refreshing, "24 h" or "7 Tage" clears them, the 24-hour series keeps refreshing for the room panel; verify app tests for these cases and that the lamp and values do not change.
- [ ] 2.4 Style the segment and the panel in `src/styles/app.css` (36px controls, hairline panel without shadow, full width below 640px); verify `npm test` and `npm run build` pass.

## 3. Docs and checks

- [ ] 3.1 Update the top bar and segment parts of `leoiot-sensors/DESIGN.md` and add the date panel as a component; verify it describes the pressed state, the panel and its error line.
- [ ] 3.2 Browser check with the collector's local stack filled by the demo (7 days of history) plus a few backfilled older points: one day, several days, a range ending today (updates), a long range with daily means aligned to local midnight across 25 October, a range without readings, "first after last", back to 24 h; keyboard only; top bar at 1280 × 720 on one line and at 375px without sideways scroll; dark theme. Note findings in the pull request.
- [ ] 3.3 Run `openspec validate sensors-history-date-range --strict` and verify it passes.
