# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin` and are done by a person; anything that creates or enters a password or token is done by the user. Nothing here changes `legacy/`.

## 1. Sub-project scaffold

- [x] 1.1 Add `leoiot-sensors/.gitignore` that keeps `.impeccable/previews/`, `.impeccable/mocks/`, `.impeccable/questions/`, `node_modules/`, `dist/` and `.env` out of Git, and commit `PRODUCT.md`, `.impeccable/surfaces/dashboard.md` and `.impeccable/config.json`; verify `git status` shows no preview or mock file and `git check-ignore` matches `.impeccable/previews/room-105/index.html` Done 2026-10-23: `leoiot-sensors/.gitignore` added (also ignores `.impeccable/hook.cache.json`); `git check-ignore -v` matches `.impeccable/previews/room-105/index.html`, `git status -uall` lists no preview, mock or question file; `PRODUCT.md`, `.impeccable/surfaces/dashboard.md` and `.impeccable/config.json` committed
- [ ] 1.2 Add `leoiot-sensors/compose.yaml` (project `leoiot-sensors`, services `collector` and `dashboard`, external network `${PLATFORM_NETWORK:-2526-4ahitm-leoiot-dashboard_leoiot}`, the collector's `env_file` with `required: false` as in design D8, dashboard on `127.0.0.1:${SENSORS_DASHBOARD_PORT:-8091}`) and `.env.example` naming `SENSORS_DASHBOARD_INFLUX_TOKEN`, `SENSORS_DASHBOARD_PORT`, `SENSORS_COLLECTOR_ENV_FILE` and `PLATFORM_NETWORK` without values; verify `docker compose -f leoiot-sensors/compose.yaml --env-file <placeholder file> config -q` passes as AGENTS.md describes
- [ ] 1.3 Update `leoiot-sensors/README.md` (status, layout, how to run tests, build and the local stack) and handle `docs/continuations/sensors-first-dashboard.md` (commit it with the first commit or delete it, as its header says); verify every command in the README runs as written

## 2. Collector

- [ ] 2.1 Scaffold `leoiot-sensors/collector/` (Node 22, TypeScript, Vitest, `mqtt`, `build` and `test` scripts, `Dockerfile`, `healthcheck.mjs`); verify `npm ci && npm test && npm run build` exit 0 and `.github/ci/affected.sh origin/main HEAD` lists `node leoiot-sensors/collector` and `image leoiot-sensors/collector`
- [ ] 2.2 Configuration: environment variables (credentials required, URLs, bucket, organisation and intervals with defaults) and `devices.json` with `nili3` → `105`, `sensor` and its three topics; validate the mapping (room id rule, unique devices, source, one quantity per topic); verify with tests for every scenario of "Devices are read through a mapping" and "Credentials come from the environment", including that no credential appears in the log
- [ ] 2.3 Reading handling: parse a message into a reading, drop non-numbers and out-of-range values with a log line, keep the device's last values; verify with tests for "Invalid values are dropped" and both scenarios of "Readings are published as the contract specifies"
- [ ] 2.4 Database writer: line protocol for `room_climate` with tags and one field, receipt time in nanoseconds, batches every two seconds, a one-hour queue in order with a dropped-count log; verify with tests against a fake HTTP server for "Readings are stored as the contract specifies" and "Database unreachable for ten minutes"
- [ ] 2.5 Broker side: connect, subscribe to exactly the mapped topics, reconnect and resubscribe, publish the live message retained with QoS 1; verify with tests against a throwaway Mosquitto 2.1 that a message on `nili3/sensor/105_co2/state` is not received, that a broker restart is survived, and that a new subscriber to `leoiot/room-climate/#` gets the retained message
- [ ] 2.6 Health status file and `healthcheck.mjs`; verify with tests for both scenarios of "Health is reported" and that the container turns unhealthy when the throwaway InfluxDB is stopped for six minutes (shortened thresholds allowed in the test)
- [ ] 2.7 End to end on a local stack (throwaway InfluxDB 2.7 and Mosquitto 2.1, test token, a script publishing like `nili3`): verify points with the right tags, fields and times in `room_climate` and the retained message shape against `platform/data-contract`; note the commands in the pull request

## 3. Dashboard scaffold

- [ ] 3.1 Add `leoiot-sensors/dashboard/` (Vite, TypeScript, Vitest, ECharts 6 imported per module, `mqtt`, base path `/sensors/`, Lexend served from the build) with an nginx template like the PV dashboard's (`POST /sensors/api/query` only, token from `SENSORS_DASHBOARD_INFLUX_TOKEN`, `/healthz`, `/sensors` → `/sensors/`, everything else 404) and a `Dockerfile`; verify `npm ci`, `npm test`, `npm run build` exit 0 and the image built with `.github/ci/image-build.sh leoiot-sensors/dashboard` answers `GET /sensors/` 200, `/sensors` 301, `/healthz` 200, `GET /sensors/api/query` 405
- [ ] 3.2 Verify no credential is delivered: with `SENSORS_DASHBOARD_INFLUX_TOKEN` set to a marker, neither the files in the container nor the page and its assets fetched over HTTP contain it, and no tracked file in `leoiot-sensors/` contains a token, password or login
- [ ] 3.3 Dev setup: Vite proxies `/sensors/api/query` and `/mqtt` to a local stack or, read-only, to vm23 through an SSH tunnel; verify the dev page shows readings from the local stack of task 2.7

## 4. Dashboard views

- [ ] 4.1 Frame: room from the address with `105` as default, top bar (brand, room, 24 h / 7 Tage, DE/EN, theme), language and theme kept in the browser, theme following the system on the first visit; verify with tests for "The dashboard is served at `/sensors/`" and "Languages and themes"
- [ ] 4.2 Data layer: Flux queries for both ranges and for the latest values (design D10), gaps kept, "since when above the limit" from the five-minute series, live messages from `/mqtt` with the once-a-minute fallback; verify with tests on recorded query answers for "Two time ranges", "Gap in the readings", "Above the limit for a while" and "Live values have a fallback"
- [ ] 4.3 Room panel: room id, identity line, three-lamp light, status sentence, three value cells that change in place, age line; states outdated, no data and simulated; verify with tests for "The air state is shown as a traffic light", "Current values show their age", "Outdated values are marked", "Rooms without data say so" and "Simulated readings are marked", including the thresholds 799/800/1000/1001
- [ ] 4.4 Charts: temperature chart and the two-panel CO₂/humidity chart with lamp bands, linked pointer, stated range, dashed lines for simulated readings; verify with tests on the chart options and in the browser that pointing in one panel marks all three
- [ ] 4.5 Impeccable check at 1440, 1280 and 360 px in both themes and both languages with every state; run the detector, then the finish review against `leoiot-sensors/.impeccable/surfaces/dashboard.md`, apply its fixes and let the documenter write `leoiot-sensors/DESIGN.md`; verify no horizontal scroll at 360 px, no console errors, and the review's verdict noted in the pull request

## 5. Shared files (pull requests of their own)

- [ ] 5.1 `leoiot-platform/proxy/nginx.conf`: location `/sensors/` (and `/sensors` redirect) to `127.0.0.1:8091`; verify `nginx -t` passes in a throwaway `nginx:stable-alpine` container with dummy certificates and `/pv/`, `/kiosk/`, `/mqtt` are unchanged
- [ ] 5.2 After task 7.3: add `/sensors/` to `.github/ci/smoke-routes`; verify `bash .github/ci/affected.test.sh` passes

## 6. vm23 preparation

- [ ] 6.1 **(human, vm23)** Create the broker account `sensors-collector` with `mosquitto_passwd` in `leoiot-platform/broker/pwfile`, add its block from `acl.example` to `acl`, restart the broker; put `SENSORS_MQTT_USER` and `SENSORS_MQTT_PASSWORD` into `/home/solmqadmin/leoiot-host-secrets/sensors-collector.env` (file mode 600); verify (read only) that devices and legacy services reconnected and the PV pages show live data
- [ ] 6.2 With the new account, subscribe read-only to `nili3/sensor/+/state` for a minute and compare the topic names with `devices.json`; verify that CO₂, temperature and humidity arrive on the mapped topics, or fix the mapping in a commit before the release
- [ ] 6.3 **(human, vm23)** Create a read-only InfluxDB token for `server_data`, write `leoiot-sensors/.env` with `SENSORS_DASHBOARD_INFLUX_TOKEN` (and the port if 8091 is taken); verify `ss -ltn` shows the dashboard port free and `docker compose config -q` passes in `leoiot-sensors/`

## 7. Going live

- [ ] 7.1 Release (pull request `main` → `release`, say beforehand what ships, merged by the user); verify the deployment run is green and (read only) `docker compose ps` in `leoiot-sensors/` shows both services healthy and the other units unchanged
- [ ] 7.2 **(human, vm23)** Install `leoiot-platform/proxy/nginx.conf` on the host and reload nginx; verify `https://vm23.htl-leonding.ac.at/sensors/` answers and `/`, `/dashboard/`, `/pv/`, `/kiosk/` and `/mqtt` still work
- [ ] 7.3 Check the live system: new points for room `105` in `room_climate` (read only), the retained message on `leoiot/room-climate/105` through `wss://vm23.htl-leonding.ac.at/mqtt`, and the dashboard showing the same values as the legacy view of room 105 within one reading; verify and note the comparison in the pull request
