# Proposal

## Why

The date segment "Zeitraum wählen" takes as much room in the top bar as both ranges together, and choosing a range means two separate native date fields: open "Von", pick a day, open "Bis", pick again. Visitors know a different pattern from booking sites: one calendar in which they click the first and then the last day and see the range in between. Elias Pointinger asked for that pattern and for an icon-only segment on 2026-11-24.

The room list shows every room of the school: about 107 in production (every room gets a sensor box, confirmed 2026-11-23), which is three screens on a laptop and many more on a phone. Someone looking for one room, or for their own floor, has to scroll and scan. A search field and a floor filter make a room reachable in a keystroke or two.

## What Changes

- The date segment shows only the calendar icon while no dates are shown; its accessible name stays "Zeitraum wählen". Once dates are shown it keeps the icon and adds the range ("16.11. – 20.11."), so the control still says what is selected.
- The date panel holds one range calendar instead of two date fields: two months side by side (one below 640px), previous/next month buttons, weeks starting on Monday. The first click sets the first day, the second click on the same or a later day sets the last day; a click on an earlier day starts again. Days in between are shaded, hovering previews the range, days outside the allowed span cannot be chosen. A line above the calendar says what to do next or which range is picked. "Anzeigen" shows the range; with only a first day picked it shows that one day. Full keyboard use (arrow keys, Page Up/Down, Home/End, Enter).
- The room list gets a toolbar above the floors: a search field ("Raum suchen") that matches room ids as you type, and a floor filter (Alle, then each floor that has rooms). Both combine; floors without a match are hidden; a result line says how many rooms match; no match shows a message with a button to reset the filter. Search and floor are kept in the address (`?floor=1&q=10`) so that a reload, the browser's back button and a shared link keep them.

Not in this change: picking times of day, preset ranges inside the calendar ("letzte Woche"), filtering by air state, sorting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: "Time ranges and chosen dates" (icon-only segment, range calendar, an earlier day starts again instead of an error) and a new requirement "The room list can be searched and filtered by floor".

## Impact

- Code in `leoiot-sensors/dashboard/`: `index.html` (segment, panel, list toolbar), a new range calendar in `src/ui/`, its pure date logic in `src/core/`, `src/ui/datesPanel.ts`, `src/ui/render.ts`, `src/core/i18n.ts` (DE/EN), the room list filter in `src/core/roomList.ts`, `src/ui/roomList.ts` and `src/listApp.ts`, `src/styles/app.css`; tests.
- Docs: `leoiot-sensors/DESIGN.md` (date segment, date panel, room list toolbar).
- No change to the data contract, the collector, queries or the deployment.
