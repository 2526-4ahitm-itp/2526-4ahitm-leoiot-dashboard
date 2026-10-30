# Tasks

Merge gate (design D15): `ci-ok` green and Jonas Leitner has tried the explorer locally and approved it. Branch commits and pushes of unfinished work are fine; nothing is merged into `main` before the gate.

## 1. Scaffold and deploy unit

- [x] 1.1 Add `leoiot-3d/explorer/` (Vite, TypeScript, Vitest, `base: '/3d/'`, `three` and `mqtt` pinned to exact versions, scripts `dev`, `build` = `tsc --noEmit && vite build`, `test` = `vitest run`, `preview`, `dev:publish`) with a placeholder page; verify `npm ci`, `npm test` and `npm run build` exit 0 with Node 22
- [x] 1.2 Add `explorer/Dockerfile` and `explorer/nginx/explorer.conf` per design D4 (port 8091, `/healthz`, `/3d` → 301, `/3d/assets/` immutable with `gzip_static` and `model/gltf+json`, `/3d/` no-cache, rest 404) and a `.dockerignore` (`node_modules`, `dist`, `.env*`); verify `.github/ci/image-build.sh leoiot-3d/explorer` succeeds and the image answers `GET /3d/` 200, `/3d` 301, `/healthz` 200, `/other` 404
- [x] 1.3 Add `leoiot-3d/compose.yaml` (service `explorer`, `127.0.0.1:8091:8091`, `restart: unless-stopped`, health check, no network, no `.env`); verify `docker compose -f leoiot-3d/compose.yaml config -q` passes and `.github/ci/affected.sh origin/main HEAD` lists `node leoiot-3d/explorer`, `image leoiot-3d/explorer` and `compose leoiot-3d/compose.yaml`

## 2. Local development and test stack

- [x] 2.1 Add `leoiot-3d/dev/mosquitto.conf` (listeners 1883 and 9001 WebSocket, anonymous allowed, written new) and `leoiot-3d/compose.dev.yaml` (explorer image, `eclipse-mosquitto:2`, nginx proxy; all ports on `127.0.0.1`, proxy on `${DEV_PROXY_PORT:-8000}`); verify `docker compose -f leoiot-3d/compose.dev.yaml config -q` passes and the stack starts healthy
- [x] 2.2 Add `leoiot-3d/dev/proxy.conf` that behaves like the vm23 proxy for this app (`/3d` → 301, `/3d/` → explorer with prefix kept, `/mqtt` → broker WebSocket with upgrade headers), written new; verify `http://localhost:8000/3d/` loads and a browser MQTT client on `ws://localhost:8000/mqtt` receives a message published with `mosquitto_pub`
- [x] 2.3 Add the Vite dev proxy for `/mqtt` to `EXPLORER_MQTT_TARGET` (default `ws://localhost:9001`); verify with `npm run dev` that the page at `http://localhost:5173/3d/` connects to the development broker, and with `EXPLORER_MQTT_TARGET=wss://vm23.htl-leonding.ac.at` that it connects to vm23 (no messages expected yet)
- [x] 2.4 Add `explorer/dev/publish.mjs` per design D14 (contract-conform `simulated` messages, FR-07 limit values, CO₂-only and temperature-only rooms, one stale room, rooms without messages, updates every 5 s, `--clear`, broker `DEV_MQTT_URL`); verify with `mosquitto_sub -v -t 'leoiot/room-climate/#'` that the messages follow `platform/data-contract` and that `--clear` removes them
- [ ] 2.5 Write `leoiot-3d/README.md`: layout, status, commands for tests, build, `npm run dev`, the dev stack and the publisher, the model exception (D1); verify every command in it runs as written on a fresh clone

## 3. Models and building viewer

- [ ] 3.1 Copy the six glTF files (design D1) from `legacy/frontend/` to `leoiot-3d/explorer/models/` unchanged; verify with `sha256sum` that they equal the originals and that no other legacy file was copied
- [ ] 3.2 `core/rooms.ts` and `core/floors.ts` (room id from node name, floor from room id, rooms per floor); verify with tests including `134_1`, `U74.1`, `1Aula`, `UBiolab`, structure names, and a test that reads the node names of the copied models and finds 26/17/29/22/13 rooms per floor
- [ ] 3.3 Scene: load all six models in parallel with progress and an error with "Try again" (D5), materials by name and lighting (D7), start view, floor and gym buttons, "Reset View", camera controls (D6); verify every scenario of `model3d/building-viewer` by hand in the dev stack, including a failed download (rename a model in the running container)
- [ ] 3.4 Verify the models are served hashed, cached and gzipped: response headers of a model in the dev stack show `Content-Encoding: gzip` and the long cache lifetime; note the compressed and uncompressed total size in the pull request

## 4. Live room climate

- [ ] 4.1 `core/messages.ts`, `core/store.ts`, `core/age.ts` (parse and validate, newest `ts` wins, empty retained message, stale > 5 min, re-judging); verify with tests for every scenario of "Messages are read as the contract specifies" and "A room's values are current, stale or missing"
- [ ] 4.2 `live/broker.ts` (URL from `location`, mqtt.js without credentials, subscribe once, reconnect, never publish); verify in the dev stack that stopping and starting the broker container reconnects and that values survive the interruption
- [ ] 4.3 `core/status.ts` (FR-07 status) and `core/time.ts` (Vienna formatting); verify with tests at 599/600/1200/1201 ppm and for a `ts` on another day and across the October daylight-saving change

## 5. Room selection and info panel

- [ ] 5.1 Picking and highlight (`#f1c40f`, all parts of a room, nearest room hit), deselect on background and close button, in every view; verify by hand in all six views
- [ ] 5.2 Info panel (room id, CO₂ with status symbol and text, temperature with one decimal, temporary reading time, "No data for room", stale warning with last values, live update); verify every scenario of `model3d/room-climate-view` by hand with the publisher

## 6. Heatmaps

- [ ] 6.1 `core/colours.ts` (temperature scale, CO₂ scale with stops D9, stale grey); verify with tests at every stop, below and above the scales, and halfway values
- [ ] 6.2 Heatmap buttons, colouring of the selected floor's rooms only, labels per room id, "No data", stale ⚠, mutual exclusion, toggle off, disabled in whole building and gym, follow floor, off on room click, gym and reset (D11); verify every scenario of `model3d/room-heatmap` by hand with the publisher
- [ ] 6.3 Live update of colours and labels and re-judged age while a heatmap is shown; verify by hand that a room turns grey 5 minutes after the publisher stops updating it

## 7. Acceptance

- [ ] 7.1 Texts: every visible string comes from `ui/strings.ts`; verify by search that no other module contains user-visible English text
- [ ] 7.2 Small screens: verify at 360 × 740 px and 1920 × 1080 px that all buttons are reachable and there is no horizontal scroll
- [ ] 7.3 No credential is delivered: search every file the explorer image serves for `token`, `password` and `Authorization`; none is found
- [ ] 7.4 Dependency rule: nothing in `leoiot-3d/` imports, references or mounts a file outside `leoiot-3d/` except the copied models' origin noted in D1
- [ ] 7.5 Full manual run on the production-like stack in Chrome and Firefox: load, every view, reset, room click in every view, both heatmaps on every floor, live updates, stale, "No data for room", broker restart; write the result into the pull request
- [ ] 7.6 Run the checks of `.github/ci/affected.sh origin/main HEAD` locally (`node`, `image`, `compose` for `leoiot-3d`), push, open the pull request; `ci-ok` is green
- [ ] 7.7 Jonas Leitner tries the explorer locally from the pull request branch and approves it (merge gate)

## 8. Documentation and hand-over

- [ ] 8.1 Update `docs/continuations/model3d-building-explorer.md` with the state while work is open; delete it in the pull request that finishes the change
- [ ] 8.2 Tell the sensors team (Elias Pointinger) that the explorer reads `room_climate` live data from `/mqtt` and shows "No data for room" until their collector or simulator publishes
- [ ] 8.3 Add a task or note to the change that will make the explorer the main page: remove the temporary reading time from the info panel (spec "The info panel shows the time of the last reading, for now")
