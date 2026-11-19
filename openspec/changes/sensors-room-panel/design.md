# Design

## Context

- The room panel today (`leoiot-sensors/dashboard/index.html`, `src/ui/render.ts`): room id at 128 px with the identity line "Sensorbox nili3 · gemessen" below it, the lamp housing, then the status, the three value cells and the freshness line. On a 1440 px screen the right third of the panel is empty.
- The header has carried the room choice since `platform-room-picker`, so the room id appears twice.
- The design rules are in `leoiot-sensors/DESIGN.md` ("Classroom Air Light"): one lit lamp tells whether to air the room; colour appears only as air state ("Lamp-Only Colour Rule"); fixed value cells that change in place; Lexend 400/700; flat panels.
- The page already loads the 24-hour history as five-minute means (`historyQuery`) and refreshes it once a minute; `sinceAbove` in `src/core/air.ts` reads runs above a limit from it.
- Real data of room 105 on 2026-11-19: 16.5 °C at 08:00 (window open overnight), humidity 28 to 35 % all day, CO₂ peaks of 1400+ ppm around 11:00 and 13:00 with sharp falls after airing.

## Goals / Non-Goals

**Goals:**

- The panel reads in this order: room, air state, values with their own state, the day so far.
- Temperature and humidity get a state the caretakers can act on, without competing with the CO₂ traffic light.
- The empty right third carries information that the charts only answer with effort.

**Non-Goals:**

- No change to the sensor box's LED (CO₂ only, see the nili config) and no new contract field.
- No red step for temperature or humidity, and no comfort score combining the three values.
- No change to the charts.

## Decisions

### D1: Identity line instead of the display number

The room panel starts with a label line in the title style: "Raum 105", then "Im Gebäude zeigen" as a link and, for simulated readings only, the dashed "simuliert" pill. The `<h1>` stays on this line (visually 17 to 20 px), so screen readers and the document outline keep the room as the main heading. The device name and "gemessen" go.

*Alternative:* remove the room name from the panel entirely, since the header names it. Rejected: the header's `<select>` reads as "choose", not "you are here", and a projected or screenshotted page needs the room in the content.

### D2: Two-state lamps for temperature and humidity, CO₂ stays the signature

The CO₂ housing (three lamps, red on top) stays unchanged and alone drives the status sentence. Temperature and humidity get a 12 px lamp dot in front of their value (the size of the room list's dots), green or amber, with a direction word below the value. The value takes the lamp's ink colour (`--g-ink`, `--y-ink`), as the CO₂ value does today.

The ranges come from § 28 B-AStV, the only binding Austrian source found: 19 to 25 °C for low physical load (Abs. 1 Z 1); 40 to 70 % humidity (Abs. 5 Z 1, binding only with air conditioning, used here as a guide value, which `PRODUCT.md` states). The source has no second step, so there is no red. Humidity 40 % is often missed in heated rooms in winter; amber there is honest and calm, and amber never takes over the status sentence, so "zu trocken" and "Jetzt lüften" never contradict each other.

The state is computed from the shown (rounded) value, like the CO₂ lamp in `airOf`, so the lamp always agrees with the number.

*Alternatives:* a three-lamp housing per value (dilutes the one-lamp thesis, and a vertical light cannot show "too cold" versus "too warm"); a horizontal range strip with a marker (clearer direction, but a new visual form for little gain); orientation values from other guides (19 to 23 °C, 30 to 50 %; not binding, and they disagree with each other).

### D3: The "Heute" column

A right column with a hairline to its left and three label/value pairs in the value-cell style (caption label, 700 value, unit in muted slate):

```
Heute
Über 1000 ppm       1 h 20 min        | noch nicht
Höchstwert          1 450 ppm · 13:05
Zuletzt gelüftet    ca. 10:45         | heute nicht erkannt
                    geschätzt aus dem CO₂-Verlauf
```

- **Time above 1000 ppm**: the five-minute windows of today in the already loaded 24-hour series whose mean is above 1000 ppm, times five minutes. No extra query.
- **Peak**: one extra Flux query, `max()` of `co2` from local midnight until now, for the room and the shown source, with its `_time`; refreshed with the history once a minute. The five-minute means would flatten short peaks, so they are not used.
- **Last aired**: a pure function over today's five-minute series: the latest window `i` such that some later window within three steps (fifteen minutes) is at least 200 ppm lower; the shown time is window `i`. The text always carries the estimate marker ("ca." plus the caption "geschätzt aus dem CO₂-Verlauf" / "estimated from the CO₂ curve"). The thresholds are design parameters, not health limits; on the real data of 2026-11-19 they catch the airings around 11:00 and 13:00.
- **Midnight**: computed in Europe/Vienna with the existing `Intl` helpers, so the day changes at local midnight in summer and winter time.
- **States**: without a reading today, one line "Heute noch keine Werte". Outdated room: the summary stays (it describes the past) in muted slate. Simulated: values marked like the other values of a simulated room.

*Alternatives:* a CO₂ sparkline (refused by DESIGN.md: no KPI tiles with sparklines; the charts are right below); a QR code (only useful on a door screen); neighbouring rooms (duplicates the room choice and the list).

### D4: Layout

Desktop: `housing | state (status, cells, freshness) | Heute`, the Heute column about 260 px. Below 1100 px the Heute block moves below the cells, keeping its three pairs in a row; below 640 px they stack. The cells get a second line for the direction word, so the cell height is fixed whether or not a word is shown (values change in place, nothing jumps).

### D5: DESIGN.md and PRODUCT.md

`DESIGN.md`: the display style (128 px) is removed from the typography; the "Lamp-Only Colour Rule" becomes: green, amber and red mean the state of a value: CO₂ in three steps (the lamp housing, the value, the chart bands), temperature and humidity in two (dot and value). Controls, text and chart lines stay neutral. New component entries: identity line, small lamp, Heute column. `PRODUCT.md`: the two ranges with § 28 B-AStV as source, and that the box's LED shows CO₂ only. The surface brief's FIRST VIEWPORT is updated.

## Risks / Trade-offs

- [Humidity stays amber through most of the heating season.] → Amber, not red, and outside the status sentence; the text says "zu trocken" without asking for an action.
- [The airing estimate can be wrong: a class leaving the room also lowers CO₂, and a slow window opening may stay below 200 ppm in fifteen minutes.] → The text always says it is an estimate; the parameters can be tuned in one place after a few weeks of real data.
- [The extra peak query adds one request per minute per open room page.] → It reads only today's `co2` of one room and source; small next to the history query.
- [Removing the 128 px number weakens the panel's identity on a projector.] → The status headline (44 px) and the lamp housing remain the focal point; the identity line is the first line of the panel.

## Migration Plan

One dashboard pull request after this change is merged, shipped with the next promotion to `release`. No data migration. Rollback: revert the pull request.

## Open Questions

- Should the airing parameters (200 ppm, fifteen minutes) change once a few weeks of data from room 105 exist? Changing them alters neither the specs' structure nor the tasks.
