# Design

## Context

The room list is rendered by `leoiot-sensors/dashboard/src/ui/roomList.ts` from `listEntries()` in `src/core/roomList.ts`; `src/data/roomsSource.ts` feeds it from the live channel or, while that is down, from the stored readings once a minute. Elements are updated in place, so keyboard focus survives the redraw every 5 seconds. Each entry is a two-column grid with the state word and the "simuliert" pill on their own lines, about 50 px high at 1440 px and 81 px on a phone. The same list is shown below the empty panel of a room page without data.

The room list requirement itself is still in the open change `platform-room-picker` (waiting for the 3D team's tasks 5.2–5.4), not in `openspec/specs/sensors/dashboard/spec.md`.

Measured on vm23 on 2026-11-23 with the demo running: 107 rooms; page height 2,631 px at 1440 × 900 and 10,171 px at 375 × 812.

## Goals / Non-Goals

**Goals:**
- One line per room at desktop widths; about half the page height.
- Same vocabulary as the room page: lamp, "Zuletzt …" with the warning triangle, dashed for simulated.
- No new data, queries or contract fields.

**Non-Goals:**
- Reordering rooms, an attention block, search, filters or a quantity switch.
- Changes to the room page outside the list.
- Phone layout beyond keeping it usable: rooms stay in one column there.

## Decisions

**D1. ADDED requirements, not MODIFIED.** The room list requirement lives in `platform-room-picker`, which is not archived. A MODIFIED block would have no target in the main spec. The new requirements add rules and leave its text alone: rooms are still marked as simulated (by the outline), the air state is still not told by colour alone (a word for each state that needs attention). The changes can be archived in either order.

**D2. Simulated is a dashed outline.** DESIGN.md already uses dashes for simulated data (chart lines, the source tag). The entry's 1px `line` border becomes `1px dashed var(--line-ctl)` for simulated rooms. Each room still states "simuliert" to screen readers in a visually hidden span, and the legend is one line in the list header. Rejected: keeping the pill (one extra line per room, 106 identical pills); marking only measured rooms ("gemessen"), which DESIGN.md rules out for the identity line and which would invert the meaning once the demo is gone.

**D3. Good air has no visible word.** The word "Luft gut" stays in the DOM in a `.sr-only` span, so the link reads "E11, Luft gut, 726 ppm". "Bald lüften", "Jetzt lüften", "Kein CO₂-Wert" and the outdated text stay visible. This keeps the "not by colour alone" rule: with colour removed, a room with a word needs attention and a room without one does not. Rejected: icons per state (a new vocabulary the room page does not use).

**D4. One-line entry.** Grid `12px | id | state | value` (`auto minmax(0,1fr) auto` for the last three), state word at 13px in slate, aligned with the id's baseline. The grid's minimum column grows from 220 px to 240 px so that "● E581 Jetzt lüften 1 249 ppm" fits; at 1440 px that keeps 5 columns. In a narrower column the state word wraps under the id instead of being cut off (entries get taller, nothing hides). Below 640 px there is one column, as today. Expected height at 1440 × 900: about 1,300 px instead of 2,631.

**D5. Outdated entries.** The lamp dot is replaced by the 12px version of the room page's warning triangle in amber ink (the one exception the colour rule already allows), the state text becomes `freshStale(time)` ("Zuletzt 11:07"), and the value is set in weight 400, muted slate. Rejected: hiding the old value (spec of `platform-room-picker` asks for the CO₂ value by the room page's rules, and the room page shows it muted).

**D6. Counts are computed in core.** A pure `summarise(entries)` in `src/core/roomList.ts` returns `{ rooms, bad, soon, stale }` for the whole list and per floor; the renderer formats it with `texts(lang)`. Zero counts are left out. Counts and the freshness text are ink-2/ink-3 only (the colour rule: the lamp dots already carry colour).

**D7. Freshness line.** `listApp.ts` already knows the feed mode. In `live` mode the line reads "Live-Werte"; in `fallback` mode "Aktualisierung jede Minute · Stand 11:14", where the time is the last successful load of the stored readings, kept by `roomsSource`. In `connecting` mode the line is empty and the existing "Werte werden geladen" message shows. A muted 8px dot precedes the text, as on the room page; it never turns green.

**D8. Load failures.** `roomsSource` gains `failed()` (the last stored-readings load threw) and `lastLoadAt()` (time of the last successful load). `ready` stays as it is. The list shows "Die Werte konnten nicht geladen werden. Die Seite versucht es jede Minute erneut." when the mode is `fallback`, `failed()` is true and no room is known; when rooms are known it keeps them and the freshness line keeps the old time. "Derzeit sendet kein Raum Messwerte" is shown only when not failed. The request already gives up after 20 s (`AbortSignal.timeout` in `src/data/api.ts`), so after 8 s of connection grace the worst case is about 28 s until the error text; no new timeout is needed.

## Risks / Trade-offs

- [Long room ids or a large font size break the one line] → the state word wraps under the id (D4); checked at 200 % zoom.
- [Dashes are easy to miss next to solid outlines] → the legend line names them; screen readers get "simuliert" per room; the room page keeps its pill.
- [Visitors read "no word" as "no data"] → rooms without data are not listed at all, and a live room without CO₂ says "Kein CO₂-Wert".
- [A failure after rooms were shown goes unnoticed] → the freshness line's time stops moving; acceptable, since the values stay correct for that time and outdated rooms get marked after five minutes.

## Migration Plan

Ships with the next promotion `main` → `release`; nothing to migrate. Rollback is a revert of the implementation pull request.
