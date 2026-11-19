# Spec Delta

## ADDED Requirements

### Requirement: Room live messages expire after 30 days
Every room live message, as specified in "Room-climate live data is published per room", SHALL be published with an MQTT 5 message expiry interval of 30 days (2 592 000 seconds). The broker SHALL then drop a room's retained message 30 days after it was published, unless a newer message for the room replaced it. A consumer SHALL treat a room without a retained message as a room without data. Within the 30 days, a consumer SHALL judge how current a message is by its `ts` as before.

#### Scenario: Device keeps delivering
- **WHEN** a room's device delivers a reading every 10 seconds
- **THEN** every new message replaces the retained one and the room never loses its retained message

#### Scenario: Device removed
- **WHEN** the last message for room `107` was published on 1 December at 10:00 and nothing is published for `107` afterwards
- **THEN** a client that subscribes to `leoiot/room-climate/#` on 30 December receives that message, shown as outdated by its `ts`, and a client that subscribes on 1 January at 10:01 receives no message for `107`

#### Scenario: Subscriber on MQTT 3.1.1
- **WHEN** a browser subscribes over MQTT 3.1.1 to `leoiot/room-climate/#`
- **THEN** it receives the retained messages that have not expired, and none that have

### Requirement: A room's floor follows from its room id
The floor of a room SHALL be given by the first character of its room id: `U` basement, `E` ground floor, `1` floor 1, `2` floor 2, `T` gym. A room id starting with any other character SHALL belong to no known floor. A consumer that groups or orders rooms by floor SHALL use this rule and SHALL NOT keep its own list of rooms per floor.

#### Scenario: Rooms of the first floor
- **WHEN** a consumer groups the rooms `105`, `1Aula` and `E10` by floor
- **THEN** `105` and `1Aula` belong to floor 1 and `E10` to the ground floor

#### Scenario: Unknown floor
- **WHEN** a room id is `X99`
- **THEN** it belongs to no known floor
