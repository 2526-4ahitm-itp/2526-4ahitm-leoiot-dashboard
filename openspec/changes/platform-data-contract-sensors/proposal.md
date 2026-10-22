# Proposal

## Why

The sensors team starts its first room-climate dashboard this sprint, and the 3D team will show the same values when a room is clicked. Neither may rely on sensor data that is not in the `platform` spec group, and `platform/data-contract` covers PV only. The legacy sensor data is not worth writing down as it is: CO₂ and temperature sit in two measurements with two ways of naming a room, the room of a CO₂ reading exists only inside a lowercased topic string, the real sensor box is mapped to room 105 by hand in three places, and nothing tells simulated readings from measured ones. This change specifies a clean room-climate interface instead, which a new collector in `leoiot-sensors/` writes while the legacy path keeps running unchanged.

## What Changes

- Add to `platform/data-contract`:
  - stored room-climate readings: measurement `room_climate` in the existing bucket, tags `room`, `device` and `source`, fields `co2`, `temperature` and `humidity` with units, one point per reading;
  - room ids: the name on the door sign and in the 3D model, case-sensitive, never lowercased;
  - simulated readings are always marked as such;
  - room-climate live data: one retained JSON message per room on `leoiot/room-climate/<room>`;
  - browsers read that live data directly from the broker over MQTT over WebSocket, anonymously and read-only, limited to the room-climate topics;
  - room-climate readings are kept without a time limit, with a stated floor;
  - new sub-projects read room climate only through these interfaces; the legacy sensor measurements and topics stay as they are and are not part of the contract.
- Fix the four places in the documentation site that name room 153 for the real sensor box; it is in room 105.

Not in this change:

- The collector, the simulator and the dashboard. They are `sensors-…` changes that refer to this contract.
- The mapping from devices to rooms. Only the collector reads it, so it is configuration of `leoiot-sensors`, not a shared interface.
- The topics the sensor boxes publish (ESPHome) and the CO₂ threshold topics they subscribe to. Only `leoiot-sensors` and legacy use them.
- CO₂ and temperature colour thresholds. They are presentation and belong in the sensors spec.
- Moving PV live data from `/ws` to MQTT over WebSocket. Possible later, once nothing in `legacy/` reads `/ws`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform/data-contract`: adds the room-climate interfaces (storage, room ids, simulated marking, live topic, browser access to the broker, retention, separation from the legacy sensor data). The PV requirements do not change.

## Impact

- **Unblocks** the first `sensors-…` changes (collector, simulator, dashboard) and gives the 3D team a room-climate source.
- **Broker**: gains a WebSocket listener for browsers, an anonymous read-only access rule and a route on the reverse proxy. Because `legacy/` will be deleted, these land on a broker owned by `leoiot-platform/`, set up by a follow-up change `platform-broker` (`design.md` D8); `legacy/` only loses its `mosquitto` service.
- **Database**: one write token for the sensors collector (the existing requirement on separate tokens covers it); no new bucket.
- **Storage**: one point per reading kept without a time limit is a large, mostly simulated volume. Marked as an important open decision in `design.md`; it is settled before this change is merged.
- **Legacy**: no change. Telegraf, `mqtt-ws-bridge`, `dashboard-v2` and Grafana keep reading and writing the legacy sensor data.
- **Docs**: `src/content/docs/{docs,en/docs}/{index,project}.md`.
