# Spec Delta

## MODIFIED Requirements

### Requirement: Outdated values are marked
When the latest reading of the room is more than five minutes old, the dashboard SHALL show no lit lamp, neither in the CO₂ traffic light nor in the lamps of temperature and humidity, SHALL replace the status sentence by one saying that there are no current values and when the last reading was taken, SHALL show the values as outdated and SHALL show a warning symbol. It SHALL return to the normal display by itself when a new reading arrives.

#### Scenario: Box stops sending
- **WHEN** the last reading of room 105 was taken at 10:29 and it is 10:41 now
- **THEN** all lamps are off, the dashboard says there are no current values and that the last reading was at 10:29, the values are greyed and a warning symbol is shown

#### Scenario: Box sends again
- **WHEN** a new live message arrives after the room was shown as outdated
- **THEN** the lamps, the status sentence and the values return to normal without a reload

### Requirement: Simulated readings are marked
When the shown readings carry the source `simulated`, the dashboard SHALL say "simuliert" ("simulated") next to the room id and SHALL draw the chart lines dashed. Measured readings SHALL get no such word.

#### Scenario: Simulated room
- **WHEN** a room shows readings whose source is `simulated`
- **THEN** the dashboard says "simuliert" next to the room id and every line is dashed

#### Scenario: Measured room
- **WHEN** room `105` shows readings whose source is `sensor`
- **THEN** the identity line reads "Raum 105" without "gemessen" or "simuliert", and the lines are solid

### Requirement: Desktop first, nothing breaks on a phone
The dashboard SHALL be laid out for desktop browsers from 1280 pixels width and SHALL remain fully usable down to 360 pixels width without horizontal scrolling of the page.

#### Scenario: Narrow window
- **WHEN** the dashboard is opened at 360 pixels width
- **THEN** the identity line, the lamps, the status, the values, the summary of the day and both charts are shown one below the other and the page does not scroll sideways

## ADDED Requirements

### Requirement: The room is named in one line
The room panel SHALL name the room in one line as "Raum <room id>" (English: "Room <room id>"), with the room id written exactly as on the door sign, followed by the link to the building model of `platform/room-links` where that applies. The line SHALL NOT name the device that took the readings. The room SHALL remain the page's main heading for assistive technology.

#### Scenario: Room 105
- **WHEN** a visitor views room `105` in German
- **THEN** the room panel starts with the line "Raum 105" and the link "Im Gebäude zeigen", and no device name is shown

#### Scenario: English
- **WHEN** a visitor views room `E10` in English
- **THEN** the line reads "Room E10"

### Requirement: Temperature and humidity have their own lamps
Next to the temperature and the humidity value, the dashboard SHALL show one small lamp each, lit green inside the range and amber outside it, with a short text that says the state and its direction. The ranges SHALL be those of § 28 of the Austrian Bundes-Arbeitsstättenverordnung: temperature from 19 to 25 °C (work with low physical load), relative humidity from 40 to 70 % (stated there for rooms with air conditioning, used here as a guide value). The bounds SHALL belong to the range. The value SHALL be compared as shown (temperature with one decimal, humidity without decimals), and SHALL take the ink colour of its lamp. These lamps SHALL NOT change the CO₂ traffic light or the status sentence. An unknown value SHALL leave its lamp off. The state SHALL NOT be expressed by colour alone.

| Value | Lamp | Text (German / English) |
|---|---|---|
| temperature below 19.0 °C | amber | "zu kalt" / "too cold" |
| temperature 19.0 to 25.0 °C | green | "im Bereich" / "in range" |
| temperature above 25.0 °C | amber | "zu warm" / "too warm" |
| humidity below 40 % | amber | "zu trocken" / "too dry" |
| humidity 40 to 70 % | green | "im Bereich" / "in range" |
| humidity above 70 % | amber | "zu feucht" / "too humid" |

#### Scenario: Limits of the temperature
- **WHEN** the temperature is 18.9, 19.0, 25.0 or 25.1 °C
- **THEN** its lamp is amber with "zu kalt", green, green, or amber with "zu warm"

#### Scenario: Dry room with good air
- **WHEN** CO₂ is 426 ppm, temperature 20.2 °C and humidity 28 %
- **THEN** the CO₂ lamp is green with "Luft gut", the temperature lamp is green, and the humidity lamp is amber with "zu trocken"

#### Scenario: No humidity value
- **WHEN** the room's device has delivered no humidity value
- **THEN** humidity is shown as unknown and its lamp is off

### Requirement: The day is summarised next to the values
The room panel SHALL show a summary of the current day, from midnight in the school's local time (Europe/Vienna) until now, whatever time range the charts show. It SHALL contain:

- the time CO₂ was above 1000 ppm today, counted in the five-minute windows of the history whose mean is above 1000 ppm, or a text saying it has not been above 1000 ppm today;
- the highest single CO₂ reading of today and the time it was taken, from the stored readings of the shown source;
- the time the room was last aired, estimated from the five-minute history as the start of the latest fall of CO₂ by at least 200 ppm within at most fifteen minutes today, marked as an estimate in its text, or a text saying no airing was detected today.

The summary SHALL be updated at least once a minute. When the room has no reading today, the summary SHALL say so. When the readings are simulated, the summary SHALL be shown like the other values of a simulated room.

#### Scenario: A school day
- **WHEN** room 105 was above 1000 ppm in sixteen five-minute windows today, its highest reading today was 1450 ppm at 13:05, and CO₂ fell from 1380 to 1020 ppm between 10:45 and 10:55
- **THEN** the summary says above 1000 ppm for 1 h 20 min, highest value 1450 ppm at 13:05, and last aired at about 10:45, marked as an estimate

#### Scenario: Early morning
- **WHEN** it is 06:30 and CO₂ has stayed below 1000 ppm since midnight without a fall of 200 ppm
- **THEN** the summary says it has not been above 1000 ppm today and that no airing was detected today, and shows the highest value so far

#### Scenario: Range switched to 7 days
- **WHEN** a visitor switches the charts to 7 days
- **THEN** the summary still covers today only
