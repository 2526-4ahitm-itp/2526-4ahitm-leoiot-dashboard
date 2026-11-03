# Tasks

Tasks marked **(human, vm23)** need `sudo` on the host and are done by Daniel. Tasks marked **(Daniel)** need his judgement of the moving picture. Reference for every still: the prototype `/home/daniel/leoiot/previews/pv-creative-kiosk/sonnenjahr.html?sun=b` (outside the repository).

## 1. Scaffold

- [x] 1.1 Create `leoiot-pv/kiosk2/` like `leoiot-pv/kiosk/`: `package.json` (`@leoiot-pv/shared` as `file:../shared`, Three.js, `@fontsource/instrument-serif`, `@fontsource/dm-mono`, Vite, TypeScript, Vitest), `vite.config.ts` with base `/kiosk2/`, `index.html`, `tsconfig.json`, `build-context` with `..`; verify `npm ci`, `npm test` and `npm run build` exit 0 and `dist/` contains no URL of a foreign host — done 2026-11-03: tests and build pass; the only URL in `dist/` is the SVG namespace string `http://www.w3.org` inside Three.js, nothing is loaded from it
- [x] 1.2 Add `Dockerfile`, `Dockerfile.dockerignore` and `nginx/kiosk2.conf.template` (port 8093, `/kiosk2` → `/kiosk2/`, `/kiosk2/api/query` POST only with the token from `KIOSK2_INFLUX_TOKEN`, `/kiosk2/ws`, `/healthz`, long cache for `/kiosk2/assets/`); verify `.github/ci/image-build.sh leoiot-pv/kiosk2` builds, `GET /kiosk2/` is 200, `GET /kiosk2` redirects, `GET /kiosk2/api/query` is 405, and with the token set to a marker value no served file contains the marker — done 2026-11-03: `/kiosk2/` 200, `/kiosk2` 301 to `/kiosk2/`, GET `/kiosk2/api/query` 405, `/healthz` 200, `/kiosk/` 404; the marker token is only in the nginx configuration, in none of the served files
- [x] 1.3 Verify the dependency rule: nothing in `kiosk2/` imports or copies from `legacy/`, another sub-project or the prototype folder; a search for the prototype path and for `legacy/` in `kiosk2/` finds nothing — done 2026-11-03: no match for `legacy/`, `previews/` or the prototype name in `kiosk2/`

## 2. Data

- [x] 2.1 Year query (10-minute windows of `daily_yield`, last 365 Vienna days) and today query; measure response time and size against the database on vm23 through the main kiosk's proxy (read only); verify both stay under 10 s and 4 MB, otherwise switch to 15-minute windows and record the numbers here — measured 2026-11-03 on vm23 through `/kiosk/api/query`: 3.2 s, 0.9 MB, 22 369 rows; data exist from 2026-04-14 on, so the film shows about 200 days for now
- [x] 2.2 Store an anonymous fixture of one real year (window values only, no tags beyond `_time`, `_value`) under `kiosk2/tests/fixtures/`; verify it contains no token, no plant id and no login — `tests/fixtures/year.csv`: only `_time` and `_value`, no token, plant id or login
- [x] 2.3 Day grid from the readings (design D3, D4): power per window from the highest value so far using `monotoneRows`/`validRows` from `shared`, missing windows and gap days, normalisation; verify tests for a step back (no dip, no spike), a day change after midnight, a missing day (gap) and a half day (ridge only for its hours) pass, and the production of three fixture days equals the dashboard's values for the same days — done 2026-11-03. Found on the real data: the cloud updates `daily_yield` only about every 20 minutes, so power is taken over 30 minutes around each window (design D3); a stepped-back reading is skipped instead of held. Production of three days compared with the day values the dashboard reads from the database (last value per Vienna day): 1010.3, 422.6 and 43.6 kWh match; the dashboard page itself was not opened
- [x] 2.4 Best day, milestones (every 10 000 kWh, not at the best day), counter from the end backwards (design D6), CO₂ (169 g/kWh, one decimal); verify tests with the spec scenarios "Counter at the end of the time-lapse", "Counter during the year", "Passing 160 000 kWh", "Collector down for two days" and "CO₂ moment" pass — done 2026-11-03

## 3. Timeline

- [x] 3.1 Implement `film(t, data)` as a pure function (design D5): drawn day, speed blend, camera, counter, months, moments, rewind, slow sections placed by day index; verify a test that the loop lasts between 90 and 110 s for fixtures with 365, 200 and 30 days — done 2026-11-03: loop 98 s for 365, 200 and 30 days
- [x] 3.2 Seam and speed tests: verify `film(LOOP − 0.1)` and `film(0.1)` show no ridge and the same date, no ridge is visible at the seam, and the point of light is hidden whenever more than two days per second pass — done 2026-11-03
- [x] 3.3 Duration test stepping through one loop at 0.05 s: verify every text is visible at least 1.5 s, each large moment at least 6 s, the closing sentence at least 3 s, each month 2 to 3 s, and record the measured list in the pull request — done 2026-11-03, measured list in the pull request
- [x] 3.4 Label test (design D7): verify no summit label is on while a nearer ridge at the same time of day rises above 82 % of the summit, and the best-day mark appears only after its ridge has full height — done 2026-11-03

## 4. Scene

- [x] 4.1 Renderer with the three shaders (sky and fog, terrain from the height texture, shadow rays) and the "Morgenglut" values of design D8; verify stills at the times of design D12 with the fixture show no plate under the mountains, no horizon line, mountains above the fog, and side by side with the prototype stills the same light and colours — done 2026-11-03 with the real fixture at the times of design D12: mountains above the fog, no plate, no horizon line, light and colours as the prototype
- [x] 4.2 Evening (design D8): verify the still at 66 s with the evening shows the next sunrise, darkened sky, fog and mountains and no edge at the horizon — done 2026-11-03: 66 s with the evening shows "Die Anlage ruht" and 06:52 Uhr, sky, fog and mountains darken together
- [x] 4.3 Resize and full screen: verify at 1280 × 720, 1920 × 1080 and 3840 × 2160 the picture fills the window, and after a size change in the browser the next frame fills it again — done 2026-11-03: canvas equals the window at 1280 × 720, 1920 × 1080 and 3840 × 2160, and after a change to 1700 × 900 at once
- [x] 4.4 Without WebGL2 the screen shows a message in words instead of a black screen; verify with a browser started with WebGL disabled — done 2026-11-03: Chromium with WebGL switched off shows "Dieser Bildschirm kann den Film nicht zeigen."

## 5. Texts

- [x] 5.1 Header (plant, date, counter, "Stand" when stored data is older than 15 minutes), months, time labels, point of light, summit labels, milestone note, large moments, CO₂ source, closing sentence, in Instrument Serif and DM Mono; verify the stills of design D12 show every text of the spec at its place and no text overlaps another at 1280 × 720 — done 2026-11-03: no overlapping texts and no text outside the screen at 1280 × 720, 1920 × 1080 and 3840 × 2160 in eight stills
- [ ] 5.2 Readability: verify at 1920 × 1080 the smallest text is at least 18 px, the large numbers at least 15 % of the screen height, and the contrast check of design D10 reports at least 4.5:1 for every text in the stills — open: smallest text 26.9 px at 1920 × 1080 (needs 18), large numbers 37 % of the height. Contrast after adding a halo, a soft dark spot behind labels, opaque secondary colour and a stronger gradient behind the moments: the strict measurement (text colour against the 90th percentile of the background in the text box) still found 14 of 52 texts below 4.5:1 before the last adjustment, mostly small gold labels in front of the bright horizon; not measured again after the last adjustment
- [x] 5.3 Flash check: verify no element changes its brightness more than three times per second in the audit run — done 2026-11-03: test over one loop, no label switches on and off more than three times per second

## 6. Live data, outages, day change

- [x] 6.1 Live power and lifetime yield (design D3) with "Stand HH:MM" after three minutes without live data and "Gerade keine Live-Daten" without any; verify tests with a fake socket for silence, reconnection and both texts — done 2026-11-03: tests for live power, "Stand HH:MM" after three minutes and "Gerade keine Live-Daten"
- [x] 6.2 No stored readings: one message in words, retry without reload; verify with the proxy pointing to a dead address that the message appears and the landscape appears once the address answers — done 2026-11-03: with the data source answering 502 the screen shows "Keine Daten" with the explanation and the plant name; the store test shows the landscape loading after the source answers again
- [x] 6.3 Today every five minutes, day change at midnight, nightly reload at 03:30 only when the server answers; verify tests with a fake clock for 23:59 → 00:00 (new day in, day 366 out) and for the reload — done 2026-11-03: tests for the day change (new day in, the 366th out) and the reload at 03:30
- [x] 6.4 Evening by computed sunrise and sunset for Leonding; verify tests against published times for three dates (within two minutes) — done 2026-11-03: four dates within two minutes of api.sunrise-sunset.org

## 7. Device adaptation

- [ ] 7.1 Lower the pixel ratio and then switch off shadows when the frame rate stays below 40 (design D11); verify with CPU throttling in the browser that the loop still lasts as long as unthrottled and the detail drops — logic tested (pixel ratio, then shadows, at 20 fps); the check with CPU throttling in the browser is not done yet
- [ ] 7.2 **(Daniel)** Watch the film with the real fixture locally for at least two loops; verify Daniel finds no stutter, no text too short and no jump, and write his remarks into the pull request

## 8. Repository and shared files

- [x] 8.1 Update `leoiot-pv/README.md` (new application, how to run and test it) and `leoiot-pv/PRODUCT.md` (second kiosk at `/kiosk2/`, the CO₂ factor with its source, the three exceptions of the proposal); verify every command in the README runs as written — done 2026-11-03: `kiosk2/README.md` new, `leoiot-pv/README.md` and `PRODUCT.md` updated; the README commands were run in this change (fixture dev server, tests, build)
- [x] 8.2 In `openspec/changes/pv-main-kiosk/specs/pv/main-kiosk/spec.md` remove `/kiosk2/` from "Former kiosk addresses lead to the kiosk"; verify `openspec validate pv-main-kiosk --strict` passes — done 2026-11-03: `openspec validate pv-main-kiosk --strict` passes
- [x] 8.3 Separate pull request for the shared files: service `kiosk2` in `leoiot-pv/compose.yaml` (port `127.0.0.1:8093`, token as the dashboard, health check), `leoiot-platform/proxy/nginx.conf` (`/kiosk2/` and `/kiosk2/ws` proxy to 8093, `/kiosk2` redirects, the two 301 lines go), documentation site pages that list `/kiosk2/` in both languages; verify `docker compose … config -q` as in `AGENTS.md`, `nginx -t` on the file in a container, `.github/ci/affected.sh` lists the expected units and the docs build passes — done 2026-11-03 in #147: compose `config -q` passes, `nginx -t` passes in a container with placeholder certificates, `affected.sh` lists docs, both compose files and the units `leoiot-platform` and `leoiot-pv`, docs build passes
- [x] 8.4 Verify `openspec validate pv-sonnenjahr-kiosk --strict` passes and every pull request names `Closes #123` or `Part of #123` — done 2026-11-03: both changes validate; #143, #146 and #147 say `Part of #123`

## 9. Shipping and acceptance

- [ ] 9.1 Release pull request `main` → `release` only when Daniel says so; verify the deployment workflow is green and `docker compose ps` on vm23 (read only) shows `kiosk2` healthy
- [ ] 9.2 **(human, vm23)** Daniel installs the proxy file and reloads nginx; verify `https://vm23.htl-leonding.ac.at/kiosk2/` shows the film with live data, `/kiosk/` still shows the main kiosk and the smoke routes pass
- [ ] 9.3 **(Daniel)** Acceptance on the real screen in the school, together with #120; verify the date and any device limitation are written in #123
