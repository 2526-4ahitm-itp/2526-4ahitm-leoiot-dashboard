# Tasks

All paths below are in `leoiot-sensors/dashboard/` unless noted.

## 1. Range calendar

- [x] 1.1 Add `src/core/calendar.ts` (D2: month grid with Monday first, pick rule, day state, month paging limits) with Vitest tests, including months starting on Sunday, leap February, the allowed-span edges and a pick before the first day.
- [x] 1.2 Make the date segment icon-only while no dates are shown (D1) in `index.html`, `src/ui/render.ts` and `src/styles/app.css`; verify frame tests for the accessible name, the hidden text and the text with dates.
- [x] 1.3 Replace the two date fields with the range calendar (D3, D4, D5) in `index.html`, a new `src/ui/rangeCalendar.ts` and `src/ui/datesPanel.ts`; texts in `src/core/i18n.ts` (DE/EN); verify tests for picking, hover preview, earlier day, one day, disabled days, paging limits, keyboard, apply, Escape and focus return.

## 2. Room list filter

- [x] 2.1 Add `filterEntries()` to `src/core/roomList.ts` (D6) with tests for search, floor, both, spaces and case, empty result.
- [x] 2.2 Add the toolbar, result line and no-match message (D7) in `index.html`, `src/ui/roomList.ts`, `src/listApp.ts`, `src/core/i18n.ts` and `src/styles/app.css`; keep search and floor in the address (D8); verify app tests for filtering, combining, reset, address read/write, redraws keeping the field and the vanished-floor fallback.

## 3. Docs and checks

- [x] 3.1 Update `leoiot-sensors/DESIGN.md` (date segment, date panel, room list toolbar); verify it matches the build.
- [x] 3.2 `npm test` and `npm run build` in `leoiot-sensors/dashboard/` pass.
- [x] 3.3 Browser check with the collector's local stack and the demo: calendar with mouse and keyboard, range ending today, long range, paging limits, 24 h again; room search, floor filter, no match, back from a room; top bar at 1280 × 720 on one line, 375px without sideways scroll, dark theme.
- [x] 3.4 `openspec validate sensors-range-calendar-room-filter --strict` passes.
