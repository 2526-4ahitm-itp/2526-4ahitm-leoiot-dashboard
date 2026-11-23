# Tasks

All paths below are in `leoiot-sensors/dashboard/`.

## 1. Core and data

- [ ] 1.1 Add `summarise()` to `src/core/roomList.ts` (rooms, bad, soon, stale; for the list and per floor, D6) and verify new cases in `tests/roomList.test.ts` pass, including a floor with all zero state counts.
- [ ] 1.2 Add `failed()` and `lastLoadAt()` to `src/data/roomsSource.ts` (D8) and verify in `tests/roomListApp.test.ts` that a failing stored-readings load sets `failed()`, a later success clears it, and `lastLoadAt()` keeps the last successful time.
- [ ] 1.3 Add the DE and EN texts to `src/core/i18n.ts` (summary counts with singular and plural, "Live-Werte", fallback line with time, legend line, load error, "simuliert" for screen readers) and verify the existing i18n parity test, or a new one, passes for both languages.

## 2. Rendering

- [ ] 2.1 Rebuild the list entry in `src/ui/roomList.ts` as one line: lamp dot or warning triangle, id, state (good air in a visually hidden span), value; simulated rooms announced in a visually hidden span; keep the in-place update. Verify `tests/roomList.test.ts` checks the visible and hidden texts for good, soon, bad, no-CO₂, outdated and simulated rooms, and that a focused link keeps focus across a redraw.
- [ ] 2.2 Add the summary line, the freshness line and the legend line to the list header (`index.html`, `src/ui/roomList.ts`, `src/listApp.ts`), remove the old fallback note, and add counts to the floor headings. Verify tests for live mode, fallback mode with "Stand 11:14", and the legend shown only with a simulated room.
- [ ] 2.3 Show the load error instead of "Derzeit sendet kein Raum Messwerte" when the fallback failed and no room is known (D8). Verify a test with a failing query shows the error text and never the "no room" text.
- [ ] 2.4 Update `src/styles/app.css`: one-line grid, 240 px minimum column, dashed outline for `[data-source='simulated']`, outdated triangle and muted value at weight 400, wrapping of the state word in narrow columns. Verify `npm test` and `npm run build` pass.

## 3. Docs and checks

- [ ] 3.1 Update the room list part of `leoiot-sensors/DESIGN.md` (entry layout, dashed outline, summary and freshness line, outdated entry) and verify it no longer mentions the "simuliert" pill in the list.
- [ ] 3.2 Browser check with the collector's local stack filled by the demo: at 1440 × 900 the page is at most about 1,400 px high and every entry is one line; at 375 × 812 nothing scrolls sideways; dark theme readable; at 200 % zoom entries wrap instead of cutting text; with the stack's database stopped the list shows the load error. Save the screenshots' findings in the pull request description.
- [ ] 3.3 Run `openspec validate sensors-room-list-glance --strict` and verify it passes.
