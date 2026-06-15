# Dashboard — PV (Energy) Specification

> Status: SKELETON. Framing: AS-INTENDED.
> Deep-dive thread: read `dashboard-v2/dashboard.js` (PV view, `refreshPVData`, Solax queries).

## Purpose

Provide a web dashboard view that visualizes school energy/PV data — produced power,
purchased (grid) power, battery charge and discharge — with per-day historical viewing.
Served at `vm23.htl-leonding.ac.at/dashboard/` (PV view).

## Requirements

### Requirement: PV Energy Display
The system SHALL display PV/energy data: produced power, purchased power, battery output, and battery input.

#### Scenario: User opens PV view
- WHEN a user switches to the PV view
- THEN produced, purchased, battery-in and battery-out values are shown for the selected day

### Requirement: Day-Based Energy History
The system SHALL allow viewing energy values per day with day navigation.

#### Scenario: Navigate to a past day
- WHEN a user picks a previous date
- THEN the energy charts and cards show that day's data in school-local timezone (Europe/Vienna)

## Implementation Gap (AS-INTENDED vs current code)

- PV refresh: intent configurable default 10s; code polls every 30s (`dashboard.js:814`) / kiosk 5min. → change proposal.
- "no polling in scope" (FSD assumption) contradicts PV polling design — FSD assumption should be revised.

## TODO (per-thread deep-dive)

- [ ] Document `solax_stats` measurement + fields (`daily_yield`, `consumption`, `daily_imported`, `daily_exported`, `daily_charged`)
- [ ] Document Flux hourly-aggregation queries + CET/CEST day-range handling
- [ ] Document DE/EN PV labels and cumulative-kWh display rules
- [ ] Relationship to [solax-collector] (data source)
