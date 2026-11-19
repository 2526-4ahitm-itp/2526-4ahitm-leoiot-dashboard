# Design

## Context

- The dashboard (`leoiot-sensors/dashboard/`) reads the room from `?room=` once at start (`src/app.ts`, `roomFromSearch`) and subscribes to one room's topic (`src/data/feed.ts`). It already treats a room silent for 30 days as without data (`LATEST_LOOKBACK = '30d'` in `src/core/flux.ts`).
- The collector publishes the room live messages retained with QoS 1 over MQTT 3.1.1, mqtt.js's default (`leoiot-sensors/collector/src/broker.ts`). The broker is Mosquitto 2.1.2, which supports MQTT 5 and drops retained messages whose expiry interval has passed.
- The browser listener allows anonymous subscriptions to `leoiot/room-climate/#` (`platform/data-contract`), so a browser can learn every room with one subscription. The 3D explorer already does this.
- The 3D explorer at `/3d/` has no room in its address. Its room rules, including the floor by first character, live in `model3d/room-climate-view`, which is still part of the open change `model3d-building-explorer`.
- On 2026-11-19 the broker held 107 room messages, 106 of them 16 days old from one run of `leoiot-3d/temporary-simulator`. They were cleared by hand, keeping room 105.

## Goals / Non-Goals

**Goals:**

- A visitor finds any room with data in two clicks from `/sensors/`, and never needs to edit the address.
- The broker's set of rooms stays the set of rooms that sent something in the last 30 days, without anyone clearing it.
- Dashboard and explorer lead to each other for the same room.

**Non-Goals:**

- No single-page routing in the dashboard; switching rooms is a page load.
- No search field; with today's 1 and a planned 50 rooms, a floor-grouped list and a native choice are enough (see D5).
- No shared code between the dashboard and the explorer; each implements the floor rule from the contract.

## Decisions

### D1: One `platform-…` change for contract, dashboard and explorer

The pieces only make sense together: the list needs the expiry, the links need both addresses. `openspec/specs/README.md` rule 5 allows a change that needs several groups' specs as a `platform-…` change. The code still lands in one pull request per sub-project, after this change is merged (contract first).

*Alternative:* three changes (`platform-room-expiry`, `sensors-room-list`, `model3d-room-address`). Rejected for now because the decisions are shared; nothing in the task order depends on the split.

### D2: The room list comes from the retained live messages

One subscription to `leoiot/room-climate/#` gives every room together with its current state, which is what makes the list useful ("which room is red?"). It needs no contract change and no extra database query.

*Alternatives:* InfluxDB `schema.tagValues(room)` lists every room ever written, simulated ones included, and needs a second query for each room's state. The building model's 107 rooms include rooms that will never have a box; publishing them would also need a room registry in `platform/`. Both rejected.

The database stays the fallback while `/mqtt` is unreachable, as on the room page: one Flux query for the last value per room and field over 30 days, once a minute.

### D3: Expiry by MQTT 5 message expiry, 30 days

The publisher sets `messageExpiryInterval` = 2 592 000 s on every live message; the broker drops the retained copy by itself. This needs the collector to connect with `protocolVersion: 5`; its subscriptions to the device topics behave the same under MQTT 5. Subscribers may stay on MQTT 3.1.1 because the broker applies the expiry.

30 days matches the dashboard's existing rule that a room silent for 30 days is without data, so the room list, the room page and the explorer agree. A caretaker still sees a box that stopped sending as outdated for a month.

*Alternatives:* the collector or a job clears rooms (needs to know which rooms it owns, and does not catch other publishers); the list filters old rooms (the junk stays on the broker and every consumer filters on its own); 7 days (a box switched off over a week's holiday would disappear from the list).

### D4: `/sensors/` shows the room list

The page decides by the address: with `room` it starts the room page as today, without it the room list. Both live in the same `index.html` and bundle, with `main.ts` choosing which view to start; the room page's markup stays, and the list gets a section of its own. A room's link is a plain `<a href="?room=<id>">`.

*Alternative:* keep room 105 as the default and put the list on its own path (`/sensors/rooms`). Rejected: the list is the natural start once more than one room sends, and saved links to `/sensors/` are few while there is one room.

### D5: The room choice is a native `<select>`, grouped by floor

The header's crumb (`Raum 105`, which repeats the large room id) becomes a `<select>` with one `<optgroup>` per floor, plus a link "Alle Räume" to the list. Changing the selection navigates to `?room=<id>`. A native control is keyboard- and screen-reader-accessible, works on phones without extra code, and jumps by typing (`E1` → `E10`). The status of each room is shown on the list, not in the choice.

*Alternative:* a custom combobox with search and status dots. Worth it only once dozens of rooms send; it can replace the `<select>` later without a spec change.

### D6: The no-data page shows the room list

Instead of a separate "did you mean" text, the same list component is rendered under "Keine Daten für Raum X99". The text of `noDataText` changes so that it no longer promises that a box "sends again" in a room that never had one.

### D7: Links between the applications

Both addresses use the query parameter `room` (`platform/room-links`). The dashboard shows "Im Gebäude zeigen" only for rooms of a known floor, so that it never links to a room the model cannot have. The explorer shows "Show history" only for rooms it has a live message for, so that it never links to an empty dashboard page. The explorer reads `?room=` once after the model has loaded and then behaves as if the room had been clicked.

### D8: The floor rule moves into the contract

The dashboard now groups by floor too. Under rule 2 of `openspec/specs/README.md`, a rule two sub-projects rely on belongs in `platform/`, so `platform/data-contract` states it. The explorer's own spec keeps its wording until the 3D team aligns it.

## Risks / Trade-offs

- [The explorer's CO₂ limits are 600/1200 ppm (FSD FR-07), the dashboard's 800/1000 ppm.] The new links put both side by side, so the same room can be yellow in one and green in the other. → Not changed here (see Open Questions); the room list follows the dashboard's limits.
- [`model3d/room-climate-view` is still in the open change `model3d-building-explorer`.] Adding to it here would conflict when that change is archived. → The explorer's part is specified in `platform/room-links` only; the 3D team references it from their spec.
- [The explorer is the 3D team's code.] → The 3D tasks are done by the 3D team or with their agreement, in their own pull request.
- [Messages published before the collector switches carry no expiry.] → Each is replaced by the next reading of its room; rooms that no longer send need one manual clear, as on 2026-11-19.
- [`temporary-simulator --clear` publishes an empty message to every room of the model, including room 105.] → Its README says so; the real message comes back with nili3's next reading about 10 seconds later.
- [Subscribing to all rooms costs more traffic as rooms are added.] At 50 rooms with one message every 10 seconds that is 5 small messages per second per open list. → Acceptable; the room page keeps its single-room subscription.

## Migration Plan

1. Merge this change (spec only).
2. Collector: MQTT 5 and expiry; release; check on vm23 that the retained message of room 105 carries the expiry (a subscriber over MQTT 5 sees the property).
3. Dashboard: room list, room choice, links, no-data page; release. Saved links to `/sensors/` now open the list.
4. Explorer and temporary simulator: room address, link, expiry; release.

Rollback: each step is its own release; reverting the dashboard brings back room 105 at `/sensors/`. Expiry needs no rollback: without it the broker simply keeps messages as before.

## Open Questions

- Should the explorer adopt the dashboard's limits of 800/1000 ppm, and should those limits move into `platform/data-contract`? This is a separate `platform-…` change; it does not change this one's specs or tasks.
- Is 30 days right for the expiry once more boxes run? It can change later in the contract without changing the approach.
