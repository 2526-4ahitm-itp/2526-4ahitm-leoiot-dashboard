# sensors/collector Specification

## Purpose
Describes the service that turns the readings of the school's room-climate devices into the room-climate data of `platform/data-contract`: which devices it reads, how it stores and publishes their readings, and how it behaves when a device, the database or the broker misbehaves.

## Requirements

### Requirement: Devices are read through a mapping
The collector SHALL read only the devices listed in its device mapping. For each device the mapping SHALL name the device, the room id of the room it is in, its source (`sensor` or `simulated`) and, per quantity of the contract it delivers (CO₂, temperature, humidity), the one broker topic that carries that quantity. The collector SHALL subscribe to exactly these topics and to no topic pattern. The mapping SHALL be part of the collector's configuration and SHALL contain no credentials.

The first mapping SHALL contain the device `nili3` in room `105` with source `sensor`.

#### Scenario: Mapped device delivers
- **WHEN** `nili3` publishes a CO₂ value on its mapped CO₂ topic
- **THEN** the collector handles it as a CO₂ reading of device `nili3` in room `105` with source `sensor`

#### Scenario: Topic outside the mapping
- **WHEN** a message arrives on a topic that resembles a device topic but is not in the mapping, for example a generated value published by a legacy simulator under the same prefix
- **THEN** the collector does not receive or handle it

#### Scenario: Invalid mapping
- **WHEN** the mapping names a room id that breaks the room id rule of `platform/data-contract`, names one device twice, names a source other than `sensor` or `simulated`, or maps one topic to two quantities
- **THEN** the collector does not start and its log names the invalid entry

### Requirement: Readings are stored as the contract specifies
For every valid value a mapped device delivers, the collector SHALL store one point of room-climate readings exactly as specified in `platform/data-contract`, carrying the device's room, device name and source from the mapping, the one field of the delivered quantity, and the time the value was received.

#### Scenario: Reading stored
- **WHEN** `nili3` delivers a temperature of 22.4
- **THEN** a reader of room-climate readings finds within ten seconds one new point for room `105`, device `nili3`, source `sensor`, carrying only the temperature 22.4, stamped with the time of receipt

#### Scenario: Two quantities at nearly the same time
- **WHEN** `nili3` delivers temperature and humidity within the same millisecond
- **THEN** two points are stored, one per value, with distinct timestamps, and neither carries the other quantity as zero

#### Scenario: Retained value replayed by the broker
- **WHEN** the collector subscribes (at start or after a reconnect) and the broker replays the last retained value of a device topic
- **THEN** the replayed value is not a delivery: it is neither stored nor published, because its time of receipt would not be the time it was measured

### Requirement: Readings are published as the contract specifies
For every valid value a mapped device delivers, the collector SHALL publish the room's live message as specified in `platform/data-contract`, carrying the device's latest value of every quantity it has delivered since the collector started, and as time the receipt of the value just delivered.

#### Scenario: Live message after a reading
- **WHEN** `nili3` has delivered CO₂ 868 and humidity 47 and then delivers a temperature of 22.4
- **THEN** the room's live message is published retained with CO₂ 868, temperature 22.4, humidity 47 and the receipt time of the temperature

#### Scenario: First reading after a restart
- **WHEN** the collector has just started and `nili3` delivers its first value, a CO₂ reading
- **THEN** the live message carries CO₂ only, and temperature and humidity appear in later messages once they have been delivered

### Requirement: Invalid values are dropped
A value that is not a finite number, or that lies outside the range a room-climate device can measure (CO₂ 0 to 10 000 ppm, temperature −40 to 85 °C, humidity 0 to 100 %), SHALL be neither stored nor published, and the collector SHALL log the device, the quantity and the received value.

#### Scenario: Device reports an unavailable sensor
- **WHEN** `nili3` publishes `nan` or `unavailable` on its CO₂ topic
- **THEN** no point is stored, no live message is published for it, the log names `nili3`, CO₂ and the received text, and the next valid CO₂ value is handled normally

#### Scenario: Value out of range
- **WHEN** `nili3` publishes a humidity of 140
- **THEN** it is neither stored nor published, and the log says so

### Requirement: The collector recovers by itself
The collector SHALL keep running when the broker or the database is unreachable or answers with an error. It SHALL reconnect to the broker and subscribe again by itself. Readings received while the database cannot be written SHALL be kept and written once it can be written again, up to one hour of readings; older kept readings SHALL be dropped and the number dropped SHALL be logged.

#### Scenario: Broker restarted
- **WHEN** the broker is restarted
- **THEN** the collector reconnects and subscribes again without being restarted, and the first value the device delivers afterwards is stored and published

#### Scenario: Database unreachable for ten minutes
- **WHEN** the database cannot be written for ten minutes while `nili3` keeps delivering
- **THEN** after the database is back every reading of those ten minutes is stored with its original time of receipt, and live messages were published throughout

### Requirement: Health is reported
The collector SHALL report itself unhealthy to the container runtime while it has been disconnected from the broker for more than two minutes, or while writing to the database has failed for more than five minutes. A device that delivers nothing SHALL NOT make the collector unhealthy.

#### Scenario: Box switched off
- **WHEN** `nili3` delivers nothing for an hour while broker and database work
- **THEN** the collector stays healthy, no points are stored for that hour, and the retained live message keeps its old time

#### Scenario: Database down
- **WHEN** every write to the database has failed for six minutes
- **THEN** the container is reported unhealthy, and healthy again after the first successful write

### Requirement: Credentials come from the environment
The collector SHALL take its broker account, its broker password and its database token from its environment only, SHALL NOT log them, and SHALL refuse to start with a message naming each missing variable when one is missing.

#### Scenario: Token missing
- **WHEN** the collector starts without a database token
- **THEN** it exits at once and the log names the missing variable but no credential value

### Requirement: Legacy readers are unaffected
Running the collector SHALL NOT change what any part of `legacy/` reads or shows: the collector only subscribes to device topics and never publishes on them.

#### Scenario: Legacy dashboard while the collector runs
- **WHEN** the collector runs next to the legacy stack
- **THEN** the legacy dashboard and Grafana show the values of room 105 exactly as before
