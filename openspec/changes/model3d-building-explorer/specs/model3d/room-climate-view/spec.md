# Spec Delta

## Purpose

Describes how the 3D building explorer shows the current climate of one room: which parts of the model are rooms, how a room is selected, where its live values come from and how missing and outdated values appear. Room ids, topics and message fields are those of `platform/data-contract`; the browser connection to the broker is that of `platform/broker`.

## ADDED Requirements

### Requirement: Rooms in the model are identified by their room id
A part of a model SHALL count as a room if its name starts with `U`, `E`, `1`, `2` or `T`. Its room id SHALL be the part of the name before the first `_`, unchanged (for example `134_1` → `134`, `U74.1` → `U74.1`, `1Aula` → `1Aula`), and SHALL be compared with the room ids of `platform/data-contract` case-sensitively. A room belongs to the floor of its first character: `U` basement, `E` ground floor, `1` floor 1, `2` floor 2, `T` gym. All parts with the same room id SHALL act as one room.

#### Scenario: Room made of several parts
- **WHEN** the user clicks the part `134_1`
- **THEN** room `134` is selected and every part of room `134` is highlighted

#### Scenario: Room id with a dot
- **WHEN** a live message for room `U74.1` arrives
- **THEN** it is shown for the room whose part is named `U74.1`, not for `U74`

#### Scenario: Building structure
- **WHEN** the user clicks a wall or window of the building structure
- **THEN** no room is selected

### Requirement: Live values come from the broker
The explorer SHALL receive room-climate live data as specified in `platform/data-contract` ("Room-climate live data is published per room", "Browsers read room-climate live data from the broker") by connecting without credentials to `/mqtt` of the host that served the page, over `wss` when the page was loaded over `https` and `ws` otherwise. It SHALL subscribe to all rooms once at start, so that the latest retained message of every room is known at once. It SHALL NOT publish and SHALL NOT read the database. When the connection is lost, the explorer SHALL keep showing the values it has, judge their age as usual and reconnect by itself.

#### Scenario: Opening the explorer
- **WHEN** the explorer has connected and retained messages exist for rooms `105` and `E10`
- **THEN** both rooms' values are available without waiting for a new reading

#### Scenario: Connection drops
- **WHEN** the broker connection is interrupted for a minute
- **THEN** the explorer keeps the last values, marks them stale once they are older than 5 minutes, and receives new messages again after it has reconnected

### Requirement: Messages are read as the contract specifies
For each room the explorer SHALL keep the message with the newest `ts`; a message with an older `ts` than the one kept SHALL be ignored. A field that is missing or not a number SHALL be unknown, never zero. Fields the contract does not name SHALL be ignored. A message that is not a JSON object, has no numeric `ts`, or whose `room` differs from the room of its topic SHALL be ignored. An empty retained message SHALL remove the room's values.

#### Scenario: Message with CO₂ only
- **WHEN** the newest message for room `105` carries `co2` = 850 and no `temperature`
- **THEN** CO₂ shows 850 ppm and temperature shows as unknown, not as 0 °C

#### Scenario: Two devices in one room
- **WHEN** a message with `ts` 10:00:00 arrives after one with `ts` 10:00:30 for the same room
- **THEN** the values of the 10:00:30 message stay

#### Scenario: Broken message
- **WHEN** a message for room `105` is not valid JSON
- **THEN** it is ignored and the room keeps its previous values

### Requirement: A room's values are current, stale or missing
A room's values SHALL be stale when the `ts` of its newest message is more than 5 minutes before the browser's current time, and current otherwise. A room without a message SHALL have no data. The explorer SHALL re-judge the age of every value at least every 10 seconds, so that a value turns stale without a new message.

#### Scenario: Value becomes stale while viewing
- **WHEN** the info panel of room `105` is open, its newest `ts` is 4 min 50 s old and no new message arrives
- **THEN** within 20 seconds the panel shows the value as stale

#### Scenario: Exactly five minutes
- **WHEN** the newest `ts` is exactly 5 minutes old
- **THEN** the value is still current

### Requirement: Clicking a room opens its info panel
Clicking or tapping a room SHALL select it in every view, including the whole building and the gym: all parts of the room are highlighted, any previous selection is removed, and an info panel opens. If a heatmap is shown, it SHALL be switched off when a room is selected. Clicking a place that is not a room, or closing the panel, SHALL remove the selection.

#### Scenario: Selecting a room
- **WHEN** the user clicks room `153` in the floor 1 view
- **THEN** room `153` is highlighted and the info panel for `153` opens

#### Scenario: Selecting another room
- **WHEN** room `153` is selected and the user clicks room `154`
- **THEN** only `154` is highlighted and the panel shows `154`

#### Scenario: Click while a heatmap is on
- **WHEN** the CO₂ heatmap is shown and the user clicks room `105`
- **THEN** the heatmap is switched off, room `105` is highlighted and its panel opens

#### Scenario: Clicking empty space
- **WHEN** a room is selected and the user clicks the background
- **THEN** the selection is removed and the panel closes

### Requirement: The info panel shows CO₂ and temperature
The info panel SHALL show the room id, the CO₂ concentration in ppm with its status, and the temperature in °C with one decimal. The CO₂ status SHALL follow FSD FR-07 exactly and SHALL be shown as a coloured symbol together with a text:

| CO₂ | Status colour |
|---|---|
| below 600 ppm | green |
| 600 ppm up to and including 1200 ppm | yellow |
| above 1200 ppm | red |

The panel SHALL NOT show humidity or the reading's `source`. The panel SHALL update while it is open when a newer message for its room arrives.

#### Scenario: Values of a room
- **WHEN** the newest message for room `105` carries `co2` = 850 and `temperature` = 22.4
- **THEN** the panel shows `105`, 850 ppm with the yellow status and 22.4 °C

#### Scenario: Status limits
- **WHEN** the CO₂ value is 599, 600, 1200 or 1201 ppm
- **THEN** the status is green, yellow, yellow or red respectively

#### Scenario: Live update
- **WHEN** the panel of room `105` is open and a newer message with `co2` = 1250 arrives
- **THEN** the panel shows 1250 ppm with the red status without any action of the user

### Requirement: The info panel shows the time of the last reading, for now
Until this requirement is removed, the info panel SHALL also show the time of the room's newest reading from its `ts`, in the school's local time (Europe/Vienna), so that the team can check that live data arrives. This requirement is temporary and SHALL be removed before the explorer becomes the main page of the host.

#### Scenario: Time of the reading
- **WHEN** the newest message for room `105` has a `ts` of 2026-10-30 13:05:22 Vienna time
- **THEN** the panel shows the time 13:05:22

### Requirement: Rooms without current data are marked
For a room with no data, the info panel SHALL show "No data for room" (FSD FR-14) instead of values. For a stale room, the panel SHALL show a warning symbol (FSD FR-08), the last values and that they are outdated.

#### Scenario: No message for the room
- **WHEN** the user clicks room `U08` and no message for `U08` has been received
- **THEN** the panel shows `U08` and "No data for room"

#### Scenario: Outdated values
- **WHEN** the user clicks room `105` whose newest message is 12 minutes old
- **THEN** the panel shows the warning symbol, the last CO₂ and temperature values, and that they are outdated

#### Scenario: Broker unreachable
- **WHEN** the explorer cannot reach the broker and the user clicks a room
- **THEN** the panel shows "No data for room" and the explorer keeps working
