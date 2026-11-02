# data-contract Specification

## Purpose

Specifies the data interfaces sub-projects share: what is stored in the database, what is published on the broker and what reaches browsers over the live channel. A sub-project relies on nothing that is not written here.

## Requirements

### Requirement: PV daily readings are stored as `solax_stats`
PV readings SHALL be stored in the InfluxDB organisation `leoiot`, bucket `server_data`, as measurement `solax_stats` with the tag `plant_id` and these fields, all floating-point numbers in kWh:

| Field | Meaning |
|---|---|
| `daily_yield` | energy produced since midnight, plant local time |
| `daily_exported` | energy fed into the grid since midnight |
| `daily_imported` | energy drawn from the grid since midnight |
| `daily_charged` | energy charged into the battery since midnight |
| `daily_discharged` | energy taken from the battery since midnight |
| `consumption` | `daily_yield − daily_exported + daily_imported` |
| `total_yield` | energy produced over the lifetime of the plant |

One point SHALL be written per minute while the plant's cloud service answers. The timestamp of a point SHALL be the time the reading was collected. All fields of one reading SHALL be written in the same point.

Points with a timestamp before 2026-04-20 MAY carry only `daily_yield` and `consumption`. A reader SHALL treat a field that is missing from a point as unknown and not as zero.

#### Scenario: Reader asks for today's values
- **WHEN** a reader queries `solax_stats` for the last ten minutes during normal operation
- **THEN** it receives about ten points, each carrying all seven fields

#### Scenario: Day change
- **WHEN** the plant's local day ends
- **THEN** the six daily fields start again near zero and `total_yield` keeps growing; the first points after midnight may still carry the totals of the day before

#### Scenario: Collection interrupted
- **WHEN** no reading could be collected for some minutes
- **THEN** there are no points for those minutes, and the next point again carries the full totals of the day

#### Scenario: Reader meets an early point
- **WHEN** a reader queries a time range before 2026-04-20
- **THEN** it may receive points without `daily_exported`, `daily_imported`, `daily_charged`, `daily_discharged` and `total_yield`, and it does not show the missing values as zero

### Requirement: The `consumption` field excludes the battery
The field `consumption` SHALL keep the definition above while any reader depends on it. A reader that needs consumption including battery charge and discharge SHALL compute it from the other fields.

#### Scenario: Battery discharges in the evening
- **WHEN** the battery supplies energy that neither comes from the grid nor from current production
- **THEN** `consumption` does not include that energy, and a reader derives the complete figure from `daily_yield`, `daily_exported`, `daily_imported`, `daily_charged` and `daily_discharged`

### Requirement: PV live data is published on one broker topic
PV live data SHALL be published as a JSON object on the topic `leoenergy/solax_pv/overall_inverter`. Two message shapes are valid on this topic and a consumer SHALL accept both and tell them apart by their field names:

- **Daily totals**, published once per minute and retained: `dailyYield`, `dailyExported`, `dailyImported`, `dailyCharged`, `dailyDischarged`, `totalYield` (kWh) and `plantLocalTime`. Further fields may be present.
- **Momentary power**: `pv_power_kw`, `load_power_kw`, `grid_power_kw`, `battery_power_kw` (kW) and `daily_pv_kwh` (kWh), published about every two seconds. `grid_power_kw` is negative while the site draws power from the grid. Further fields may be present.

#### Scenario: Consumer receives daily totals
- **WHEN** a message with `dailyYield` and without `pv_power_kw` arrives
- **THEN** the consumer treats it as daily totals and does not read momentary power from it

#### Scenario: Consumer receives momentary power
- **WHEN** a message with `pv_power_kw` arrives
- **THEN** the consumer reads the four power values in kW from it

#### Scenario: Unknown extra field
- **WHEN** a message carries a field this contract does not name
- **THEN** the consumer ignores that field and processes the message

### Requirement: PV live data reaches browsers over the WebSocket channel
The platform SHALL forward every message of the PV live topic to all clients connected to the WebSocket channel at `/ws`, as `{"type":"pv","data":{…}}`, where `data` is the published object with an added `_ts` holding the forwarding time in milliseconds since the epoch. A client SHALL receive PV messages without subscribing, and a newly connected client SHALL at once receive the most recent PV message if there is one.

#### Scenario: Client connects
- **WHEN** a browser opens the WebSocket channel after a PV message has been forwarded
- **THEN** it receives a `hello` message and then the most recent `pv` message without sending anything

#### Scenario: New PV message
- **WHEN** a message is published on the PV live topic
- **THEN** every connected client receives it as a `pv` message with `_ts` set

### Requirement: Readers and writers get separate, limited database access
The platform SHALL give a sub-project that only reads the bucket a token that allows reading it and nothing else, and a sub-project that writes readings a token that allows writing to the bucket and nothing else. A sub-project SHALL NOT use the administrator token.

#### Scenario: Reader tries to write
- **WHEN** a request with a read token tries to write a point or delete data
- **THEN** the database rejects it

#### Scenario: Reader queries
- **WHEN** a request with a read token queries `solax_stats`
- **THEN** it receives the data

### Requirement: Stored PV readings are kept for a stated time
The contract SHALL state for how long PV readings are kept in the bucket, and that time SHALL be at least eight days so that a view of the last seven calendar days is complete.

PV readings are currently kept without a time limit: the bucket `server_data` has no expiry.

#### Scenario: Weekly view
- **WHEN** a reader queries the last seven calendar days
- **THEN** readings for each of those days are still available

#### Scenario: Old readings
- **WHEN** a reader queries a day more than eight days ago
- **THEN** the readings are still available as long as this contract states no time limit

### Requirement: The PV interfaces stay compatible during the migration
While any part of `legacy/` reads or writes a PV interface specified here, that interface SHALL NOT be renamed, removed or redefined. Additions that existing consumers ignore are allowed.

#### Scenario: New writer replaces the legacy one
- **WHEN** the legacy collector is replaced by a new one
- **THEN** legacy readers show the same values as before without any change to them

#### Scenario: Request to rename a field
- **WHEN** someone proposes to rename a field while a legacy app still queries it
- **THEN** the proposal waits until that app is removed, or adds a new field beside the old one

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
