# model3d-rewrite-kickoff

Continuation prompt for the 3D-Modell team (Paul Kreinecker, Jonas Leitner). It collects everything a fresh session needs to start the rewrite of the 3D building explorer in `leoiot-3d/`. Written 2026-10-28 from an exploration of the repository; no code exists yet.

## State

- **Branch / change:** none yet. No `model3d-…` change exists in `openspec/changes/`, `openspec/specs/model3d/` is empty, `leoiot-3d/` holds only `README.md` (status "Not started").
- **Next step:** propose the first change, e.g. `model3d-building-explorer`, with the scope in "Decisions" below. The route `/3d/` is a separate plain platform pull request without an OpenSpec change (D2, prompt `docs/continuations/platform-3d-route.md`). This prompt is on `main`, so a worktree from `origin/main` contains it. When the 3D change exists, rename this prompt to the change name (rule: `docs/continuations/README.md`).
- Exploration only so far: no code was written.
- Work in a worktree: `git fetch origin && git worktree add ../leoiot-3d-<task> -b feat/<task> origin/main`.
- **How to start the next session:** `/opsx:propose model3d-building-explorer`, telling it to read this prompt first. The proposal follows D1–D8 below; `openspec/config.yaml` names `docs/functional-specification.md` as the source for new specs. Validate with `openspec validate model3d-building-explorer --strict`.
- **Order (recommended):** 3D change first, platform route pull request last (see "Order of work" below).

## Rules that bind this sub-project

Read `AGENTS.md`, `openspec/specs/README.md`, `openspec/config.yaml`, `leoiot-3d/README.md`. In short:

- Code lives only in `leoiot-3d/`. It **must not import, copy or mount anything from `legacy/`** or a sibling sub-project. Legacy logic is re-specified and re-implemented. Exception decided by the team: the glTF model files (see Decisions, D1).
- Specs: `openspec/specs/model3d/<capability>/spec.md`. Changes are named `model3d-…`. Never create `openspec/` inside `leoiot-3d/`.
- Contract first: any topic, payload, field, route or shared interface the 3D app relies on must already be in `openspec/specs/platform/`. If it is not, a `platform-…` change is merged first. (The proxy route `/3d/` is not such an interface: no platform spec covers routes, so it is a plain platform pull request, see D2.)
- The tech stack and scaffolding are decided in the first `model3d-…` change (`leoiot-3d/README.md`).
- CI picks the sub-project up by shape: `package.json` per component, `Dockerfile`, `compose.yaml` in `leoiot-3d/`, routes in `.github/ci/smoke-routes`. Node 22 for `leoiot-*`. Run `.github/ci/affected.sh origin/main HEAD` and the listed checks before pushing.
- Never commit credentials. **`legacy/frontend/logic.js` contains a hard-coded InfluxDB admin token (`INFLUXDB_TOKEN`). Do not copy it.** The new app must not hold any token in browser code.

## Requirements source

`docs/functional-specification.md` (FSD) is the source for new specs. Items that concern 3D:

| Id | Text (short) |
|---|---|
| FR-02 (Must) | Clicking a room in the 3D model shows that room's CO2 and temperature. |
| FR-05 (Must) | Live updates via WebSockets when sensor data is available. |
| FR-07 (Must) | CO2 colours: green < 600 ppm, yellow 600–1200, red > 1200. |
| FR-08 (Must) | Warning symbol if no data for 5 minutes (stale). |
| FR-11 (Should) | Clear, visible navigation, no hidden primary controls. |
| FR-14 (Must) | Invalid room → "No data for room" message. |
| NFR | Initial 3D load may be slow; interaction smooth afterwards. Desktop first, mobile later. Bilingual DE/EN (AC-12). School-local timezone. Modules (energy, room dashboard, 3D) separated. |
| §10 | Sensor data and 3D model rooms share the same room identifier. |
| AC-02, AC-10, AC-11, AC-13 | click any configured room → values; smooth after load; invalid room message; live room updates in 3D while viewing. |

Note: legacy CO2 colours use other thresholds (400–800 green, 800–1000 yellow→orange, > 1000 orange→red). The new app must follow FR-07.

## Data the 3D app may use (platform contract)

From `openspec/specs/platform/data-contract/spec.md` and `openspec/specs/platform/broker/spec.md` (read them; do not restate them in 3D specs, refer to them):

- **Live room climate:** browsers connect to the broker as MQTT over WebSocket at `/mqtt` on the same host, no credentials, subscribe-only to `leoiot/room-climate/#`. One retained JSON message per room on `leoiot/room-climate/<room>` with `room`, `device`, `source` (`sensor`/`simulated`), `ts` (ms epoch) and any of `co2` (ppm), `temperature` (°C), `humidity` (%). Retained ⇒ a new subscriber gets every room's latest value at once. Staleness is judged by `ts`.
- **Stored room climate:** InfluxDB org `leoiot`, bucket `server_data`, measurement `room_climate`, tags `room`/`device`/`source`, fields `co2`/`temperature`/`humidity`. Readers get a read-only token; the browser never sees it (the PV sub-project injects it via its own nginx, see `leoiot-pv/dashboard/Dockerfile` and `leoiot-pv/compose.yaml` as a pattern). For "current values" the retained MQTT messages are enough; Influx is only needed for history.
- **Room id:** the name on the door sign and in the 3D model, e.g. `105`, `153`, `E10`, `U08`, `1Aula`, `UBiolab`, `U74.1`. Case-sensitive, letters/digits/dots only, never lowercased or abbreviated.
- **Not allowed for new code:** legacy measurements `mqtt_consumer`, `room_temperature`, topics `room-temperature`, `nili3/…`, and the legacy `/ws` `temp`/`co2` subscribe protocol.

## Hosting / routes today

- `leoiot-platform/proxy/nginx.conf`: catch-all `location /` → `127.0.0.1:8080`, which is the **legacy** 3D frontend (Vite dev server in `node:20-alpine`, `legacy/docker-compose.yaml` service `frontend`; also listed in `src/content/docs/en/docs/operations.md` and `.github/ci/legacy-services.map`). `/mqtt` → broker WS (9001). Ports in use: 1883 (broker MQTT, `leoiot-platform/compose.yaml`), 3000, 8080, 8081, 8086, 8088 (`/kiosk/`), 8089 (`/pv/`), 8090, 9001. 8091 is free.
- `.github/ci/smoke-routes` checks `/` among others.
- Target (decision D2): new app at `/3d/`; `/` stays unchanged for now. See D2 for the proxy plan.

## Before you start: data, local development, tests, deployment

### No room-climate data on `/mqtt` yet

The broker and `/mqtt` are live (`platform-broker`, archived 2026-10-22), but **nothing publishes `leoiot/room-climate/#` yet**. The collector and simulator that will write it are `sensors-…` changes, and `leoiot-sensors/` has not started (its README: "Not started"). The legacy sensor data (`nili3/…`, `room-temperature`, the `/ws` bridge) is off-limits for new code. Consequences:

- On vm23 the new app will at first show "No data for room" for every room and an empty heatmap. That is correct behaviour, not a bug; the spec must cover the empty state (no retained message for a room, and no message at all).
- This does not block the 3D work: the contract is fixed, so the app can be built and tested against it now.
- For development and tests, provide data yourself (see below). Coordinate with the sensors team (Elias Pointinger) on when their simulator publishes; once it does, real values appear without any change in 3D.

### Local development

- `vite` dev server with `base: '/3d/'`. The app derives the broker URL from the page's own host (`wss://<host>/mqtt`, or `ws://` on http), so it needs no configuration in production.
- Live data in development, options to pick in `design.md`:
  - a dev proxy in `vite.config` that forwards `/mqtt` to a local Mosquitto with a WebSocket listener, where test messages are published by hand with `mosquitto_pub -r -t leoiot/room-climate/105 -m '{"room":"105","device":"dev","source":"simulated","ts":<ms>,"co2":850,"temperature":22.4}'` (dev-only config inside `leoiot-3d/`, written new, not copied from `leoiot-platform/broker/`, anonymous publish allowed only there);
  - or forward `/mqtt` to `wss://vm23.htl-leonding.ac.at/mqtt` (anonymous, read-only) – useful once the sensors simulator publishes.
- Test messages must follow the contract (fields, `source` = `simulated`, `ts` in ms).

### Tests

- Follow `leoiot-pv/dashboard`: Vite + `vitest` (`"test": "vitest run"`); CI runs `npm ci && npm test --if-present && npm run build` with Node 22.
- Unit-testable pure logic: room id from mesh name (part before the first `_`, e.g. `134_1` → `134`), which floor a room belongs to (prefix `U`/`E`/`1`/`2`/`T`), parsing and validating a room-climate message (unknown fields ignored, missing fields unknown not zero), staleness from `ts` (5 min), temperature and CO2 colour scales (FR-07 boundaries: 599/600, 1200/1201), which rooms a heatmap covers per floor.
- The WebGL scene itself is checked by hand in the browser.

### Deployment shape (how CI and deploy pick it up)

- `leoiot-3d/compose.yaml` makes `leoiot-3d` a deploy unit; units deploy in the order platform, legacy, then the others alphabetically (`.github/ci/deploy.sh`). Compose reads `leoiot-3d/.env` only if it exists; the 3D app needs no `.env` and no secrets.
- Suggested layout like PV: `leoiot-3d/compose.yaml` + one component folder (e.g. `leoiot-3d/explorer/`) with `package.json`, `Dockerfile`, `vite.config.ts`, `src/`, `tests/`, `public/models/` (the copied glTF files).
- Service: built image, `restart: unless-stopped`, port `127.0.0.1:8091:8091` only, healthcheck `wget -q -O /dev/null http://127.0.0.1:8091/healthz`. It does not need the shared broker network: the browser reaches the broker through nginx `/mqtt`, not the container.
- Image: stage 1 `node:22-alpine` builds, stage 2 `nginx:stable-alpine` serves `dist` under `/usr/share/nginx/html/3d` with `listen 8091`, `location = /healthz`, `location /3d/`, and a redirect `/3d` → `/3d/` (pattern: `leoiot-pv/dashboard/Dockerfile` and `leoiot-pv/dashboard/nginx/dashboard.conf.template`, without the token and query parts). The models make the image about 200 MB larger; that is accepted (D1). Serve `.gltf` with a long cache lifetime and gzip, since they are text.
- CI checks for the change: `node leoiot-3d/explorer`, `image leoiot-3d/explorer`, `compose leoiot-3d/compose.yaml` (see `AGENTS.md`, "Run the checks locally").

### Order of work

1. **3D first:** `/opsx:propose model3d-building-explorer`, then implement, test locally, merge into `main`. Nothing reaches users yet because nginx has no `/3d/` route; the container just runs on `127.0.0.1:8091`.
2. **Platform route last:** the pull request from `docs/continuations/platform-3d-route.md` (nginx blocks, `/3d/` in `smoke-routes`, `operations.md`), merged after the 3D app is on `main`, so both ship in the same promotion.
3. After the release, nginx is applied on vm23 by hand.

Why not platform first: `main` must always be shippable (`AGENTS.md`). A `/3d/` smoke route on `main` without the app would fail the next deployment of everyone. The nginx block alone would do no harm, but has nothing to serve, and changing `.github/` runs every CI check.

## What the legacy app does (`legacy/frontend/`, reference only)

Files: `index.html` (UI, 479 lines), `logic.js` (all logic, 1891 lines), `package.json` (`three ^0.183.2`, `vite ^8`; but `index.html` actually loads three **0.160.0 from unpkg via importmap**), `vite.config.ts` (only `allowedHosts`), `temp.html` (unused experiment: explode/collapse layers), `building.glb` (41 MB, unused).

### Scene

- Three.js `PerspectiveCamera(45°, near 1, far 100000)` at (100, 80, 100), `OrbitControls`, `WebGLRenderer` with PCF soft shadows, ACES filmic tone mapping (exposure 1.2), background `#3a3d42`.
- `CSS2DRenderer` overlay for room value labels (pointer-events none).
- Lights: ambient 1.4, directional 0.8 at (200, 300, 100) with 2048² shadow map.
- Materials replaced on load by mesh name: name contains `GLAS` → transparent glass (opacity 0.3); `METALL` or `FENSTERRAHMEN` → metal; else white-grey base material.
- Full-screen loading overlay until all models are loaded.

### Models (all glTF 2.0, buffers embedded as base64 → huge)

| File | Size | Content |
|---|---|---|
| `ModelU.gltf` | 18 MB | basement (`cellar…` meshes) + 26 rooms |
| `ModelE.gltf` | 31 MB | basement + ground floor (cumulative stack) |
| `Model1F.gltf` | 41 MB | U + E + 1st floor |
| `Model2F.gltf` | 49 MB | U + E + 1F + 2nd floor |
| `ModelFull.gltf` | 53 MB | whole building incl. `ceiling_floor` (no gym) — initial view |
| `ModelT.gltf` | 152 KB | gym (Turnsaal), 13 room boxes + `Würfel` |
| `waypoints.gltf` / `waypoints_t.gltf` | 90 / 42 KB | navigation markers (empty meshes, only positions matter) |

Floor models are cumulative: "Floor 1" shows basement + ground + floor 1. Building structure meshes are named `<cellar|ground_floor|first_floor|second_floor|ceiling_floor>-<MATERIAL>`. All six are loaded and cached up front; switching floors swaps the cached scene. Y-up, units ≈ metres.

**Room meshes** are named by room id, optionally with `_<suffix>` for extra parts of the same room (e.g. `134_1`). Legacy maps a mesh to a room by taking the part before the first `_`. Room ids present:

- U (26): U04 U05 U07 U08 U10 U71 U72 U73 U74 U74.1 U77 U78 U79 U81–U92 UBiolab
- E (17): E05 E07 E08 E09 E10 E11 E22 E23 E24 E25 E26 E581 E582 E59 E71 E72 E73
- 1 (29): 103–109 119 121–124 130–134 142–148 151–154 1Aula
- 2 (22): 203 204 206 213–218 226–231 237 239 241 251–254
- T (13): T1 T2 T3 T4 T6 T10–T16 T19

Floor floor-surface heights (`FLOOR_Y`): U −3.106, E 0.058, 1F 3.205, 2F 6.263, T 0.058.

### UI

- Bottom bar: Basement / Ground / Floor 1 / Floor 2 / Gym / Reset View (back to full model + initial camera) / Temperature / CO2. Heatmap buttons are disabled except on U/E/1F/2F.
- Top right: navigation panel (search field with up to 10 suggestions, GO). On ≤ 768 px it becomes a bottom drawer opened by a 🧭 button.
- Room info panel (top right, bottom on mobile): room, tag, temp, CO2, "No data".
- Badge "running on vm 23". All strings English only (FSD wants DE/EN).

### Room click (FR-02)

Raycast on click; a mesh whose name starts with `E|U|1|2|T` is a room. It gets a yellow highlight (`#f1c40f`), the panel shows its values, and the app subscribes to that room's live values while selected. A click while a heatmap is on clears the heatmap first.

### Heatmaps

- Only rooms of the current floor (name prefix = floor letter).
- Temperature: 20 °C blue `#8da1d6` → 25 °C red `#d68d8d`, linear, label `21.3°C` at mesh centre.
- CO2: three-stop gradient (see thresholds above, must change to FR-07), label `850 ppm`.
- Live values update coloured meshes and labels; temp and CO2 heatmaps are mutually exclusive.

### Navigation ("route to room")

1. Find the room mesh by id (case-insensitive), take its bounding-box centre.
2. Snap the centre to the nearest corridor segment (hard-coded corridor centre lines per floor group `all`/`upper`/`U`/`T`) → "door point".
3. Waypoints from `waypoints*.gltf`, node name `<floor>_<type>`: `start`, `stairs`, `Intersection_one…five` (school, per floor U/E/1/2), `entrance` and `intersection_one…thirteen` (gym). All positions are listed below.
4. Path: start at `E_start` (Aula), greedy walk to the waypoint that is nearest and gets closer to the door; for other floors: walk to `E_stairs`, jump to `<floor>_stairs`, `<floor>_start`, then greedy to the door, then into the room centre. Gym has many hard-coded per-room exceptions (T1, T2, T4, T6, T10, T11, T13, T19).
5. Render: green `TubeGeometry` (radius 0.3) along a Catmull-Rom curve 0.6 above the floor, drawn progressively; red dot (r 1.2) runs along it; at the stairs the model switches to the target floor and the ground-floor part stays as a faint ghost tube.

A Dijkstra graph (`graphNodes`, `graphEdges`, `findShortestPath`, `entryNode`) exists in `logic.js` but is **dead code**. The greedy approach plus per-room exceptions is fragile; a proper navigation graph is the obvious improvement.

Waypoint positions (x, y, z):

```
U_start (3.48,-2.88,-7.98)  U_stairs (-1.85,-1.81,-13.1)
U_Intersection_one (-13.19,-1.81,5.3) _two (-41.29,-1.81,5.3) _three (-41.29,-1.81,-52.03) _four (16.35,-1.81,-52.03) _five (16.35,-1.81,-22.75)
E_start (3.48,0.34,-7.98)   E_stairs (-1.85,0.5,-13.1)
E_Intersection_one (-11.74,0.75,5.3) _two (17.55,0.75,-22.73) _three (27.58,0.75,-22.73) _four (38.72,0.75,-22.73) _five (52.76,0.75,-22.73)
1_start (3.48,3.66,-7.98)   1_stairs (-1.85,3.42,-13.1)
1_Intersection_one (-11.54,3.66,5.3) _two (16.48,3.66,-22.35) _three (27.58,3.82,-22.73) _four (38.72,3.82,-22.73) _five (52.76,3.82,-22.73)
2_start (3.48,7.03,-7.98)   2_stairs (-1.85,6.79,-13.1)
2_Intersection_one (-11.54,7.03,5.3) _two (16.48,7.03,-22.35) _three (27.58,6.64,-22.73) _four (38.72,6.64,-22.73) _five (52.76,6.64,-22.73)
T_entrance (-41.44,0.23,3.06)
T_intersection_one (-27.68,0.23,3.06) _two (-4.42,..,3.06) _three (4.16,..,3.06) _four (28.12,..,3.06)
T_intersection_six (-32.9,..,-6.06) _seven (-4.42,..,-5.38) _eight (-0.61,..,-5.38) _thirteen (-28.17,..,-5.38)
T_intersection_nine (28.54,..,-12.6) _ten (4.43,..,-12.6) _eleven (-4.87,..,-12.6) _twelve (-28.12,..,-12.6)
```

Corridor centre lines (legacy `segments`, x/z): ring z = −13.9 and z = 5.1 for x ∈ [−11.15, 16.2]; x = −11.15 and x = 16.2 for z ∈ [−13.9, 5.1]; wings to ±70; Aula cross z = −4.4 / x = 5.5 (upper floors); basement extension x = −41.45 (z −51..5.1) and z = −52 (x −57.9..16.2); gym hall z = 3.06 (x −41.44..28.12).

### Known legacy weaknesses (do not repeat)

- Admin InfluxDB token in browser code; Flux queries built by string concatenation from room names.
- Reads legacy data (`room_temperature`, `mqtt_consumer` `nili3/…` topics, special case for room 105) and the legacy `/ws` bridge instead of `room_climate` / `/mqtt`.
- About 192 MB of base64-embedded glTF loaded at once (six models; the unused `building.glb` adds another 41 MB on disk); no compression (Draco/Meshopt), no `.glb`, no per-floor lazy loading; the floor files duplicate the lower floors.
- three.js version mismatch (package.json vs. CDN importmap); runs as a Vite **dev** server in production.
- No stale-data indicator (FR-08), English only, `alert()` for unknown room, heavy console logging, global `window.*` functions.

## Decisions (team, 2026-10-28)

- **D1 – Models are copied.** The glTF files are copied from `legacy/frontend/` into `leoiot-3d/`; without them there is no model. This is a deliberate exception to the "copy nothing from legacy" rule for data assets only; record it in the change's `design.md`. Floor models: **4** – basement `ModelU.gltf`, ground floor `ModelE.gltf` (E = Erdgeschoss), first floor `Model1F.gltf`, second floor `Model2F.gltf`. There is no third-floor model: the only other floor-like meshes are `ceiling_floor-*` (roof slab) inside `ModelFull.gltf`. Also copied: `ModelFull.gltf` (whole building, start view and "Reset View") and `ModelT.gltf` (gym) – both are important. The waypoint files are only needed for the navigation change. `building.glb` and `temp.html` are unused and not copied. **The files are copied as they are** (plain git, no Git LFS, no conversion): about 192 MB, `ModelFull.gltf` is 53 MB and triggers GitHub's 50 MB warning on push (the limit is 100 MB per file). They will be changed later anyway; compressing them (e.g. `.glb` with Draco/Meshopt) is a later change. The nginx image serves them, so they are part of the Docker build context.
- **D2 – Route `/3d/` only; the main page stays as it is.** The new app is deployed at `https://vm23.htl-leonding.ac.at/3d/`. `/` keeps showing what it shows today (the legacy 3D explorer); nothing changes there. Making `/` open the new app (or another main page) is a later iteration. Vite needs `base: '/3d/'`.
  The route only matters to 3D, but the files are shared, so it goes in its own small pull request. No OpenSpec change is needed: no platform spec covers proxy routes, and the route is not a data interface. The complete plan (nginx blocks, `smoke-routes`, `operations.md`, applying nginx on vm23, release order, later `/` redirect) is in its own prompt: **`docs/continuations/platform-3d-route.md`**. For the 3D app this means: the container listens on `127.0.0.1:8091`, serves the build under `/3d/` (prefix kept, as PV does under `/pv/`), and live data uses the existing `/mqtt`.
- **D3 – Tech stack like legacy.** three.js (`GLTFLoader`, `OrbitControls`, `CSS2DRenderer`) built with Vite, Node 22; one pinned three.js version from npm (no CDN importmap). Production image: Vite build served by nginx (pattern: `leoiot-pv/dashboard/Dockerfile`), with `/healthz`. TypeScript optional (PV uses it). Browser MQTT client for `/mqtt`, e.g. `mqtt` (mqtt.js) – pick in the change.
- **D4 – Current values only, no database token.** The broker keeps the latest message per room (retained), so subscribing to `leoiot/room-climate/#` at `/mqtt` delivers every room's current value immediately, without credentials. No InfluxDB access, no token, no server-side injection. A room with no retained message shows "No data for room"; a message whose `ts` is older than 5 minutes is shown as stale (FR-08). Only if history is wanted later does a read token (injected server-side) become necessary.
- **D5 – Scope of the first change:** room click with info panel, per-floor view (floor buttons + reset), live values, temperature and CO2 heatmaps (CO2 colours per FR-07). Navigation is a later change (`model3d-room-navigation`).

- **D6 – Layered floor view like legacy.** Selecting a floor shows that floor and every floor beneath it (Floor 2 = U + E + 1F + 2F), which the cumulative model files already provide. Exception: the gym is a separate building segment and is shown alone (it would not fit on one screen together with the school). Heatmaps colour only the rooms of the selected floor; the full-building view and the gym have no heatmap (as in legacy, decided 2026-10-29). Room click works in every view, including full building and gym.
- **D7 – English UI only for now**, as in legacy. This deviates from FSD AC-12 (DE/EN). The proposal lists German as a non-goal of this change and names a later change for it (e.g. `model3d-german-translation`). To keep that easy, the first change keeps all UI text in one place instead of spreading strings through the code.
- **D8 – Stale threshold 5 minutes** (FSD FR-08), judged by the message's `ts`.

Decided 2026-10-29:

- **D9 – CO2 heatmap: smooth gradient with the FR-07 limits.** No hard colour jumps; the colour changes continuously, so 400 and 599 ppm look different. Colour stops on the FR-07 limits: green at ≤ 400 ppm (outdoor air), yellow at 600, red at 1200, deeper red above (cap e.g. 2000). The legacy limits 800/1000 are not used. Because the transition is smooth, 599 and 600 look almost the same; the FR-07 **status** (green/yellow/red by the exact limits < 600, 600–1200, > 1200) is therefore shown as text or icon in the info panel and label, and that status is what AC-04 tests. Record this reading of FR-07/AC-04 in `design.md`.
- **D10 – Temperature heatmap like legacy:** smooth gradient blue `#8da1d6` at ≤ 20 °C to red `#d68d8d` at ≥ 25 °C, label `21.3°C`. The FSD sets no temperature limits.
- **D11 – Rooms without current data:** in a heatmap, a room with no message stays uncoloured with the label "No data"; a room whose last message is older than 5 minutes is grey with a warning symbol and its last value (FR-08). The info panel shows "No data for room" (FR-14) or the last value with the warning.
- **D12 – Info panel content:** production shows CO2 and temperature only (FR-02), with the room id. **For now** it also shows the time of the last reading (from `ts`, school-local time), so the team can check that live data arrives. This is temporary: the spec marks it as such, and a task or later change removes it before the app becomes the main page. Humidity and `source` are not shown.
- **Defaults (no team decision needed, change if wrong):** if two devices publish for one room, the newest message by `ts` wins; desktop first, but the layout must not break on small screens (legacy's mobile layout is a nice-to-have); the "running on vm 23" badge is not carried over.

## Suggested capability split for `openspec/specs/model3d/`

First change (`model3d-building-explorer`):
- `building-viewer` – load models, floor switching, camera, reset, loading screen.
- `room-climate-view` – room click, highlight, info panel, live values from `platform/data-contract`, stale marker, "No data for room".
- `room-heatmap` – temperature/CO2 colouring per floor, labels, live updates (FR-07 colours).

Later change (`model3d-room-navigation`):
- `room-navigation` – search with suggestions, route from entrance to room across floors and gym, using the waypoint files.

Later change (`model3d-german-translation`):
- German UI next to English (FSD AC-12), switchable language.

Separate platform pull request: route `/3d/` and, in a later iteration, `/` → `/3d/` (D2, prompt `docs/continuations/platform-3d-route.md`).
