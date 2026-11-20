# Proposal

## Why

The day summary can contradict itself. On 2026-11-20 room 105 showed "Über 1000 ppm: noch nicht" next to "Höchstwert 1 034 ppm · 12:46": a single reading spiked above 1000 ppm, but the time above 1000 ppm is counted from five-minute means, and that window's mean stayed below 1000. Decided with Elias Pointinger on 2026-11-20: count the time above 1000 ppm from the stored readings themselves, in whole minutes.

## What Changes

- The time above 1000 ppm is the number of whole minutes of today in which the highest stored CO₂ reading is above 1000 ppm. It comes from its own query (one-minute maximum windows, counted), like the peak, instead of the five-minute chart series.
- The live reading raises it like it raises the peak: when today's highest value (stored or live) is above 1000 ppm, the time is at least one minute. So "not above 1000 ppm today" and a peak above 1000 ppm can no longer appear together.
- The scenario of "Two time ranges" names all three charts (left over from `sensors-chart-split`).

Not in this change: the peak, the airing estimate, the charts, the limits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: "The day is summarised next to the values" counts the time above 1000 ppm in minutes of stored readings; "Two time ranges" names three charts.

## Impact

- `leoiot-sensors/dashboard/`: `src/core/flux.ts` (new query), `src/data/load.ts`, `src/core/today.ts`, `src/app.ts`, tests.
- One more small query per room page and minute. No data, contract or layout change.
