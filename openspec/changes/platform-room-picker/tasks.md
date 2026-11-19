# Tasks

## 1. Contract

- [x] 1.1 Merge this change on its own before any code relies on it; verify `openspec validate platform-room-picker --strict` passes and `ci-ok` is green on its pull request

## 2. Collector: expiry (`leoiot-sensors/collector/`)

- [x] 2.1 Connect to the broker with MQTT 5 (`protocolVersion: 5`) and publish every live message with `messageExpiryInterval` 2 592 000; verify with a unit test on the publish options in `tests/` and `npm test`
- [x] 2.2 Check that subscriptions to the device topics and the handling of retained device messages are unchanged under MQTT 5; verify with the integration tests (`vitest.integration.config.ts`) against the local stack
- [x] 2.3 Add an integration test that a published live message reaches an MQTT 5 subscriber with the expiry property set; verify it passes against the local Mosquitto 2.1.2
- [x] 2.4 Run `npm ci && npm test && npm run build` and `.github/ci/image-build.sh leoiot-sensors/collector`; open the pull request and verify `ci-ok` is green

## 3. Dashboard: room list (`leoiot-sensors/dashboard/`)

- [x] 3.1 Add the floor rule (first character → floor, natural order of room ids within a floor) as a pure function in `src/core/`; verify with unit tests for `105`, `1Aula`, `E10`, `U74.1`, `T2`/`T10` and `X99`
- [x] 3.2 Add a room-list state from live messages of `leoiot/room-climate/#` (newest `ts` per room, empty retained message removes the room, air state and age by the room page's rules); verify with unit tests on fixture messages
- [x] 3.3 Add the database fallback: one Flux query for the last value per room and field over 30 days, used once a minute while `/mqtt` is unreachable; verify with a unit test of the query text and a CSV fixture
- [x] 3.4 Let `src/main.ts` start the room list when the address has no `room`, and the room page otherwise; verify with a test in `tests/app.test.ts` that `/sensors/` renders the list and `?room=105` the room page
- [x] 3.5 Render the room list in `index.html`: floor headings, one link per room with room id, air state as text and lamp colour, CO₂ value or dash, simulated marking, outdated marking, and the "no room is sending" text; verify with `tests/render.test.ts` cases for each state
- [x] 3.6 Add German and English texts for the list, floor names (Untergeschoss / Basement, Erdgeschoss / Ground floor, 1. Stock / Floor 1, 2. Stock / Floor 2, Turnsaal / Gym, Weitere Räume / Other rooms), "Alle Räume" and "Im Gebäude zeigen"; replace the "sendet wieder" sentence of `noDataText`; verify the i18n key test passes

## 4. Dashboard: room choice, no-data page and link

- [x] 4.1 Replace the header crumb with a `<select>` grouped by floor (rooms of the list plus the shown room) and a link "Alle Räume"; changing it navigates to `?room=<id>`; verify with a test that choosing `E10` sets the location and that the shown room is selected even without data
- [x] 4.2 Show the room list below "Keine Daten für Raum …" on the no-data page; verify with a render test for `?room=X99`
- [x] 4.3 Add the link "Im Gebäude zeigen" to `/3d/?room=<id>` on the room page for rooms of a known floor; verify with render tests for `105` (link) and `X99` (none)
- [x] 4.4 Check the list and the room page at 1280 and 360 pixels width, light and dark, in the browser; verify no horizontal scrolling and attach screenshots to the pull request
- [x] 4.5 Update `leoiot-sensors/README.md` and the "Undecided" line of `leoiot-sensors/PRODUCT.md` (the dashboard covers all rooms with data); verify the docs mention `/sensors/` as the room list
- [x] 4.6 Run `npm ci && npm test && npm run build` and `.github/ci/image-build.sh leoiot-sensors/dashboard`; open the pull request and verify `ci-ok` is green

## 5. 3D explorer and temporary simulator (`leoiot-3d/`, by or with the 3D team)

- [ ] 5.1 Read `?room=` once after the model has loaded and select that room as if clicked (floor shown, panel open); show the "room cannot be found" message for an unknown room; verify with unit tests for `153`, `U74.1` and `X99`
- [ ] 5.2 Add the link "Show history" to `/sensors/?room=<id>` in the info panel when a live message for the room has been received; verify with tests for a room with and without a message
- [ ] 5.3 Publish the temporary simulator's messages over MQTT 5 with the same expiry, and note in its README that `--clear` also empties rooms with real devices until their next reading; verify with its tests (`npm test`)
- [ ] 5.4 Run the explorer's and the simulator's checks as listed in `AGENTS.md`; open the pull request and verify `ci-ok` is green

## 6. Release and check on vm23

- [ ] 6.1 Ship steps 2 to 5 through a promotion pull request `main` → `release` when Elias asks; verify the deploy run's smoke routes pass (Steps 2 to 4 shipped with the promotion #169 on 2026-11-19, smoke routes passed; step 5 follows.)
- [x] 6.2 On vm23, verify with an MQTT 5 subscriber that room 105's retained message carries an expiry interval of about 2 592 000 s
- [ ] 6.3 In the browser, verify that `/sensors/` lists room 105 under floor 1, that the header choice and "Alle Räume" work, that `/sensors/?room=X99` shows the list, and that "Im Gebäude zeigen" and "Show history" lead to each other for room 105 (The sensors part was verified on vm23 on 2026-11-19; "Show history" follows with step 5.)
