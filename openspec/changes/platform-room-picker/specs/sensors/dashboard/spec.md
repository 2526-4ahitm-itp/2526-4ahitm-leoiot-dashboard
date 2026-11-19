# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard is served at `/sensors/`
The dashboard SHALL be reachable at the path `/sensors/` of the host that serves the web applications, without login. `/sensors` SHALL redirect to `/sensors/`. The room shown SHALL be part of the address, as specified in `platform/room-links`; without a room in the address the dashboard SHALL show the room list.

#### Scenario: Plain address
- **WHEN** a visitor opens `/sensors/`
- **THEN** the dashboard shows the room list

#### Scenario: Room in the address
- **WHEN** a visitor opens the dashboard with room `E10` in the address and `E10` has readings
- **THEN** the dashboard shows room `E10`, with the room id written exactly as on the door sign

### Requirement: Rooms without data say so
When the shown room has no reading at all, the dashboard SHALL show "Keine Daten für Raum <room id>" (English: "No data for room <room id>") instead of lamps, values and charts, and SHALL show the room list below it.

#### Scenario: Unknown room in the address
- **WHEN** a visitor opens the dashboard with room `X99` in the address
- **THEN** the dashboard says "Keine Daten für Raum X99", shows no lamps, values or charts, and shows the room list below

#### Scenario: Leaving a room without data
- **WHEN** a visitor sees "Keine Daten für Raum X99" and room `105` has a live message
- **THEN** room `105` can be opened from the room list on the same page

## ADDED Requirements

### Requirement: The room list shows every room with live data
The room list SHALL show every room that has a retained live message, as specified in `platform/data-contract`, grouped by floor as specified there, in the order basement, ground floor, floor 1, floor 2, gym, and rooms of no known floor last. Within a floor, rooms SHALL be ordered by their room id with digit runs compared as numbers (`T2` before `T10`). For each room the list SHALL show the room id, its air state and its CO₂ value by the same rules as the room page (limits, five-minute age, unknown values as a dash), and SHALL mark rooms whose readings are simulated. The air state SHALL NOT be expressed by colour alone. Each room SHALL be a link to its room page. The list SHALL update without reloading when a live message arrives, and SHALL take its rooms from the stored readings of the last 30 days once a minute while the live channel cannot be reached. When no room has data, the list SHALL say so.

#### Scenario: Rooms on two floors
- **WHEN** live messages exist for rooms `E10`, `105` and `1Aula`
- **THEN** the list shows `E10` under the ground floor and `105` and `1Aula` under floor 1

#### Scenario: Air state in the list
- **WHEN** room `105`'s newest message is 1 minute old and carries `co2` = 1120
- **THEN** the list shows `105` with 1120 ppm and the red air state in text and colour

#### Scenario: Outdated room in the list
- **WHEN** room `107`'s newest message is 2 hours old
- **THEN** the list shows `107` as outdated, with no air state

#### Scenario: Simulated room in the list
- **WHEN** room `E10`'s newest message carries `source` = `simulated`
- **THEN** the list marks `E10` as simulated

#### Scenario: Live update
- **WHEN** the list is open and a new live message for room `105` arrives
- **THEN** the list shows the new value and air state of `105` without a reload

#### Scenario: No room has data
- **WHEN** no room has a retained live message
- **THEN** the list says that no room is sending readings at the moment

### Requirement: Another room can be chosen on every room page
Every room page SHALL offer a choice of the rooms of the room list, grouped by floor, and a link to the room list. Choosing a room SHALL open its room page at its address, so that the browser's back button returns to the previous room. The shown room SHALL be selected in the choice even when it has no data.

#### Scenario: Choosing a room
- **WHEN** a visitor on room `105` chooses room `E10`
- **THEN** the dashboard shows room `E10` at `/sensors/?room=E10`, and going back shows room `105` again

#### Scenario: Back to the list
- **WHEN** a visitor on room `105` follows the link to the room list
- **THEN** the dashboard shows the room list at `/sensors/`
