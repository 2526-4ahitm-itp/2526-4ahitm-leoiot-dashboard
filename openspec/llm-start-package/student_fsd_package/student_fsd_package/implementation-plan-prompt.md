# Prompt: Aus der FSD einen Implementierungsplan erzeugen

Kopiere den folgenden Prompt in Codex und ersetze den Platzhalter durch die fertige Functional Specification Document in Markdown.

```text
You are a senior software engineer and project planner.

Your task is to read the following Functional Specification Document written in Markdown and produce a detailed implementation plan in English.

Important instructions:
- Output valid Markdown only.
- Base the plan strictly on the FSD.
- Do not introduce features that are outside the documented scope.
- If something is unclear, identify it as a risk, dependency, or open question.
- Make the plan realistic for a student or school project unless the FSD clearly requires something more advanced.
- Organize the implementation into logical phases.
- Include technical tasks, functional tasks, testing tasks, and documentation tasks.
- Highlight dependencies and priorities.
- Distinguish between essential work and optional enhancements.

Use the following structure:

# Implementation Plan

## 1. Project Summary
- Brief summary of the system to be built

## 2. Implementation Strategy
- Overall approach
- Suggested order of development

## 3. Work Packages
For each work package include:
- Title
- Goal
- Tasks
- Dependencies
- Deliverables

## 4. Suggested Development Phases
### Phase 1
### Phase 2
### Phase 3
...

## 5. Technical Considerations
- Architecture assumptions
- Data handling
- Validation
- UI considerations
- Error handling

## 6. Testing Plan
- Functional tests
- Edge case tests
- Usability checks

## 7. Risks and Open Issues
- Risks
- Open questions
- Missing information from the FSD

## 8. Optional Enhancements
- Clearly separated from the core implementation

Functional Specification Document:
# Functional Specification Document

## 1. Project Overview

- **Project title:** LeoIOT  
- **Short description:** LeoIOT is a school dashboard solution that visualizes sensor and energy data in an understandable way. It includes:
  - A dashboard for PV/energy data (produced power, purchased power, battery in/out flows)
  - A dashboard for room climate data (CO2 and temperature)
  - A 3D school model where users can click a room to view its current values
- **Background / current situation:** Sensor and energy data exist but are not easily readable for daily school use. Important information (air quality, energy generation/consumption) is hard to monitor quickly.
- **Problem statement:** The school needs a clear, centralized, and practical visualization of live sensor and energy data for operational and educational use.
- **Project goals:**
  - Make room climate and school energy data transparent
  - Provide room-level visibility in both dashboard and 3D model views
  - Support day-based historical viewing/filtering
  - Improve awareness of air quality and energy usage

## 2. Scope

### In Scope
- Visualization of CO2 and temperature per room
- Visualization of PV and school energy flow data
- 3D model with clickable rooms and room-specific values
- Sensor overview with status/warning indicators
- Period/date-based data display (e.g., previous date and time windows)
- Auto-refresh of displayed values (target every 10 seconds)

### Out of Scope
- Automatic opening/closing of windows or doors
- Building automation control actions
- Any functionality not directly related to viewing/monitoring sensor and energy data

## 3. Users and Stakeholders

- **Primary users:**
  - Principal/School management
  - Facility managers (Schulwarte)
- **Secondary users:**
  - Teachers
  - Students
- **Stakeholders:**
  - School administration
  - Facility operations
  - Teaching staff
  - Students as information consumers

## 4. Use Cases / User Scenarios

1. **Room climate monitoring**
   - A user opens the climate dashboard, selects a room, and checks current CO2 and temperature.
2. **3D model room inspection**
   - A user clicks a room in the 3D model and sees the room’s CO2 and temperature values.
3. **Energy monitoring**
   - A user opens the PV dashboard and reviews produced energy, purchased energy, battery discharge, and battery charge values per day.
4. **Sensor health check**
   - A user checks the sensor overview and identifies stale/offline sensors through warning indicators.

## 5. Functional Requirements

- **FR-01 (Must):** The system shall display room CO2 and temperature values on a dashboard.
- **FR-02 (Must):** The system shall display room CO2 and temperature values when a room is clicked in the 3D model.
- **FR-03 (Must):** The system shall display PV/energy data including produced power, purchased power, battery output, and battery input.
- **FR-04 (Must):** The system shall provide a room selection mechanism in the dashboard to view room-specific values.
- **FR-05 (Must):** The system shall refresh displayed values automatically when sensor data is available.
- **FR-06 (Must):** The system shall provide a sensor overview listing all sensors.
- **FR-07 (Must):** The system shall show CO2 status colors using thresholds:
  - Green: CO2 < 600 ppm
  - Yellow: CO2 >= 600 ppm and <= 1200 ppm
  - Red: CO2 > 1200 ppm
- **FR-08 (Must):** The system shall show a warning symbol for a sensor if no data has been received for 5 minutes.
- **FR-09 (Should):** The system shall update displayed values at least every 10 seconds.
- **FR-10 (Should):** The system shall allow users to view data for selected dates and time ranges.
- **FR-11 (Should):** The system shall provide clear and visible navigation/actions without hidden primary controls.
- **FR-12 (Could):** The system could provide explicit “sensor active/inactive” status indicators.
- **FR-13 (Could):** The system could show additional alerts for critical conditions (e.g., very low room temperature below 10°C).

## 6. Non-Functional Requirements

- **Usability**
  - UI shall be intuitive and easy to understand for non-technical school users.
  - Main actions (room selection, dashboard switching) shall be discoverable without training.
- **Performance**
  - Data updates should be reflected approximately every 10 seconds.
  - Initial 3D model load may take longer due to asset loading; after load, interaction should remain smooth.
- **Reliability**
  - If one sensor fails, the system shall continue showing data from other sensors.
  - Stale data conditions shall be clearly indicated.
- **Maintainability**
  - Data visualization modules (energy dashboard, room dashboard, 3D model) should be separated for easier updates.
- **Constraints**
  - The system shall run on a server environment.
  - Data depends on external sensor and PV sources.

## 7. Data and Content

- **Inputs**
  - Sensor data (CO2, temperature)
  - Energy data from PV and related systems
- **Outputs**
  - Room-level climate values
  - Energy flow values per day/time
  - Status indicators and warnings
- **Stored data**
  - Historical sensor and energy readings for date/time-based viewing
- **Data rules**
  - CO2 thresholds for color coding must follow FR-07.
  - Missing sensor updates beyond 5 minutes must trigger a warning indicator.

## 8. Business Rules / Logic

- **Validation rules**
  - Invalid room selections shall not open a room details view.
  - Invalid routes/URLs shall redirect the user to the main page.
- **Permissions**
  - No role-based permission model is currently defined.
- **Process rules**
  - Users select either climate or energy view.
  - In climate context, users can inspect rooms via dashboard or 3D model.
  - Sensor freshness is continuously evaluated against the 5-minute rule.

## 9. Error Handling / Edge Cases

- Invalid room input/selection: system does not navigate to a room page.
- Invalid URL/action: system redirects to main page.
- Missing/stale sensor data: warning indicator displayed after 5 minutes without updates.
- Temporary data source outage: last known values may be shown with clear stale warning (assumption).

## 10. Assumptions and Dependencies

- **Technical assumptions**
  - Live updates are expected to be implemented using WebSockets (open decision).
  - Sensor and PV data are available via reliable upstream interfaces.
- **Organizational assumptions**
  - School provides operational ownership for dashboard monitoring.
  - Required sensor infrastructure is already installed and mapped to rooms.
- **Dependencies**
  - Sensor network availability
  - PV/energy data source availability
  - Server hosting for the application
  - 3D model assets and room mapping data

## 11. Acceptance Criteria

- AC-01: User can open climate dashboard and see CO2/temperature values per room.
- AC-02: User can click any configured room in the 3D model and see corresponding CO2/temperature.
- AC-03: User can open energy dashboard and view produced, purchased, battery in, and battery out values.
- AC-04: CO2 colors render correctly at threshold boundaries (<600 green, 600–1200 yellow, >1200 red).
- AC-05: If a sensor sends no data for 5 minutes, a warning symbol appears.
- AC-06: Displayed values refresh automatically on a recurring cycle (target 10 seconds).
- AC-07: User can select historical date/time views where data is available.
- AC-08: Invalid URL access redirects to main page.
- AC-09: System does not crash when one sensor is unavailable; remaining data remains accessible.
- AC-10: Initial 3D load can be slower, but post-load interaction is smooth for normal use.

## 12. Open Questions

- What exact real-time transport will be used for live updates in the 3D model and dashboards (WebSockets is currently preferred)?
- What are the precise performance targets (e.g., maximum initial 3D load time and acceptable frame rate)?
- Should alerts for low temperature (<10°C) be mandatory or remain optional?
- Should role-based access or different views for students vs. staff be introduced later?

```
