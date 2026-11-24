# Proposal

## Why

The room list answers "which rooms need airing?" for someone who opens it. A screen in the entrance hall or a corridor could answer it for everyone passing by, without anyone touching a mouse: which rooms need airing now, and how the air is on each floor. The school will have a sensor box in every room (about 107, confirmed 2026-11-23), so such a display has to show the whole school, not one room. Elias Pointinger asked for a kiosk view for the entire school on 2026-11-24.

## What Changes

- A new view of the dashboard at `/sensors/?kiosk`: a full-screen hallway display for a landscape TV (designed for 1920 × 1080, readable from a few metres), with no controls and no interaction.
- A header with the title, the date and a large clock, the school-wide counts ("107 Räume · 4 jetzt lüften · 7 bald lüften · 1 nicht aktuell") and how current the values are.
- A main area that pages through the floors in building order, one floor per page (a floor with more rooms than fit is split into parts), every 15 seconds. Each room is a tile with its lamp, room id, CO₂ value and, only when attention is needed, the state word or "Zuletzt 11:07"; simulated rooms are outlined dashed, as in the list.
- A column that always shows every room of the school that needs airing ("Jetzt lüften" first, then "Bald lüften", highest CO₂ first), whatever floor is on screen.
- A footer that names the floors with the current one marked and a thin progress line for the page time.
- Options in the address: `floor=1` (only that floor), `lang=en`, `theme=light` (the display is dark by default), `seconds=30` (page time, 5 to 120).
- The page reloads itself once a night, so that a screen running for weeks picks up new releases.

Not in this change: a building map, charts on the display, sound, remote configuration, touch interaction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: new requirement "A hallway display shows the whole school".

## Impact

- Code in `leoiot-sensors/dashboard/`: `src/main.ts` (route), a new `src/kioskApp.ts`, pure paging and attention logic in `src/core/kiosk.ts`, its renderer in `src/ui/kiosk.ts`, `index.html` (a kiosk section), `src/core/i18n.ts`, `src/styles/app.css`; tests. It reuses the rooms source, `listEntries()` and `summarise()` of the room list.
- Docs: `leoiot-sensors/DESIGN.md` (kiosk view), `leoiot-sensors/dashboard/README.md` or the sensors README (how to set up a screen).
- No change to nginx, the data contract, the collector or the deployment: the view lives under `/sensors/`.
