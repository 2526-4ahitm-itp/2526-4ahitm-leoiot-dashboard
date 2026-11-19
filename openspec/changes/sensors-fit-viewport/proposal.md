# Proposal

## Why

The room page is 990 px high at every window size, because the room panel, the chart boxes and the spacing all have fixed heights. At 100 % browser zoom it overflows every usual window: by 30 px in a 1080p window (1920 × 960), by 200 px on a MacBook Air (1440 × 789), by 310 px at 1280 × 680. Measured on vm23 on 2026-11-19. The charts already follow the size of their boxes, so only the layout keeps the page from fitting. Decided with Elias Pointinger on 2026-11-19: tighter spacing, and the charts fill the height the room panel leaves.

## What Changes

- **Tighter spacing:** smaller page padding, section gaps, chart gaps and panel padding; the status line at 40 px instead of 44 px. The room panel keeps its content and order, including the "Raum 105" identity line.
- **Charts fill the window:** from 1100 px width, the room page is exactly one window high. The room panel keeps its natural height and the three chart boxes share the rest: CO₂ on the left at the full height, temperature and humidity on the right in a 3 : 2 ratio.
- **Minimum chart heights:** CO₂ 240 px, temperature 110 px, humidity 80 px. A window too low for them scrolls again instead of squashing the charts. The page fits from about 710 px window height.
- Unchanged: the stacked layout below 1100 px (fixed chart heights, the page scrolls), the phone layout below 640 px, the room list, the no-data and error pages.

Not in this change: moving the identity line into the top bar, the time ranges, chart content.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: "Desktop first, nothing breaks on a phone" gains the rule that a room page fits a desktop window from 1280 × 720 pixels without vertical scrolling; its narrow-window scenario names all three charts.

## Impact

- `leoiot-sensors/dashboard/src/styles/app.css` (spacing, fluid heights); no TypeScript change expected (the charts already resize through a ResizeObserver in `src/app.ts`).
- `leoiot-sensors/DESIGN.md` (spacing tokens, layout section) and the FIRST VIEWPORT of `leoiot-sensors/.impeccable/surfaces/dashboard.md`.
- No data, query or contract change.
