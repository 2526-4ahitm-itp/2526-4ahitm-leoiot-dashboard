# Design

## Context

`deriveToday` (`src/core/today.ts`) takes the 24-hour series (five-minute means, `aggregateWindow(fn: mean)`) and counts windows above 1000 ppm × 5 minutes (`minutesAbove`). The peak comes from `peakQuery` (`src/core/flux.ts`): `max()` over today's raw readings, raised by the live reading (`withCurrent`). A short spike reaches the peak but not a window mean.

## Decisions

### D1: Count minutes from a query of their own

```
from(bucket: "server_data")
  |> range(start: <midnight>, stop: <now>)
  |> filter(fn: (r) => r._measurement == "room_climate" and r.room == "<room>" and r.source == "<source>")
  |> filter(fn: (r) => r._field == "co2")
  |> group()
  |> aggregateWindow(every: 1m, fn: max, createEmpty: false)
  |> filter(fn: (r) => r._value > 1000.0)
  |> count()
```

One row with the number of minutes, or no row for none. It is loaded together with the peak, once a minute, for the same room, source and day. A failed query keeps the last value, as the peak does.

*Alternative:* keep the five-minute series and count windows whose maximum is above 1000. Rejected: the series is shared with the chart, which must stay a mean, and five-minute steps still overstate a one-reading spike as five minutes.

### D2: The live reading sets a floor of one minute

The time shown is `max(storedMinutes, 1)` when today's peak after `withCurrent` is above 1000 ppm, otherwise `storedMinutes`. The stored readings lag up to a minute behind the live message; the floor keeps the two numbers consistent in that minute.

### D3: The limit test is the same

"Above 1000 ppm" uses the dashboard's existing comparison (`exceeds(LIMIT_BAD, …)`, strictly greater), so a reading of exactly 1000 ppm is not above, in the summary and in the lamp.

## Risks / Trade-offs

- [One more query per minute and room page.] → It scans today only, like the peak query.
- [A sensor that reports less than once a minute counts each reported minute only.] → nili3 reports several times a minute; the demo once a minute. Gaps are not counted as time above 1000 ppm, which is the honest reading.
