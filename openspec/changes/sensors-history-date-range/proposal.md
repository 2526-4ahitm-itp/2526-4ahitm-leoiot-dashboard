# Proposal

## Why

The room page only shows the last 24 hours or the last 7 days, both ending now. Looking back at a particular school day ("how was the air in 105 last Tuesday during the exam?"), a week of holidays or a whole month means choosing 7 days and hunting through a dense chart, and anything older than a week cannot be seen at all, although readings are kept for at least 13 months (PRODUCT.md: "History: selectable dates and time ranges"). A date range next to "24 h | 7 Tage", in the same control, closes that gap.

## What Changes

- The time-range segment in the top bar gets a third segment, "Zeitraum wählen" (EN "Pick dates"), in the same control style. It opens a small panel below it with two date fields, "Von" and "Bis", and a button "Anzeigen". Once a range is shown the segment is pressed and shows it ("17.11. – 20.11.", a single day as "Di 17.11."), and "24 h" and "7 Tage" are released.
- A chosen range runs from 00:00 of the first day to 24:00 of the last day, local time (Europe/Vienna). One day is a range with the same first and last day. If the last day is today, the range ends now and keeps updating like the 24-hour range.
- Days from 13 months back up to today can be chosen; the first day may not be after the last day.
- The charts' averaging window grows with the span so that long ranges stay readable: five minutes up to 2 days, thirty minutes up to 14 days, four hours up to 93 days, one day beyond. The chart headings name the range and the window.
- The room panel (lamp, values, freshness, Heute) stays on the current values; only the charts change.
- Choosing "24 h" or "7 Tage" again releases the range.

Not in this change: previous/next buttons, comparing with the same range a year before, keeping the range in the address or across reloads, ranges with times of day.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: the requirement "Two time ranges" becomes "Time ranges and chosen dates" and adds the chosen date range.

## Impact

- Code in `leoiot-sensors/dashboard/`: `src/core/ranges.ts` (a chosen range, its bounds and window), `src/core/flux.ts` (history query for given bounds and window, local-time windows), `src/core/chartOptions.ts` and `src/ui/render.ts` (window labels, axis), `src/app.ts` (selection, loading, refresh), `src/core/i18n.ts` (DE/EN), `index.html` (third segment and its panel), `src/styles/app.css`; tests.
- Docs: `leoiot-sensors/DESIGN.md` (top bar, segment, the new date panel).
- No change to the data contract, the collector or the deployment. The longest query (13 months as daily means) returns about 400 points per quantity.
