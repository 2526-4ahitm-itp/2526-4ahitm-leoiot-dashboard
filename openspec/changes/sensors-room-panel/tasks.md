# Tasks

## 1. Spec

- [ ] 1.1 Merge this change before code relies on it; verify `openspec validate sensors-room-panel --strict` passes and `ci-ok` is green on its pull request

## 2. Logic (`leoiot-sensors/dashboard/src/core/`)

- [ ] 2.1 Add the two-state lamps for temperature (19.0 to 25.0 °C) and humidity (40 to 70 %), compared on the shown rounded value, as pure functions with the direction; verify unit tests for 18.9, 19.0, 25.0, 25.1 °C, 39, 40, 70, 71 % and unknown values
- [ ] 2.2 Extend the room view so that outdated readings switch off all three lamps; verify with view tests for live, outdated and no-CO₂ states
- [ ] 2.3 Add the day summary from today's five-minute windows (Europe/Vienna midnight): time above 1000 ppm and the last airing (latest fall of at least 200 ppm within fifteen minutes); verify unit tests for the "school day" and "early morning" scenarios, a day change in summer and in winter time, and gaps in the series
- [ ] 2.4 Add the peak query (`max()` of `co2` since local midnight for room and source, with its time) and its parser; verify a query-text test and a CSV fixture test

## 3. Page (`leoiot-sensors/dashboard/`)

- [ ] 3.1 Replace the room number and the device line by the identity line ("Raum 105" / "Room 105" as `<h1>`, "Im Gebäude zeigen", "simuliert" pill only for simulated readings); verify render tests for 105 measured, E10 simulated and English
- [ ] 3.2 Add the small lamps, the direction words and the value colours to the temperature and humidity cells, with a fixed cell height; verify render tests for each state and that the CO₂ status sentence is unaffected
- [ ] 3.3 Add the "Heute" column with its three pairs, the estimate caption and the empty and outdated states; load the peak query with the history once a minute; verify app tests with the recorded answers and the fake clock
- [ ] 3.4 Add the German and English texts (direction words, summary labels, estimate caption, empty texts) and remove the unused ones ("gemessen", device texts); verify the i18n key test passes
- [ ] 3.5 Lay out the panel as housing, state and Heute column, moving the Heute block below the cells under 1100 px and stacking it under 640 px; check light and dark at 1440, 1100 and 360 pixels in the browser against a local stack and verify no horizontal scrolling

## 4. Docs and release

- [ ] 4.1 Update `leoiot-sensors/PRODUCT.md` (ranges and source, box LED shows CO₂ only), `leoiot-sensors/DESIGN.md` (hierarchy, colour rule, new components, no display style) and the FIRST VIEWPORT of `leoiot-sensors/.impeccable/surfaces/dashboard.md`; verify the documents match the built page
- [ ] 4.2 Run `npm ci && npm test && npm run build` and `.github/ci/image-build.sh leoiot-sensors/dashboard`; open the pull request and verify `ci-ok` is green
- [ ] 4.3 After the next promotion to `release`, check room 105 on vm23 in the browser: identity line, lamps and Heute column with real data
