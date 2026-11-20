# Proposal

## Why

The room panel spends its left third on a 128 px room number that the header's room choice now repeats, while the right third stays empty. Temperature and humidity are shown as plain numbers, although caretakers use the dashboard to notice rooms that are too cold (a window left open overnight: room 105 dropped to 16.5 °C on 2026-11-19 at 08:00), and nothing tells a teacher how the air was over the day without reading the charts. Decided with Elias Pointinger on 2026-11-19 in an explore session.

## What Changes

- **Identity line instead of the big room number**: the room panel starts with a label line "Raum 105" ("Room 105") and the link "Im Gebäude zeigen". The device name and the word "gemessen" are removed. Simulated rooms keep the "simuliert" marking next to the room.
- **Two small lamps** for temperature and humidity, shown in the dashboard only (the sensor box's own LED keeps showing CO₂ alone):
  - temperature green from 19 to 25 °C, otherwise amber with "zu kalt" or "zu warm";
  - humidity green from 40 to 70 %, otherwise amber with "zu trocken" or "zu feucht";
  - each value takes the ink colour of its lamp. The CO₂ traffic light and its status sentence stay as they are and alone decide the status sentence.
- **"Heute" summary** in the panel's right column, always for the current day since midnight (Europe/Vienna):
  - the time above 1000 ppm;
  - the day's highest CO₂ value with its time, from one extra query;
  - when the room was last aired, estimated from a fast drop of CO₂ and labelled as an estimate.
- `leoiot-sensors/PRODUCT.md` records the temperature and humidity limits and their source; `leoiot-sensors/DESIGN.md` records the new hierarchy, the extended colour rule and the summary block.

Not in this change:

- The sensor box's LED, the broker, the contract, the 3D explorer.
- Red steps for temperature or humidity: the source gives one range, so there are two states only.
- The charts, the time ranges and the room list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/dashboard`: the identity line replaces the room number and the device line; temperature and humidity get their own two-state lamps; outdated values switch all lamps off; a summary of the day is shown; simulated readings are still marked next to the room id, without the word "gemessen" for measured ones.

## Impact

- **Code**: `leoiot-sensors/dashboard/` only: `index.html`, `src/ui/render.ts`, `src/core/view.ts` (lamp states), a new pure module for the day summary, `src/core/flux.ts` (peak query), `src/core/i18n.ts`, `src/styles/app.css`, tests.
- **Data**: one extra Flux query per room page for the day's peak, refreshed with the history once a minute. No contract change: only `room_climate` is read.
- **Docs**: `leoiot-sensors/PRODUCT.md`, `leoiot-sensors/DESIGN.md`, `leoiot-sensors/.impeccable/surfaces/dashboard.md`.
- **Order**: independent of `platform-room-picker`; this change modifies other requirements of `sensors/dashboard` than that one does.
