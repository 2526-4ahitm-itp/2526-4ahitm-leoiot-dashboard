# Spec Delta

## Purpose

Describes the room-climate dashboard: the web page on which anyone at the school sees whether a room's air is fine right now, how current its values are, and how CO₂, temperature and humidity developed over the last day or week.

## ADDED Requirements

### Requirement: The dashboard is served at `/sensors/`
The dashboard SHALL be reachable at the path `/sensors/` of the host that serves the web applications, without login. `/sensors` SHALL redirect to `/sensors/`. The room shown SHALL be part of the address; without a room in the address the dashboard SHALL show room `105`.

#### Scenario: Plain address
- **WHEN** a visitor opens `/sensors/`
- **THEN** the dashboard shows room `105`

#### Scenario: Room in the address
- **WHEN** a visitor opens the dashboard with room `E10` in the address and `E10` has readings
- **THEN** the dashboard shows room `E10`, with the room id written exactly as on the door sign

### Requirement: Readings come only from the contract
The dashboard SHALL read history from the room-climate readings and current values from the room live messages specified in `platform/data-contract`, and from nothing else. It SHALL deliver no credential to the browser.

#### Scenario: Credentials stay on the server
- **WHEN** someone downloads every file the dashboard serves, including the page, scripts and styles
- **THEN** none of them contains a database token, a password or a broker login

### Requirement: The air state is shown as a traffic light
The dashboard SHALL show the room's air state from its latest CO₂ value as three lamps, of which exactly one is lit: green below 800 ppm, yellow from 800 to 1000 ppm, red above 1000 ppm. Next to the lamps one status sentence SHALL say what to do: "Luft gut", "Bald lüften" or "Jetzt lüften" (English: "Air is fine", "Air the room soon", "Air the room now"), followed by the reason, including since when the value has been above the limit when it is above 800 ppm. The air state SHALL NOT be expressed by colour alone.

#### Scenario: Thresholds
- **WHEN** the latest CO₂ value is 799, 800, 1000 or 1001 ppm
- **THEN** the lit lamp is green, yellow, yellow or red, and the status sentence matches the lamp

#### Scenario: Above the limit for a while
- **WHEN** CO₂ has been above 800 ppm since 9:55 and is 868 ppm now
- **THEN** the yellow lamp is lit and the dashboard says "Bald lüften" and that CO₂ has been above 800 ppm since 9:55

#### Scenario: No CO₂ value yet
- **WHEN** the room has temperature and humidity readings but no CO₂ reading in the last five minutes
- **THEN** no lamp is lit and the status sentence says that there is no current CO₂ value

### Requirement: Current values show their age
The dashboard SHALL show the room's latest CO₂ (ppm, no decimals), temperature (°C, one decimal) and humidity (%, no decimals) and the time of the latest reading with its age, and SHALL update them without reloading when a new live message arrives. A value SHALL change in place without moving other content.

#### Scenario: New reading arrives
- **WHEN** a live message for the shown room arrives
- **THEN** the values and their time are updated within two seconds, and the age counts up from there

#### Scenario: Unknown quantity
- **WHEN** the room's device has delivered no humidity value
- **THEN** humidity is shown as unknown and never as zero

### Requirement: Outdated values are marked
When the latest reading of the room is more than five minutes old, the dashboard SHALL show no lit lamp, SHALL replace the status sentence by one saying that there are no current values and when the last reading was taken, SHALL show the values as outdated and SHALL show a warning symbol. It SHALL return to the normal display by itself when a new reading arrives.

#### Scenario: Box stops sending
- **WHEN** the last reading of room 105 was taken at 10:29 and it is 10:41 now
- **THEN** all lamps are off, the dashboard says there are no current values and that the last reading was at 10:29, the values are greyed and a warning symbol is shown

#### Scenario: Box sends again
- **WHEN** a new live message arrives after the room was shown as outdated
- **THEN** the lamp, the status sentence and the values return to normal without a reload

### Requirement: Rooms without data say so
When the shown room has no reading at all, the dashboard SHALL show "Keine Daten für Raum <room id>" (English: "No data for room <room id>") instead of lamps, values and charts.

#### Scenario: Unknown room in the address
- **WHEN** a visitor opens the dashboard with room `X99` in the address
- **THEN** the dashboard says "Keine Daten für Raum X99" and shows no lamps, values or charts

### Requirement: History is shown in two charts
The dashboard SHALL show a temperature chart and a CO₂/humidity chart, the latter as two panels with their own scales on one shared time axis. The CO₂ panel SHALL mark the ranges below 800, from 800 to 1000 and above 1000 ppm in the colours of the lamps. Pointing at a time in any panel SHALL show the values at that time in every panel. A time without readings SHALL be shown as a gap, never as zero.

#### Scenario: Pointing at a time
- **WHEN** a visitor points at 9:30 in the temperature chart
- **THEN** all three panels mark 9:30 and the values at 9:30 are shown

#### Scenario: Gap in the readings
- **WHEN** the box delivered nothing between 2:00 and 3:00
- **THEN** every panel shows a gap between 2:00 and 3:00

### Requirement: Two time ranges
The dashboard SHALL offer the last 24 hours, the default, and the last 7 days, both ending now. Each chart SHALL state the start and end of the shown range. The last 24 hours SHALL be shown as means of five-minute windows and the last 7 days as means of thirty-minute windows. Times SHALL be shown in the school's local time (Europe/Vienna).

#### Scenario: Switching to 7 days
- **WHEN** a visitor switches to 7 days on Friday 23 October 2026 at 10:41
- **THEN** both charts show 16 October 10:41 to 23 October 10:41 and state that range

### Requirement: Simulated readings are marked
When the shown readings carry the source `simulated`, the dashboard SHALL say so next to the room id instead of "gemessen" ("measured") and SHALL draw the chart lines dashed.

#### Scenario: Simulated room
- **WHEN** a room shows readings whose source is `simulated`
- **THEN** the dashboard says "simuliert" next to the room id and every line is dashed

### Requirement: Live values have a fallback
When the live channel cannot be reached, the dashboard SHALL take the current values from the stored readings once a minute and SHALL return to the live channel by itself when it can be reached again.

#### Scenario: Live channel down
- **WHEN** `/mqtt` does not answer while the box keeps delivering
- **THEN** the values are at most about a minute old, and they update live again after `/mqtt` is back

### Requirement: Languages and themes
The dashboard SHALL offer German (default) and English and a light and a dark theme; the first visit SHALL follow the browser's colour scheme, and the visitor's choices SHALL be kept in the browser.

#### Scenario: Switching language
- **WHEN** a visitor switches to English
- **THEN** every label, status sentence, date and number is shown in English, and the choice is kept on the next visit

### Requirement: Desktop first, nothing breaks on a phone
The dashboard SHALL be laid out for desktop browsers from 1280 pixels width and SHALL remain fully usable down to 360 pixels width without horizontal scrolling of the page.

#### Scenario: Narrow window
- **WHEN** the dashboard is opened at 360 pixels width
- **THEN** room id, lamps, status, values and both charts are shown one below the other and the page does not scroll sideways
