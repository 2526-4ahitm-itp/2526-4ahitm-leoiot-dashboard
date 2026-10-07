---
title: Project
description: Background, goals, solution, requirements, team, milestones and sprint reviews of LeoIoT.
sidebar:
  order: 5
---

## Background and problem

HTL Leonding wants to become a sustainable school. The PV (solar power) system produces electricity for the school. However, the data is only available in the manufacturer portal (Solax Cloud; Solax is the manufacturer of the inverter). Students and teachers cannot see it. Classrooms hold up to 30 people; with closed windows the CO₂ level rises sharply, causing fatigue and poor concentration. Nobody can see when ventilation is needed.

The problem in detail:

- Data on energy and indoor air is scattered or missing.
- There is no central, understandable overview for everyday school life.
- Caretakers cannot see the room temperature, so windows left open go unnoticed.
- Sensor failures go unnoticed.

## Goals

- Make room climate and energy data of the school transparent.
- Show room-level values in the dashboard and in the 3D model.
- Show day-based history.
- Raise awareness of air quality and energy use.

Out of scope: automatically opening/closing windows or doors and other building automation.

## Solution

- **PV dashboard:** generation, grid consumption, battery charge and discharge; day view with date picker; kiosk display (full-screen display without interaction) for screens in the school building.
- **Sensor dashboard:** CO₂ and temperature per room; CO₂ traffic light (ppm = parts of CO₂ per million parts of air; green below 800 ppm, yellow 800 to 1000 ppm, red above 1000 ppm; the thresholds come from the slides, the 1000 ppm warning threshold also from the project proposal; they are project guideline values); time of the last measurement per sensor.
- **3D model:** clicking a room shows the current values; live updates via WebSocket; navigation to rooms and the gym.

Everything runs in the browser, without login, in German and English. It is hosted on the school VM and published automatically via GitHub Actions (deployment).

Note on the data: as of today, one real sensor box delivers measurements (room 105); all other rooms are fed with test values by a simulator (`fake-sensors`).

## Requirements

From the functional specification (must-have requirements; FR-01 means requirement no. 1):

- Show CO₂ and temperature per room in the dashboard, with room selection (FR-01, FR-04).
- Show CO₂ and temperature when a room is clicked in the 3D model (FR-02).
- Show PV/energy data: production, grid consumption, battery output and input (FR-03).
- Live updates via WebSocket (FR-05).
- Sensor overview listing all sensors (FR-06).
- Warning symbol if a sensor has delivered no data for 5 minutes (FR-08).
- “No data for room” message for an invalid room (FR-14).

Should/could: configurable update interval with 10 seconds as default (FR-09), history for selectable days and time ranges (FR-10), clearly visible navigation (FR-11), “active/inactive” status (FR-12), additional alerts such as room temperature below 10 °C (FR-13).

Non-functional: no authentication, operation in the school environment, multiple modern browsers, the school’s local time zone, failure of one sensor must not affect the others.

From the project proposal (acceptance criteria; the proposal gives the class as 4AHITM, school year 2025/26): dashboard reachable in the school network via browser; PV data (kWh, saved CO₂) updated periodically; room climate data displayed; warning threshold at CO₂ above 1000 ppm visible. The proposal names MQTT, InfluxDB and Grafana as technologies. The client is Professor Thomas Stütz; a documented, maintainable dashboard was planned for the end of June 2026.

## Team

| Area | People |
| --- | --- |
| Sensors | Elias Pointinger (project lead) |
| PV dashboard | Daniel Lettner, Stefan Schachner |
| 3D model | Paul Kreinecker, Jonas Leitner |

## Current state

State of the slides ([to the slides, German only](../../../slides/)) dated 5 October 2026:

- PV dashboard with day view and kiosk displays
- Room climate with CO₂ traffic light
- 3D model with live CO₂ and room navigation
- Mobile view, German/English
- Deployment on the school VM with HTTPS
- Continuous deployment and database backups

## Milestones

The slides name these next milestones:

1. Improve the 3D model
2. Connect more classrooms
3. Warning on critical values

## Sprint reviews

As of 28 April 2026. The review of 28 April 2026 is the documented one; later reviews are not available. Criticism and requests:

- **Sensor dashboard:** scale, axis labels, time axis for one day (00:00–23:59), kiosk system, skipping days with left/right arrows.
- **PV dashboard:** scale, battery level, units (kWh, kW), label for “Lifetime Total”, current solar power, breakdown of generation, consumption and battery, German/English switch.
- **3D model:** navigation with points (e.g. in front of doors, at stairs and junctions), shortest path via Dijkstra’s algorithm (a method for finding the shortest path), navigation to the gym.
- **Other:** formulate user stories completely and consistently (acceptance criteria, tasks).

To do from the review of 28 April 2026 (as of 28 April 2026): kiosk mode, PV displays, fix navigation, scales and units, arrows for skipping days, DB backup.

## Sources in the repository

- `src/slides/slides.html` (slides), `asciidocs/slides/leoiot.adoc` (earlier version)
- `asciidocs/docs/Projektantrag.adoc`
- `docs/functional-specification.md`
- `openspec/specs/dashboard-sensors/spec.md`, `openspec/specs/dashboard-pv/spec.md`
- `asciidocs/docs/sprint-reviews/review-28-04-2026.md`
- `CHANGELOG.md`
