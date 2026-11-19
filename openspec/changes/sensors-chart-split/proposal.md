# Proposal

## Why

The CO₂ chart is the dashboard's main history, with the lamp bands that explain "Bald lüften" and "Jetzt lüften", but it shares one box with humidity and gets only about half of its height. Temperature has a whole box of its own although it changes slowly. Decided with Elias Pointinger on 2026-11-19: CO₂ gets the large box on the left, temperature and humidity get their own smaller boxes on the right.

## What Changes

- Three chart boxes instead of two:
  - **CO₂** on the left, the full height of the chart area, with the lamp bands and the limit lines as today;
  - **temperature** on the right, at about the size of today's CO₂ panel;
  - **humidity** below temperature, at about the size of today's humidity panel.
- Each chart has its own heading, time window and note, as the two charts have today.
- The pointer stays shared: pointing at a time in any chart marks that time in all three and shows their values.
- Below 1100 px the three boxes stack: CO₂, temperature, humidity.

Not in this change: the time ranges, the queries, the room panel, the icons.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: "History is shown in two charts" becomes three charts, each in its own box, with the shared pointer kept.

## Impact

- `leoiot-sensors/dashboard/`: `index.html` (three panels), `src/core/chartOptions.ts` (the CO₂/humidity option split into two), `src/ui/charts.ts` (three instances in one connected group), `src/ui/render.ts` (headings, windows, notes, accessible names), `src/app.ts`, `src/styles/app.css`, tests; `leoiot-sensors/DESIGN.md` (chart panels) and the surface brief's first viewport.
- No data, query or contract change.
