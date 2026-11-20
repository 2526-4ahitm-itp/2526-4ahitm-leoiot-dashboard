# Spec Delta

## MODIFIED Requirements

### Requirement: The day is summarised next to the values
The room panel SHALL show a summary of the current day, from midnight in the school's local time (Europe/Vienna) until now, whatever time range the charts show. It SHALL contain:

- the time CO₂ was above 1000 ppm today, counted in whole minutes in which the highest stored reading of the shown source is above 1000 ppm, or a text saying it has not been above 1000 ppm today; when today's highest value, including the current reading, is above 1000 ppm, the time SHALL be at least one minute;
- the highest single CO₂ reading of today and the time it was taken, from the stored readings of the shown source;
- the time the room was last aired, estimated from the five-minute history as the start of the latest fall of CO₂ by at least 200 ppm within at most fifteen minutes today, marked as an estimate in its text, or a text saying no airing was detected today.

The summary SHALL be updated at least once a minute. When the room has no reading today, the summary SHALL say so. When the readings are simulated, the summary SHALL be shown like the other values of a simulated room.

#### Scenario: A school day
- **WHEN** room 105 had readings above 1000 ppm in eighty different minutes today, its highest reading today was 1450 ppm at 13:05, and CO₂ fell from 1380 to 1020 ppm between 10:45 and 10:55
- **THEN** the summary says above 1000 ppm for 1 h 20 min, highest value 1450 ppm at 13:05, and last aired at about 10:45, marked as an estimate

#### Scenario: A short spike
- **WHEN** one reading of 1034 ppm at 12:46 is the only reading above 1000 ppm today
- **THEN** the summary says above 1000 ppm for 1 min and highest value 1034 ppm at 12:46

#### Scenario: Early morning
- **WHEN** it is 06:30 and CO₂ has stayed below 1000 ppm since midnight without a fall of 200 ppm
- **THEN** the summary says it has not been above 1000 ppm today and that no airing was detected today, and shows the highest value so far

#### Scenario: Range switched to 7 days
- **WHEN** a visitor switches the charts to 7 days
- **THEN** the summary still covers today only

### Requirement: Two time ranges
The dashboard SHALL offer the last 24 hours, the default, and the last 7 days, both ending now. Each chart SHALL state the start and end of the shown range. The last 24 hours SHALL be shown as means of five-minute windows and the last 7 days as means of thirty-minute windows. Times SHALL be shown in the school's local time (Europe/Vienna).

#### Scenario: Switching to 7 days
- **WHEN** a visitor switches to 7 days on Friday 23 October 2026 at 10:41
- **THEN** all three charts show 16 October 10:41 to 23 October 10:41 and state that range
