# Design

## Context

The range lives in `src/core/ranges.ts` as `RangeId = '24h' | '7d'` with a fixed span ending now (`rangeBounds`). `src/core/flux.ts` `historyQuery()` builds the Flux query from the range id (`aggregateWindow(every: 5m|30m, fn: mean, createEmpty: true)`, windows aligned to UTC). `src/core/chartOptions.ts` and `renderChartFrame()` in `src/ui/render.ts` read the bounds and label the axis (times for 24 h, weekday and day for 7 days) and the window. `src/app.ts` keeps one history state per range, refreshes the 24-hour series on every live message (it also feeds the status sentence and the Heute column) and the shown range alongside. `#rangeGroup` in `index.html` holds two buttons with `data-range`; the range is kept neither in the address nor in the browser. DESIGN.md defines the segment (36px, control-edge border, pressed = ink with white text), flat panels without shadows, Lexend 400/700.

## Goals / Non-Goals

**Goals:**
- A third segment in the same control that chooses a first and a last day, using the browser's own date fields.
- One code path for history: every selection becomes start, end and averaging window.
- Readable charts for any span up to 13 months.
- Keep the 24-hour series and everything that depends on it untouched.

**Non-Goals:**
- Previous/next buttons, year comparison, the range in the address (the 3D explorer links to `?room=`; a date in the address is a later change), times of day.
- A self-made calendar widget.

## Decisions

**D1. A selection is `{ kind: '24h' } | { kind: '7d' } | { kind: 'dates', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }`.** `selectionBounds(selection, now)` replaces `rangeBounds()`: the two ranges as today; dates from local midnight of `from` (Europe/Vienna) to local midnight after `to` (so DST days are 23 or 25 hours), capped at now when `to` is today. Each selection also yields its window and whether it is live (24 h, 7 days, a range ending today) or fixed. Local midnight comes from the helper the Heute column already uses (`startOfLocalDay`), extended to a given date. Rejected: a third `RangeId` with a span, which cannot express a fixed past window.

**D2. Window by span.** For chosen dates: span ≤ 2 days → `5m`; ≤ 14 days → `30m`; ≤ 93 days → `4h`; otherwise `1d`. This keeps every chart between about 300 and 700 points (13 months of days ≈ 400). The 24 h and 7 d ranges keep `5m` and `30m`. The thresholds live in one table in `ranges.ts` with tests at each edge.

**D3. History query takes bounds and window, windows in local time.** `historyQuery(room, source, bounds, every)`; the query adds `import "timezone"` and `option location = timezone.location(name: "Europe/Vienna")` so that `4h` and `1d` windows start at local midnight, not UTC midnight. For `5m` and `30m` the alignment is the same as today. `createEmpty: true` stays, so missing readings remain gaps. The 24 h and 7 d callers pass `selectionBounds()`; their query result does not change (checked by the existing tests).

**D4. History state per selection key.** `app.ts` keeps its `24h` and `7d` states and one for the chosen dates (key `dates:2026-11-16:2026-11-20`); choosing other dates replaces it. A fixed range is loaded once and not refreshed by live messages; a range ending today refreshes like the 24 hours. The 24-hour series keeps refreshing whatever is shown, because the status sentence and Heute need it.

**D5. Control: a segment that opens a date panel.** The third segment is a `<button aria-expanded aria-controls>` with a 16px calendar icon (line icon, stroke 1.8, like the theme icons) and "Zeitraum wählen" (EN "Pick dates"). It opens a panel directly below the segment (HTML `popover`, anchored by position): white, hairline border, 9px corners, no shadow, 16px padding; inside, two labelled `<input type="date">` fields "Von" and "Bis" in control style (36px, control-edge border), both with `min` (today minus 13 months) and `max` (today), a one-line error in ink with the 16px warning triangle (amber ink, the one exception DESIGN.md already allows) only when "Von" is after "Bis", and the button "Anzeigen" in pressed-segment style (ink fill). "Von" is prefilled with the shown range's first day (or 7 days ago) and "Bis" with its last day (or today). Enter in a field or "Anzeigen" applies; Escape or a click outside closes without change; focus moves to "Von" on open and back to the segment on close. Once applied, the segment is pressed and reads "17.11. – 20.11." (same year as today), "17.11.2025 – 20.11.2025" (another year) or "Di 17.11." (one day); its accessible name is the full range ("Zeitraum: 16. bis 20. November 2026"). Below 640px the panel spans the page width under the top bar. Rejected: a visible date input inside the segment (two fields do not fit, and the native look differs per browser); a self-made calendar (much code and accessibility work); `<dialog>` (modal, too heavy for two fields).

**D6. Labels.** The chart window text states start and end like today ("16.11., 00:00 – 21.11., 00:00"); for a fixed range of whole days it reads "16.11. – 20.11.2026", for one day "Di 17.11.2026", and the window unit stays (`· ppm`). The axis shows times up to 2 days, weekday and day up to 14 days, day and month beyond. The tooltip names the window for `4h` and `1d` means ("Mittel 12:00–16:00", "Tagesmittel").

**D7. Mutual exclusion and lifetime.** Choosing "24 h" or "7 Tage" clears the dates; the segment then shows "Zeitraum wählen" again. The dates are forgotten on reload and when another room is opened (the room choice reloads the page), like the range today.

## Risks / Trade-offs

- [Flux `timezone` option on the platform's InfluxDB 2.7] → supported since Flux 0.140 (InfluxDB 2.1); verified in the browser check against the local `influxdb:2.7` stack, including a 1-day window across 25 October 2026.
- [The popover attribute in older browsers] → falls back to a panel shown with `hidden` toggling; the button keeps working.
- [Means hide peaks: a 1-day mean of a classroom is far below its afternoon peaks] → the window is named in the heading and tooltip; a max line is a later change if people ask.
- [The top bar gets wider] → the segment is about 160px with dates; checked at 1280 × 720 (one line) and 375px (wraps).
- [Confusion: charts show last week while the lamp shows now] → the heading states the range; the room panel keeps "Stand …" with today's time.

## Migration Plan

Ships with the next promotion; nothing to migrate; rollback is a revert.
