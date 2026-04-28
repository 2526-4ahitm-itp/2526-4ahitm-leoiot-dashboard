# Implementation Plan

## 1. Project Summary

LeoIOT is a school-focused monitoring system that visualizes room climate data (CO2, temperature) and PV/energy flow data in dashboards plus a clickable 3D building model. Core scope includes WebSocket-based live updates, sensor status/warnings, date/time filtering in school-local timezone, bilingual UI (German/English), and robust handling of invalid routes and invalid room requests.

## 2. Implementation Strategy

- **Overall approach**
  - Build a modular web app with separate layers for data ingestion, business logic, and UI.
  - Deliver all **Must (FR-01 to FR-08)** requirements first, then **Should (FR-09 to FR-11)**, then **Could (FR-12 to FR-13)**.
  - Use incremental integration: dashboards first, then 3D model, then WebSocket live flow + sensor freshness/warnings and edge-case hardening.
- **Suggested order of development**
  1. Project setup and architecture baseline
  2. Data model and API/data service integration
  3. Climate dashboard + room selection
  4. Energy dashboard
  5. 3D model room-click flow
  6. WebSocket live update and sensor freshness logic
  7. Date/time filtering, validation, and error handling
  8. Bilingual support, testing, documentation, and release prep

## 3. Work Packages

### WP-01: Project Foundation

- **Goal**
  - Create a stable project skeleton and development workflow.
- **Tasks**
  - Initialize frontend/backend structure (or monorepo modules).
  - Define coding standards, folder conventions, and config management.
  - Set up environment variables for sensor/PV data source endpoints.
  - Add language resource structure for German and English.
  - Create CI basics (lint/test/build).
- **Dependencies**
  - Access to repository and deployment environment.
- **Deliverables**
  - Running baseline app, CI checks, README setup instructions.

### WP-02: Data Contracts and Integration Layer

- **Goal**
  - Standardize incoming sensor/PV data for consistent use in UI.
- **Tasks**
  - Define internal data models for rooms, sensors, climate metrics, energy metrics.
  - Build adapter/services for real upstream API data sources.
  - Implement normalization (units, timestamps, missing fields).
  - Ensure room identifier mapping is identical between data and 3D model.
  - Apply school-local timezone handling for display/filtering.
  - Add stale-data tracking timestamp per sensor.
- **Dependencies**
  - Real sensor/PV API endpoints.
- **Deliverables**
  - Data integration module + mock fixtures + schema documentation.

### WP-03: Climate Dashboard (FR-01, FR-04)

- **Goal**
  - Provide room-based CO2/temperature visualization in dashboard form.
- **Tasks**
  - Build room list/selector UI.
  - Implement room detail panel with current CO2 and temperature.
  - Add visual state mapping for CO2 thresholds (green/yellow/red).
  - Ensure clear navigation and visible controls (FR-11).
- **Dependencies**
  - WP-02 data contracts.
- **Deliverables**
  - Functional climate dashboard with room selection.

### WP-04: Energy Dashboard (FR-03)

- **Goal**
  - Display PV and school energy flow values.
- **Tasks**
  - Implement widgets/charts for produced, purchased, battery-in, battery-out.
  - Add day-based view baseline and prepare for time filtering.
  - Handle unavailable data gracefully with status labels.
- **Dependencies**
  - WP-02 data integration.
- **Deliverables**
  - Functional energy dashboard with required metrics.

### WP-05: 3D Model Interaction (FR-02)

- **Goal**
  - Enable room click in 3D model and show room climate values.
- **Tasks**
  - Integrate 3D model asset loading and room ID mapping.
  - Implement click-to-select room behavior.
  - Link 3D room selection to same room detail logic used by dashboard.
  - Add fallback UI for model load delay/failure.
- **Dependencies**
  - WP-03 room detail logic; 3D assets and room mapping.
- **Deliverables**
  - Interactive 3D room inspection flow.

### WP-06: WebSocket Live Refresh and Sensor Freshness (FR-05, FR-08, FR-09)

- **Goal**
  - Keep views updated and mark stale sensors after 5 minutes.
- **Tasks**
  - Implement refresh mechanism using WebSockets only (no polling).
  - Add configurable update interval with default of 10 seconds.
  - Track last-seen timestamp; show warning icon if >5 minutes.
  - Ensure updates affect climate dashboard, energy dashboard, and 3D view.
- **Dependencies**
  - WebSocket endpoint availability; WP-02.
- **Deliverables**
  - Live update engine + sensor warning indicators.

### WP-07: Date/Time Filtering and Validation (FR-10, business rules)

- **Goal**
  - Support historical filtering and robust invalid input handling.
- **Tasks**
  - Add date/time selectors with validation constraints.
  - Implement backend/service query filters for historical data.
  - Enforce invalid room behavior with "No data for room" message and invalid URL redirect to main page.
  - Define consistent empty/no-data state patterns.
- **Dependencies**
  - Historical data availability from WP-02.
- **Deliverables**
  - Working historical filter feature + validation/redirect logic.

### WP-08: Quality, Testing, and Documentation

- **Goal**
  - Verify acceptance criteria and prepare handover.
- **Tasks**
  - Execute test plan (functional + edge + usability).
  - Fix defects and verify regression.
  - Validate bilingual UI content (German and English).
  - Document architecture, deployment, known limitations, and user guide.
  - Prepare acceptance checklist mapped to AC-01..AC-13.
- **Dependencies**
  - Completion of WP-01..WP-07.
- **Deliverables**
  - Test report, user/admin docs, acceptance checklist, release candidate.

## 4. Suggested Development Phases

### Phase 1: Foundations and Core Dashboards (High Priority)

- WP-01, WP-02, WP-03, WP-04
- Outcome: both dashboards functional with baseline data flow.

### Phase 2: 3D Integration and WebSocket Live Behavior (High Priority)

- WP-05, WP-06
- Outcome: clickable 3D room view + WebSocket updates + stale warnings.

### Phase 3: Historical Features, i18n, Hardening, and Acceptance (Medium Priority)

- WP-07, WP-08
- Outcome: date/time filtering, bilingual UI, edge handling, full testing, and documentation.

### Phase 4: Optional Enhancements (Low Priority)

- Implement FR-12 and FR-13 as time permits.

## 5. Technical Considerations

- **Architecture assumptions**
  - Modular frontend with reusable room-detail component for dashboard + 3D contexts.
  - Data service abstraction to decouple UI from upstream source changes.
- **Data handling**
  - Normalize timestamps and units at ingestion.
  - Use school-local timezone consistently for query/display.
  - Preserve latest value and historical records for filtering.
  - Maintain `last_seen` metadata for stale detection.
- **Validation**
  - Validate room IDs before rendering details.
  - Validate date/time range inputs (start <= end, available range checks).
  - Redirect unknown routes to main page.
- **UI considerations**
  - Clear navigation between climate and energy views.
  - Language switch and complete translations for German and English.
  - Explicit visual legend for CO2 colors.
  - Loading and empty states for dashboards and 3D model.
- **Error handling**
  - Distinguish loading failure, no data, stale data, and invalid input states.
  - Keep partial functionality available when one data source fails.

## 6. Testing Plan

- **Functional tests**
  - Verify FR-01..FR-08 as mandatory pass gates.
  - Verify FR-09..FR-11 as target pass gates.
  - Validate CO2 threshold color boundaries and 5-minute warning behavior.
  - Validate invalid room response shows "No data for room".
  - Validate WebSocket updates are visible in 3D room view and dashboards.
  - Validate PV values are visible and update.
- **Edge case tests**
  - Missing sensor updates, dropped WebSocket connection, malformed payloads.
  - Invalid room selection and invalid URL redirect behavior.
  - Empty historical range and partial source outage scenarios.
- **Usability checks**
  - Teacher/facility-manager walkthrough for key use cases.
  - Confirm primary actions are discoverable without explanation.
  - Confirm German and English labels/messages are understandable.
  - Check readability of status indicators and warning symbols.

## 7. Risks and Open Issues

- **Risks**
  - Unstable upstream sensor/PV data quality or outages.
  - WebSocket disconnect/reconnect behavior may cause stale UI if not handled.
  - 3D model performance issues on lower-end school hardware.
  - Ambiguity in “smooth performance” target without numeric benchmark.
- **Open questions**
  - Exact historical retention period (months/years) beyond a few weeks.
  - Exact performance targets (max initial load time, acceptable frame rate).
- **Missing information from the FSD**
  - Exact API contracts.
  - Historical retention period and storage limits.
  - Concrete browser support matrix for "multiple browsers".

## 8. Optional Enhancements

- Add explicit sensor active/inactive status panel (FR-12).
- Add configurable critical alerts for low temperature and high CO2 (FR-13).
- Add trend charts and comparison views (e.g., room-to-room, day-over-day), if still within approved scope.
- Add mobile/tablet support after desktop release.
