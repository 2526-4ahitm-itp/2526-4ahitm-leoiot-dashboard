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
- WebSocket-based live updates for dashboards and 3D room view
- Configurable auto-refresh interval (default target: 10 seconds)
- Bilingual user interface (German and English)
- Desktop support in initial release

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
- **FR-05 (Must):** The system shall receive and apply live updates via WebSockets when sensor data is available.
- **FR-06 (Must):** The system shall provide a sensor overview listing all sensors.
- **FR-07 (Must):** The system shall show CO2 status colors using thresholds:
  - Green: CO2 < 600 ppm
  - Yellow: CO2 >= 600 ppm and <= 1200 ppm
  - Red: CO2 > 1200 ppm
- **FR-08 (Must):** The system shall show a warning symbol for a sensor if no data has been received for 5 minutes.
- **FR-09 (Should):** The system shall allow a configurable update interval, with 10 seconds as the default setting.
- **FR-10 (Should):** The system shall allow users to view historical data for selected dates and time ranges, covering more than only a few weeks.
- **FR-11 (Should):** The system shall provide clear and visible navigation/actions without hidden primary controls.
- **FR-12 (Could):** The system could provide explicit “sensor active/inactive” status indicators.
- **FR-13 (Could):** The system could show additional alerts for critical conditions (e.g., very low room temperature below 10°C).
- **FR-14 (Must):** If a user selects or requests an invalid room, the system shall display a "No data for room" message.

## 6. Non-Functional Requirements

- **Usability**
  - UI shall be intuitive and easy to understand for non-technical school users.
  - Main actions (room selection, dashboard switching) shall be discoverable without training.
- **Performance**
  - Data updates should be reflected based on the configured interval (default: 10 seconds).
  - Initial 3D model load may take longer due to asset loading; after load, interaction should remain smooth.
- **Reliability**
  - If one sensor fails, the system shall continue showing data from other sensors.
  - Stale data conditions shall be clearly indicated.
- **Maintainability**
  - Data visualization modules (energy dashboard, room dashboard, 3D model) should be separated for easier updates.
- **Constraints**
  - The system shall run on the school server environment.
  - Data shall be provided by real sensor and PV API endpoints.
  - No login/authentication is required in the initial release.
  - Initial release targets desktop; mobile/tablet support is planned for later.
  - The system should support multiple modern browsers.
  - The system shall use the school's local timezone for data display/filtering.

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
  - Timestamps for display and filtering must use school-local timezone.

## 8. Business Rules / Logic

- **Validation rules**
  - Invalid room selections shall show a "No data for room" message.
  - Invalid routes/URLs shall redirect the user to the main page.
- **Permissions**
  - No role-based permission model is currently defined.
- **Process rules**
  - Users select either climate or energy view.
  - In climate context, users can inspect rooms via dashboard or 3D model.
  - Sensor freshness is continuously evaluated against the 5-minute rule.

## 9. Error Handling / Edge Cases

- Invalid room input/selection: system does not navigate to a room page.
- Invalid room input/selection: system shows a "No data for room" message.
- Invalid URL/action: system redirects to main page.
- Missing/stale sensor data: warning indicator displayed after 5 minutes without updates.

## 10. Assumptions and Dependencies

- **Technical assumptions**
  - Live updates are implemented using WebSockets (no polling mode in scope).
  - Sensor and PV data are provided by real API endpoints.
  - Sensor data and 3D model rooms share the same room identifier.
- **Organizational assumptions**
  - School provides operational ownership for dashboard monitoring.
  - Required sensor infrastructure is already installed and mapped to rooms.
- **Dependencies**
  - Sensor network availability
  - PV/energy data source availability
  - School server hosting for the application
  - 3D model assets and room mapping data

## 11. Acceptance Criteria

- AC-01: User can open climate dashboard and see CO2/temperature values per room.
- AC-02: User can click any configured room in the 3D model and see corresponding CO2/temperature.
- AC-03: User can open energy dashboard and view produced, purchased, battery in, and battery out values.
- AC-04: CO2 colors render correctly at threshold boundaries (<600 green, 600–1200 yellow, >1200 red).
- AC-05: If a sensor sends no data for 5 minutes, a warning symbol appears.
- AC-06: Displayed values update via WebSockets according to a configurable interval (default 10 seconds).
- AC-07: User can select historical date/time views where data is available, with retention beyond only a few weeks.
- AC-08: Invalid URL access redirects to main page.
- AC-09: System does not crash when one sensor is unavailable; remaining data remains accessible.
- AC-10: Initial 3D load can be slower, but post-load interaction is smooth for normal use.
- AC-11: Invalid room requests show a "No data for room" message.
- AC-12: UI can be displayed in German and English.
- AC-13: Demo-critical flow works end-to-end: live room updates in 3D while viewing/subscribed, climate dashboard sensor values visible, and PV values visible.

## 12. Open Questions

- What exact historical data retention period should be required (e.g., 3 months, 6 months, 12 months)?
- What are the precise performance targets (e.g., maximum initial 3D load time and acceptable frame rate)?
