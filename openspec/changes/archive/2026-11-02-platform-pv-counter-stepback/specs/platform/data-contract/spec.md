## ADDED Requirements

### Requirement: Daily fields of `solax_stats` can step back within a day
The daily fields `daily_yield`, `daily_exported`, `daily_imported`, `daily_charged` and `daily_discharged`, and with them `consumption`, SHALL be stored as the plant's cloud service delivers them; a writer SHALL NOT smooth or correct them. Within one plant-local day such a field MAY fall below an earlier value of the same day and rise again a few minutes later.

The day change SHALL be recognised by a fall within the first 30 minutes of the plant's local day or by a fall of the sum of the five daily fields to less than half. Any other fall is a step back. A reader SHALL read each daily field as its highest value so far that day and SHALL NOT derive negative energy or power from a step back. Points before the day change that still carry the totals of the day before SHALL count for the day before.

#### Scenario: A field steps back during the day
- **WHEN** `daily_imported` reads 30.0 kWh at 04:44, 24.0 kWh at 04:45 and 30.0 kWh again at 04:50 plant local time
- **THEN** the point at 04:45 stores 24.0 kWh, a reader takes 30.0 kWh as the day's value at 04:45, the readings before 04:45 still belong to the same day, and no negative import is derived for 04:44 to 04:45

#### Scenario: Day change after midnight
- **WHEN** the points up to 00:07 plant local time still carry the totals of the day before and the point at 00:08 carries all daily fields near zero
- **THEN** a reader treats the fall at 00:08 as the day change and counts the points from 00:00 to 00:07 for the day before

#### Scenario: Writer receives a lower value
- **WHEN** the cloud service delivers a daily field lower than in the previous reading of the same day
- **THEN** the writer stores that lower value in the point as delivered
