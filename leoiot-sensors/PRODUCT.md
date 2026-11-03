# Product

<!-- impeccable:product-schema 1 -->

Scope: the sensors part of LeoIoT (`leoiot-sensors/`): the room-climate dashboard and, later, the sensor overview. The PV dashboards and the 3D model are separate products with their own records. Confirmed by Elias Pointinger on 2026-10-22.

## Platform

web

## Stack

TypeScript, Vite and Vitest; charts with Apache ECharts 6. Chosen by Elias Pointinger on 2026-10-22 instead of Java/Quarkus. Like the other sub-projects it runs as a container on the school VM (vm23) behind the host's nginx.

## Users

Everyone at HTL Leonding, with no single primary group (confirmed 2026-10-22):

- **Students and teachers** seeing whether the air in a classroom is still good or the room needs airing; classrooms hold up to 30 people and CO₂ rises fast with closed windows.
- **Caretakers (Schulwarte)** checking room temperatures, for example to notice windows left open, and noticing sensors that stopped sending.
- **School management** looking at how air quality and temperature develop in the rooms over days and months.

Secondary: visitors and partner organisations, for whom the school shows what it measures.

## Product Purpose

Make the indoor climate of the school's rooms visible: CO₂, temperature and humidity per room, live and as history, so that people air rooms when it is needed and notice problems (windows left open, failed sensors). Success: anyone at the school opens the dashboard without training, finds a room and sees within seconds whether its air is fine and how current the values are.

## Positioning

The values come from the school's own sensors in its own rooms, collected continuously and stored for at least 13 months. Measured and simulated readings are always told apart; the dashboard never presents a generated value as a measurement.

## Operating Context

- Opened in a browser on school desktops and laptops, without login, inside the school network.
- German and English user interface.
- Today one real sensor box delivers measurements: `nili3` in room 105 (CO₂, temperature, humidity). All other rooms are fed with generated values by a simulator, marked `source = simulated`.
- Room ids are the names on the door signs (`105`, `E10`, `UBiolab`, …), shown exactly as written there.
- Times are shown in the school's local time zone (Europe/Vienna).

## Capabilities and Constraints

- **Values per room:** CO₂ in ppm, temperature in °C, relative humidity in %.
- **CO₂ traffic light:** green below 800 ppm, yellow from 800 to 1000 ppm, red above 1000 ppm (confirmed 2026-10-22; the docs site, the slides and the project proposal's 1000 ppm warning agree; the functional specification's 600/1200 is superseded).
- **Freshness:** a value older than 5 minutes is shown as outdated with a warning (functional specification FR-08).
- **History:** selectable dates and time ranges; readings are kept for at least 13 months, so a month can be compared with the same month a year before.
- **Data sources:** only the room-climate interfaces of `openspec/specs/platform/data-contract/`: measurement `room_climate` in InfluxDB for history, retained messages on `leoiot/room-climate/<room>` read anonymously over MQTT over WebSocket at `/mqtt` for live values. Legacy measurements and topics are never read.
- **Devices:** desktop first; phone and tablet layouts follow in a later release (confirmed 2026-10-22).
- **No control:** viewing and monitoring only; no building automation, no opening or closing of windows.
- **Undecided:** the URL path of the dashboard; whether the first release covers only room 105 or all rooms; the sensor overview's layout.

## Evidence on Hand

- Real measurements from `nili3` in room 105 once the sensors collector writes `room_climate`; no history in `room_climate` exists before that.
- Requirements: `docs/functional-specification.md`, the project page of the docs site (`src/content/docs/en/docs/project.md`), the project proposal (`asciidocs/docs/Projektantrag.adoc`).
- No user research, quotes or usage figures exist; none may be invented.

## Product Principles

1. **Air quality at a glance.** Whether a room needs airing is readable in seconds by someone without technical knowledge.
2. **Honest data.** Every value shows how current it is; outdated, missing and simulated readings are marked, never hidden or shown as zero.
3. **The school's own measurements.** Only data from the platform contract, with the same definitions everywhere the values appear.
4. **Viewing, not controlling.** The dashboard informs; it never acts on the building.
