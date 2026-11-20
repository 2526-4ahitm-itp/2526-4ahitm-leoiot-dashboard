# Design

## Context

Today `index.html` has two chart panels: `#chartTemp` (temperature, 340 px) and `#chartAir`, one ECharts instance with two grids (CO₂ at about 50 %, humidity at about 30 % of 340 px) on one shared time axis (`airOption` in `src/core/chartOptions.ts`). Both instances join the group `room-climate` and are connected, so one pointer marks all panels.

## Decisions

### D1: Three ECharts instances in one connected group

`airOption` splits into `co2Option` (bands, limit lines, ppm axis 400 to 1400 or wider) and `humidityOption` (% axis 20 to 60 or wider, muted steel blue line); `temperatureOption` stays. Each chart has its own time axis with labels. All three join `CHART_GROUP` and are connected, which keeps the shared pointer of the spec; the tooltip of each chart shows its own value, and the axis pointers of the others follow.

*Alternative:* one instance with three grids spanning two boxes. Not possible: an ECharts instance draws into one element.

### D2: Grid layout

`.charts` becomes a two-column grid with two rows: CO₂ in column 1 spanning both rows, temperature in column 2 row 1, humidity in column 2 row 2, 24 px gaps. Heights: temperature chart about 220 px, humidity chart about 140 px (close to today's CO₂ and humidity panels); the CO₂ panel stretches to the full height of both, its chart filling the panel (flex column, chart `flex: 1`). The ResizeObserver already follows each chart element. Below 1100 px the grid becomes one column in the order CO₂, temperature, humidity, with fixed heights (CO₂ 340 px).

### D3: Panel furniture

Each panel keeps the existing pattern: heading on the left, time window on the right (`… · °C`, `… · ppm`, `… · %`), the note below, `role="img"` with an accessible name of quantity and window. Headings: "CO₂", "Temperatur", "Luftfeuchte" (English: "CO₂", "Temperature", "Humidity"), with the same icons as the value cells.

## Risks / Trade-offs

- [Three tooltips instead of one combined tooltip for CO₂ and humidity.] → Connected pointers still show the time in all three; each tooltip is short.
- [The temperature chart gets smaller than today.] → Temperature changes slowly; 220 px keeps one-degree steps readable.
