# Design

## Context

See `proposal.md` for motivation. The legacy sensor path, read from the code (not checked on vm23):

| Statement | Source |
|---|---|
| Telegraf writes every number on `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` as measurement `mqtt_consumer`, tag `topic`, field `value`; JSON on `room-temperature` as `room_temperature`, tag `room`, field `temperature` | `legacy/telegraf.conf` |
| `fake-sensors` publishes about 120 rooms every 10 s: temperature as JSON on `room-temperature`, CO₂ on `nili3/sensor/<room in lower case>_co2/state` | `legacy/fake-sensors/index.js` |
| `quarkus-app` publishes a fixed temperature per room every 10 s on the same `room-temperature` topic | `legacy/backend/sensor-data-generator/…/RoomTemperatureResource.java` |
| The real box `nili3` (ESPHome, discovery off) publishes on `nili3/sensor/<object>/state`; three places map it to room 105 | `legacy/sensorbox/nili-ldr/nili-ldr.yaml`, `legacy/mqtt-ws-bridge/index.js`, `legacy/dashboard-v2/dashboard.js` |
| The box type `s3_mini_sensorbox` publishes under a prefix Telegraf does not subscribe to | `legacy/sensorbox/s3-mini-oled/s3_mini_oled.yaml` |
| The bridge rebuilds a room from the lowercased topic; `UBiolab` comes back as `Ubiolab` | `legacy/mqtt-ws-bridge/index.js` |
| The broker allows no anonymous access and has one TCP listener on 1883 | `legacy/config/mosquitto.conf` |
| The bucket `server_data` has no expiry | `platform/data-contract` (PV retention requirement) |

Unlike the PV part of the contract, nothing in this change exists yet: the interfaces are designed first and become true when the `sensors-…` collector and the `platform-broker` change are applied.

## Goals / Non-Goals

**Goals:**

- One room-climate interface that the sensors dashboard and the 3D model can both build against without opening `legacy/`.
- Room identity that survives storage and transport unchanged.
- Measured and generated data that can always be told apart.

**Non-Goals:**

- Changing or cleaning up the legacy sensor path. It runs unchanged until its readers are removed, then it is deleted with `legacy/`.
- Device configuration, device topics, simulator behaviour (all `sensors`).

## Important decision still open: storage volume

**To be decided before this change is merged.** The spec currently states the choice made on 2026-10-22: one point per reading (requirement "Room-climate readings are stored as `room_climate`") and no time limit (retention requirement). Together they mean a large volume that is mostly invented data:

- Real box: three fields every 10 s, about 26 000 values a day. Negligible.
- A simulator at the legacy rate (about 120 rooms, three fields, every 10 s): about 3 million values a day. At a few bytes per value after compression, roughly 5 to 20 MB a day, several GB a year, with no end.

Options:

| | What | Effect on the spec |
|---|---|---|
| A | Keep it: every reading, forever | none |
| B | The simulator publishes less often (for example once a minute) | none (simulator is a `sensors` decision); about 6× less |
| C | Simulated readings are published live but not stored | requirement "Simulated readings are marked" and the storage requirement change |
| D | Raw readings for a limited time plus per-minute means kept forever | storage and retention requirements change; needs a second bucket, since retention is per bucket in InfluxDB |

Task 1.1 records the decision; if it is C or D, the spec is changed before merge.

## Decisions

### D1. Design a new interface, do not describe the legacy one

The legacy data has two room-naming schemes, room identity inside topic strings, a hard-coded device-to-room mapping and no marking of simulated data. Writing it into the contract would make every new reader repeat those workarounds. *Alternative:* specify the legacy shape as it is, like the PV part (rejected: the PV interfaces were clean enough to keep; these are not, and nothing new is built on them yet).

### D2. One wide measurement in the existing bucket

`room_climate` with one field per quantity and tags `room`, `device`, `source`. *Why:* a reader filters by room and gets all quantities without parsing; units are stated per field. *Alternatives:* a long format with one `value` field and a `quantity` tag (rejected: every query needs a pivot, units are implicit); an own bucket (rejected: second set of tokens and readers query two buckets, while the retention wanted is the same as PV's, unless decision D of the open question is taken).

### D3. Timestamp is the time of receipt

ESPHome devices send no timestamp, so the writer stamps a reading when it arrives. The same time is `ts` in the live message, so stored and live data agree.

### D4. Room id is the door-sign name

The same name is used by the 3D model (mesh names before the first `_`), the sensors dashboard and the live topic, and nothing lowercases it. The character rule (letters, digits, dots) keeps it usable as a topic level. The contract has no room list: a reader shows the rooms that have data, and the 3D model matches its own rooms by id. *Alternative:* a room list file in the platform group with floor and display name (deferred, see Open Questions).

### D5. Device-to-room mapping stays with the collector

Only the collector reads it, so it is `leoiot-sensors` configuration, not a shared interface. The box `nili3` is in room 105 (decided 2026-10-22); the documentation site says 153 and is corrected by this change.

### D6. A `source` tag instead of a separate measurement for simulated data

One real box and a simulator for the rest of the building will exist side by side for a long time. A tag lets a reader include or exclude generated data with one filter and keeps a room's real and simulated history in one place.

### D7. Live data over MQTT over WebSocket, not over the `/ws` bridge

Each room's latest values are a retained message on `leoiot/room-climate/<room>`, and browsers subscribe at the broker directly.

| Need | How it is met |
|---|---|
| Latest value on connect | retained messages; the broker sends them on subscribe |
| Payload shape | the collector publishes the contract shape; nothing converts it |
| Browsers must not write | anonymous access on the WebSocket listener only, read-only on `leoiot/room-climate/#` |

*Why not `/ws`:* the bridge's main job is merging PV data from the school broker, which room climate does not need; `leoiot-platform/` has no bridge, the legacy bridge is frozen and will be deleted, and a new bridge is a component to build and own. *Cost:* the access rule must be right (see Risks), browsers need an MQTT client library, and a client that wants PV and room data uses two mechanisms until PV moves too. *Alternatives:* a `room` message on `/ws` from a new platform bridge; a WebSocket endpoint served by the sensors collector (rejected: the 3D model would depend on a `sensors` component).

### D8. The browser endpoint lands on a platform-owned broker

`legacy/` will be deleted once every sub-project is rebuilt, so nothing new is added to `legacy/config/` or `legacy/deploy/`. A follow-up change `platform-broker` moves the broker into `leoiot-platform/` with the WebSocket listener, the access rules and the `/mqtt` route, keeping the host name `mosquitto` on the `leoiot` network, port 1883, the credentials and the data volume, so that devices and legacy services keep working. `legacy/` then only loses its `mosquitto` service, which the freeze allows because a new implementation replaces it. *Alternative:* add the listener to the legacy broker as an exception to the freeze (rejected: it would be deleted with `legacy/` and redone in the platform anyway).

### D9. Retention floor of 13 months

A month compared with the same month a year before needs 13 months. The bucket currently keeps everything, which satisfies the floor; the backup concept (issue #54) may set a final value, but not below the floor.

## Risks / Trade-offs

- [The access rule is wrong and anyone can publish fake values or change `co2/threshold/high`, which drives the LED of the real box] → anonymous access is enabled only on the WebSocket listener; `platform-broker` tests the three browser scenarios of the spec from outside before `/mqtt` is announced.
- [Retained messages of a removed device stay forever] → consumers judge by `ts`; the collector clears a room's retained message (empty retained publish) when its device is taken out of the mapping.
- [The contract is designed before anything implements it and turns out wrong] → only the sensors collector and dashboard depend on it at first; corrections are `platform-…` changes made while the 3D team has not yet built on it.
- [Moving the broker disconnects devices or legacy services] → same host name, port, credentials and volume; switch at a quiet time; rollback is starting the legacy service again.
- [The browser endpoint is late for the sprint] → the dashboard reads history from `room_climate` and polls it for current values until `/mqtt` exists.
- [The public endpoint attracts many connections] → connection limit on the WebSocket listener and the proxy.
- [Simulated rooms that the 3D model does not have] → the collector checks its mapping against the room id rule; unknown rooms simply show no data in 3D.

## Migration Plan

1. Merge this change (contract first); decide the storage question before.
2. Create the write token for the collector and a broker account that may publish only on `leoiot/room-climate/#`.
3. `sensors-…`: the collector writes `room_climate` and publishes the live topic; the simulator marks its readings.
4. `platform-broker`: broker in `leoiot-platform/`, WebSocket listener, access rules, `/mqtt` route; `legacy/` loses its `mosquitto` service.
5. The sensors dashboard, and later the 3D model, consume the contract.
6. When no legacy reader is left, `legacy/` is deleted, and with it Telegraf's sensor inputs and the legacy measurements' writers.

Rollback: `room_climate` and the live topic are additions; stopping the collector removes them without affecting legacy.

## Open Questions

- Should the history of the real box (`mqtt_consumer`, topics `nili3/sensor/nili3_*`) be copied into `room_climate` once? A one-off `sensors` task if wanted; it does not change the contract.
- Does the 3D model or the dashboard need a shared room list (floor, display name, rooms without a device)? Would be a later `platform-…` change.
- Who becomes the permanent owner of the `platform` group? Until decided, each team decides on its own part of the contract; the broker change is agreed with the repository maintainers.
