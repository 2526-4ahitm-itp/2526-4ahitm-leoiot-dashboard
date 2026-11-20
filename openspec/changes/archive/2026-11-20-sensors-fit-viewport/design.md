# Design

## Context

Height of the room page today (room 105, measured at 1440 × 789 and 1920 × 960, the same at every width from 1100 px):

```
 60  top bar
 28  page padding top
326  room panel   (padding 24 + 28, identity line 26, row gap 20, state column 228)
 24  section gap
513  charts       (right column: temperature panel 284 with a 220 px chart, gap 24,
                   humidity panel 204 with a 140 px chart; CO₂ stretches to match)
 40  page padding bottom
───
990
```

`src/app.ts` already observes each chart element with a ResizeObserver and calls `resize()` on the ECharts instances, so any CSS height change reaches the charts.

## Decisions

### D1: Tighter spacing on desktop

Applies from 641 px; the phone rules below 640 px stay as they are.

| | today | new |
|---|---|---|
| page padding (top / sides / bottom) | 28 / 40 / 40 | 20 / 40 / 20 |
| section gap, chart gap | 24 | 16 |
| room panel padding | 24 36 28 | 20 32 20 |
| room panel row gap (identity to row) | 20 | 12 |
| status line | 44 px | 40 px |
| value cells margin above / padding above | 22 / 14 | 16 / 12 |
| chart panel padding | 22 26 12 | 14 22 6 |
| chart margin below heading | 8 | 6 |

Expected room panel height: about 290 px instead of 326 px. Fixed part of the page: 60 + 20 + 290 + 16 + 20 ≈ 406 px.

### D2: The charts take the rest of the window (from 1100 px width)

`body` becomes a column of at least `100dvh`: the top bar keeps its height, `main` takes the rest (`flex: 1`). In the room view with readings, `main` is a grid with the rows `auto` (room panel) and `minmax(0, 1fr)` (charts). The chart grid keeps its two columns; its rows become `3fr 2fr` (temperature above humidity), CO₂ spans both. Each panel is a flex column with the chart at `flex: 1; min-height: 0` plus the minimum heights of D3 on the chart element.

`min-height` rather than `height` on `body`, so a window lower than the minimum makes the page longer and it scrolls; nothing is clipped.

Below 1100 px nothing changes: the panels stack with their fixed chart heights (340 / 260 / 200 px). The room list, the no-data and the error views keep their natural height (the grid rows apply only to `[data-view='room']` outside `nodata` and `error`).

*Alternative:* three charts in one row (CO₂ half, temperature and humidity a quarter each). Rejected: it undoes the large CO₂ box decided in `sensors-chart-split`, and a 24-hour curve in a box about 330 px wide gets crowded.

### D3: Minimum chart heights

CO₂ 240 px, temperature 110 px, humidity 80 px. The right column then needs 110 + 80 + two panel heads (about 2 × 48) + 16 gap ≈ 302 px, so the page fits from about 406 + 302 ≈ 708 px window height.

Expected chart heights:

| window | CO₂ | temperature | humidity |
|---|---|---|---|
| 1280 × 720 | ~265 | ~120 | ~80 |
| 1440 × 789 | ~335 | ~160 | ~110 |
| 1920 × 960 | ~505 | ~265 | ~175 |

These are estimates; the browser check in the tasks confirms them and may shift a value by a few pixels.

## Risks / Trade-offs

- [In a 720 px window humidity gets only 80 px.] → Humidity changes slowly and its axis needs two or three labels; below the minimum the page scrolls.
- [On a very tall window the charts grow without limit.] → Acceptable for a desktop dashboard; a maximum can follow if someone uses portrait screens.
- [Loading state: the room panel is shorter before the first values.] → The charts take more height for a moment and shrink when the values arrive; the cells keep reserved heights, so the shift is small. Checked in the browser.
- [`100dvh` on old browsers.] → Fall back to `100vh` first in the same rule.
