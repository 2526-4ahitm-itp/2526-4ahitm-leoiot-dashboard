# Proposal

## Why

The room list is meant to answer "which rooms need airing?" at a glance (PRODUCT.md, principle 1), but with 107 rooms it takes about three screens at 1440 × 900 and twelve on a phone, and every room repeats the same lines: 80 say "Luft gut" and 106 carry the same "simuliert" pill. In production every room of the school will have a sensor box (confirmed by Elias Pointinger on 2026-11-23), so 100+ rooms is the normal case, not a demo artefact. A failed load also tells the visitor that "no room is sending" instead of saying it went wrong.

## What Changes

- Each room in the list takes one line: lamp dot, room id, a state word only for rooms that need attention ("Bald lüften", "Jetzt lüften"), and the CO₂ value. Rooms with good air carry no visible word; their state is still announced to screen readers.
- Simulated rooms get a dashed outline instead of a "simuliert" pill (the dashboard's existing rule: simulated is dashed). One legend line explains the dashes whenever a simulated room is shown; each simulated room still says "simuliert" to screen readers.
- Outdated rooms look like the room page's outdated state: the warning triangle, "Zuletzt 11:07", and the old CO₂ value muted and no longer bold.
- Below the title a summary line counts the rooms and their states ("107 Räume · 11 jetzt lüften · 15 bald lüften · 1 nicht aktuell") and says how current the list is ("Live-Werte", or "Aktualisierung jede Minute · Stand 11:14" while the live channel is down). It replaces the current fallback note.
- Each floor heading shows the floor's room count and, when not zero, the same state counts.
- When neither the live channel nor the stored readings answer, the list says the values could not be loaded and that it keeps trying, instead of "Derzeit sendet kein Raum Messwerte".

Not in this change: a block of rooms that need airing, search, a temperature or humidity switch for the list (later changes), and anything on the room page apart from the list shown below a room without data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: new requirements for the room list's compact entries, its summary and freshness line, its marking of simulated and outdated rooms, and its load error. They add to the room list requirement of `platform-room-picker` (still open) and change none of its text.

## Impact

- Code: `leoiot-sensors/dashboard/src/core/roomList.ts` (counts), `src/data/roomsSource.ts` (load failure state), `src/ui/roomList.ts`, `src/listApp.ts`, `src/core/i18n.ts` (DE/EN texts), `src/styles/app.css`, `index.html` (summary line); tests in `tests/roomList.test.ts` and `tests/roomListApp.test.ts`.
- Docs: `leoiot-sensors/DESIGN.md` (room list component).
- No change to the data contract, the collector, the broker or the deployment.
