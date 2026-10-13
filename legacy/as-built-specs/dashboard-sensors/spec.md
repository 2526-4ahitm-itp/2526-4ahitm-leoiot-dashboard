# Dashboard — Sensors (Climate) Specification

> Status: SKELETON. Framing: AS-INTENDED (target behavior per FSD, not current code).
> Deep-dive thread: read `dashboard-v2/dashboard.js` (sensors view), `index.html`, `style.css`.

## Purpose

Provide a web dashboard that visualizes room climate data (CO2 and temperature)
for non-technical school users, with per-room selection, a live overview table,
and historical charts. Served at `vm23.htl-leonding.ac.at/dashboard/` (Sensors view).

## Requirements

### Requirement: Room Climate Display
The system SHALL display current CO2 and temperature values per room.

#### Scenario: User opens climate dashboard
- WHEN a user opens the Sensors view
- THEN current CO2 (ppm) and temperature (°C) are shown for the selected room or an all-rooms average

### Requirement: Room Selection
The system SHALL let the user select a specific room to view room-specific values and history.

#### Scenario: Select a room
- WHEN a user selects room "105"
- THEN summary cards and temperature/CO2 history charts show data for room 105

### Requirement: CO2 Status Colors
The system SHALL color-code CO2 by threshold: green `< 600 ppm`, yellow `600–1200 ppm`, red `> 1200 ppm`.

#### Scenario: CO2 boundary coloring
- WHEN a room reports CO2 of 1201 ppm
- THEN it renders red

### Requirement: Stale Sensor Warning
The system SHALL display a warning indicator for a sensor that has sent no data for 5 minutes.

#### Scenario: Sensor goes silent
- WHEN no reading arrives for a room for 5 minutes
- THEN a warning symbol appears for that room

### Requirement: Invalid Room Message
The system SHALL show a "No data for room" message for an invalid or empty room request.

#### Scenario: Invalid room
- WHEN a user requests a room with no data
- THEN a "No data for room" message is shown and no room page is opened

### Requirement: Historical Viewing
The system SHALL allow viewing historical CO2/temperature for selected date/time ranges.

#### Scenario: Pick a past day
- WHEN a user selects a previous date
- THEN charts show that day's data in school-local timezone (Europe/Vienna)

## Implementation Gap (AS-INTENDED vs current code)

- CO2 thresholds: intent `600/1200`; code uses `800/1000` (`dashboard.js:1767`). → change proposal.
- Stale 5-min warning: NOT implemented (no staleness eval). → change proposal.
- Refresh interval: intent configurable, default 10s; code hardcodes 30s (`dashboard.js:35`). → change proposal.

## TODO (per-thread deep-dive)

- [ ] Document InfluxDB Flux queries + measurements consumed (`room_temperature`, `mqtt_consumer`)
- [ ] Document room↔topic mapping incl. `nili3_co2 → 105` special case
- [ ] Document summary-card aggregation (current vs 24h avg) and floor filters
- [ ] Document pagination + table status logic
- [ ] Confirm retention requirement (FSD open question: 3/6/12 months?)
