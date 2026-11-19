# Proposal

## Why

Nobody can find a room in the room-climate dashboard: the room is chosen only by editing `?room=` in the address, an unknown room ends in a page without a way out, and `/sensors/` always opens room 105. The 3D explorer shows the same rooms and the same live values but does not link to the dashboard, and the dashboard does not link back. A room list fed by the broker would also inherit every retained message ever published: on 2026-11-19 the broker held 106 room messages left by one run of the temporary simulator, 16 days old, next to the one real room 105. They were cleared by hand; without an expiry the same happens whenever a box is moved, renamed or removed.

This change makes rooms findable and keeps the list honest, across the contract, the sensors dashboard and the 3D explorer, in one proposal so that the pieces fit.

## What Changes

- **Contract (`platform/data-contract`)**: room live messages expire 30 days after they were published (MQTT 5 message expiry), so that the broker forgets rooms that stopped sending. A room's floor follows from the first character of its room id (`U`, `E`, `1`, `2`, `T`), as the building model already names its rooms.
- **New `platform/room-links`**: the address of a room in each web application (`/sensors/?room=<id>`, `/3d/?room=<id>`) and the links between them: the dashboard's room page links to the room in the 3D explorer, and the explorer's info panel links to the room's history in the dashboard.
- **Sensors dashboard (`sensors/dashboard`)**:
  - **BREAKING** `/sensors/` without a room shows a room list instead of room 105: every room that has a live message, grouped by floor, with its air state and CO₂ value, live. Addresses with a room are unchanged.
  - Every room page offers a choice of the listed rooms and a link back to the list, so that the address never has to be edited.
  - A room without data shows the room list below its "Keine Daten" message, so that the page always has a way out.
- **Sensors collector**: publishes the live messages over MQTT 5 with the expiry of the contract. No change to its spec; the contract binds it.
- **3D explorer**: opens a room given in its address, and the info panel links to the dashboard. The temporary simulator publishes with the same expiry.

Not in this change:

- The CO₂ limits of the 3D explorer (600/1200 ppm) and the dashboard (800/1000 ppm) stay as they are; see the design's open questions.
- A floor plan or map in the dashboard; finding a room on the building stays the 3D explorer's job.
- Free date ranges and comparisons with the year before, and the other UI findings of the dashboard review (outdated state, chart labels).
- Any change to `legacy/`.

## Capabilities

### New Capabilities

- `platform/room-links`: how a room is addressed in the dashboard and in the 3D explorer, and which links lead from one to the other.

### Modified Capabilities

- `platform/data-contract`: room live messages expire after 30 days; a room's floor is given by its room id.
- `sensors/dashboard`: `/sensors/` shows the room list; room pages offer a room choice and a link to the list; rooms without data show the room list.

## Impact

- **Order** (contract first): this change is merged before any code relies on it. Then, in pull requests of their own: the collector (expiry), the dashboard (room list, choice, links), the 3D explorer (address, link, simulator expiry).
- **Code**: `leoiot-sensors/collector/src/broker.ts` (MQTT 5 connection, expiry on publish); `leoiot-sensors/dashboard/` (room list view, subscription to all rooms, room choice, links, texts); `leoiot-3d/explorer/` (room from the address, link in the info panel); `leoiot-3d/temporary-simulator/` (expiry).
- **3D team**: the explorer's spec `model3d/room-climate-view` is still in the open change `model3d-building-explorer`; this change does not edit it. The explorer's part is specified in `platform/room-links` and is built by the 3D team or with their agreement.
- **Broker**: Mosquitto 2.1.2 already supports MQTT 5 message expiry; no configuration change. Retained messages published before the collector switches carry no expiry and are replaced by the next reading of their room.
- **Saved links** to `/sensors/` without a room open the room list instead of room 105.
- **Legacy**: unaffected; no legacy part reads or writes the room live topics.
