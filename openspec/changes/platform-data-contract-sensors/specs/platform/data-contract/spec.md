# Spec Delta

## ADDED Requirements

### Requirement: Room-climate readings are stored as `room_climate`
Room-climate readings SHALL be stored in the InfluxDB organisation `leoiot`, bucket `server_data`, as measurement `room_climate` with these tags:

| Tag | Meaning |
|---|---|
| `room` | the room id of the room the reading was taken in, as specified in "Rooms are identified by their room id" |
| `device` | the name of the device that took the reading, for example `nili3`; unique among all devices |
| `source` | `sensor` for a reading taken by a physical device, `simulated` for a generated one |

and these fields, all floating-point numbers:

| Field | Unit | Meaning |
|---|---|---|
| `co2` | ppm | carbon dioxide concentration of the room air |
| `temperature` | °C | air temperature |
| `humidity` | % | relative humidity |

One point SHALL be written for every reading a device delivers. The timestamp of a point SHALL be the time the reading was received. A point SHALL carry at least one of the fields; a reader SHALL treat a field that is missing from a point as unknown and not as zero.

#### Scenario: Reader asks for a room's recent values
- **WHEN** a reader queries `room_climate` for room `105` over the last ten minutes while its device is delivering
- **THEN** it receives points tagged `room` = `105`, each with at least one of `co2`, `temperature` and `humidity`

#### Scenario: Point with a single field
- **WHEN** a device delivers only a CO₂ reading
- **THEN** the point carries `co2` only, and a reader does not show temperature or humidity as zero for that time

#### Scenario: Device goes silent
- **WHEN** a device delivers nothing for some minutes
- **THEN** there are no points from that device for those minutes

#### Scenario: Two devices in one room
- **WHEN** two devices deliver readings for the same room
- **THEN** their points carry the same `room` and different `device` tags, and a reader can tell them apart

### Requirement: Rooms are identified by their room id
A room id SHALL be the room's name as written on its door sign and in the 3D building model, for example `105`, `153`, `E10`, `U08`, `1Aula`, `UBiolab`, `U74.1`. Room ids SHALL be compared case-sensitively and SHALL NOT be lowercased, abbreviated or otherwise changed by any writer or forwarder. A room id SHALL consist only of letters, digits and dots.

#### Scenario: Room id with letters
- **WHEN** a reading from room `UBiolab` is stored and published
- **THEN** the stored tag and the live topic both carry `UBiolab`, not `ubiolab` or `Ubiolab`

#### Scenario: Room id in a topic
- **WHEN** a room id is used as a topic level
- **THEN** it contains no `/`, `+` or `#` and needs no escaping

### Requirement: Simulated readings are marked
Every generated reading SHALL carry `source` = `simulated`, in the database and in the live data. A reading SHALL carry `source` = `sensor` only if a physical device took it.

#### Scenario: Reader wants measured data only
- **WHEN** a reader filters `room_climate` on `source` = `sensor`
- **THEN** it receives no generated readings

#### Scenario: Simulator and real device in the same room
- **WHEN** a simulator and a physical device both deliver readings for one room
- **THEN** a reader can tell every reading's origin from its `source`

### Requirement: Room-climate live data is published per room
For every reading, the current values of the reading's device SHALL be published as a JSON object, retained, on the topic `leoiot/room-climate/<room>`, where `<room>` is the room id. The object SHALL carry `room`, `device`, `source` (as in storage), `ts` (the time the reading was received, in milliseconds since the epoch) and those of `co2`, `temperature` and `humidity` (numbers, units as in storage) for which the device has delivered a value. Further fields may be present. A consumer SHALL ignore fields it does not know and SHALL judge how current a message is by `ts`, not by its arrival.

#### Scenario: New subscriber
- **WHEN** a client subscribes to `leoiot/room-climate/#`
- **THEN** it at once receives the latest message of every room that has one, without waiting for the next reading

#### Scenario: Device stops delivering
- **WHEN** a room's device has delivered nothing for ten minutes
- **THEN** the retained message for that room still carries the old `ts`, and a consumer can show the value as outdated

#### Scenario: Unknown extra field
- **WHEN** a message carries a field this contract does not name
- **THEN** the consumer ignores that field and processes the message

### Requirement: Browsers read room-climate live data from the broker
The platform SHALL make the broker reachable for browsers as MQTT over WebSocket at the path `/mqtt` of the host that serves the web applications. A connection there SHALL need no credentials. Such a connection SHALL be allowed to subscribe to `leoiot/room-climate/#` and to nothing else, and SHALL NOT be allowed to publish.

#### Scenario: Browser subscribes
- **WHEN** a browser connects to `/mqtt` without credentials and subscribes to `leoiot/room-climate/#`
- **THEN** it receives the retained room messages and every new one

#### Scenario: Browser tries to publish
- **WHEN** a connection without credentials publishes to any topic, including `leoiot/room-climate/105` or `co2/threshold/high`
- **THEN** the broker does not deliver the message to any subscriber and does not change any retained message

#### Scenario: Browser subscribes outside the room-climate topics
- **WHEN** a connection without credentials subscribes to `#` or to a device topic
- **THEN** it receives no message from outside `leoiot/room-climate/#`

### Requirement: Stored room-climate readings are kept for a stated time
The contract SHALL state for how long room-climate readings are kept, and that time SHALL be at least 13 months so that a month can be compared with the same month of the year before.

Room-climate readings are currently kept without a time limit: the bucket `server_data` has no expiry.

#### Scenario: Same month last year
- **WHEN** a reader queries `room_climate` for a month that began 13 months ago
- **THEN** the readings of that month are still available

### Requirement: New sub-projects use only the room-climate interfaces of this contract
A sub-project outside `legacy/` SHALL read room-climate data only through the interfaces specified here. The legacy sensor data (the measurements `mqtt_consumer` and `room_temperature`, the topics `room-temperature` and `nili3/…`, the `temp` and `co2` messages on `/ws`) is not part of this contract; it SHALL stay unchanged while any part of `legacy/` reads or writes it.

#### Scenario: New dashboard needs history
- **WHEN** a sensors dashboard shows the last week of a room
- **THEN** it queries `room_climate` and not `mqtt_consumer` or `room_temperature`

#### Scenario: Legacy dashboard after the collector starts
- **WHEN** the new collector writes `room_climate`
- **THEN** the legacy dashboard, Grafana and the legacy WebSocket forwarder show the same values as before, without any change to them
