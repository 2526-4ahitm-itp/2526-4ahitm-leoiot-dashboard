# Design

## Context

See `proposal.md` for the motivation and `specs/model3d/*/spec.md` for the behaviour. The team's decisions are collected in `docs/continuations/model3d-building-explorer.md` (formerly `model3d-rewrite-kickoff.md`, decisions D1–D12 there); this design records how they are built. Facts that shape the approach:

- **The legacy explorer** (`legacy/frontend/`, read only): three.js with `GLTFLoader`, `OrbitControls` and `CSS2DRenderer`; six glTF models with base64-embedded buffers, loaded and cached up front; materials replaced by mesh name; room meshes named by room id with optional `_<suffix>`; a yellow highlight `#f1c40f` for the selected room; temperature and CO₂ heatmaps of the current floor. Its data access (admin token, legacy measurements, `/ws`) is not carried over.
- **The models**, checked on 2026-10-30 by reading their node names: `ModelU` 26 rooms, `ModelE` +17, `Model1F` +29, `Model2F` +22 (94 school rooms in `Model2F` and `ModelFull`), `ModelT` 13 gym rooms. Structure nodes are named `<cellar|ground_floor|first_floor|second_floor|ceiling_floor>-<MATERIAL>`; no room id contains `-`. No glTF extensions are used.
- **Data** (`platform/data-contract`, `platform/broker`): one retained JSON message per room on the room-climate topics, read anonymously over `/mqtt`; `ts` in ms decides the age. Nothing publishes there on vm23 yet.
- **Host**: the host nginx will map `/3d/` (prefix kept) to `127.0.0.1:8091` and already maps `/mqtt` to the broker's WebSocket listener (`docs/continuations/platform-3d-route.md`, `leoiot-platform/proxy/nginx.conf`). Port 8091 is free.
- **CI and deployment** pick up `leoiot-3d/explorer/package.json`, `leoiot-3d/explorer/Dockerfile` and `leoiot-3d/compose.yaml` by their shape; other Compose files are neither checked nor deployed (`.github/ci/affected.sh`, `.github/ci/deploy.sh`).

## Goals / Non-Goals

**Goals:**

- The explorer works on the platform contract alone: no token, no database, no configuration.
- It can be tested locally end to end, with the production image and realistic data, the same way on every team member's machine, before it is merged.
- Pure logic (room ids, floors, message reading, age, colours) is unit-tested; the scene is checked by hand.

**Non-Goals:**

- Navigation to a room, German texts, history charts, model compression or `.glb` conversion, a third floor.
- Making `/` open the new explorer.
- Server-side code of our own: the container serves static files only.

## Decisions

### D1. The models are copied from legacy as they are

`ModelU.gltf`, `ModelE.gltf`, `Model1F.gltf`, `Model2F.gltf`, `ModelFull.gltf` and `ModelT.gltf` are copied from `legacy/frontend/` into `leoiot-3d/explorer/models/`, in plain git (no LFS, no conversion). This is a deliberate, team-decided exception (kickoff D1, 2026-10-28) to the rule that nothing is copied from `legacy/`: it applies to these data assets only, never to code. The waypoint files belong to `model3d-room-navigation`; `building.glb` and `temp.html` are unused and not copied.

**One edit to the copied files** (user's review, 2026-10-30): the legacy `Model1F.gltf` and `Model2F.gltf` carried the structure of the first floor as one mesh with one material (`first_floor-Mat.94`), so its windows, frames and doors could not get their own materials. In both files that mesh was replaced by the five parts of `ModelFull.gltf` (`first_floor-FARBE__WEI__2`, `-FENSTERRAHMEN_1`, `-GLAS_NORMALGLAS_1`, `-METALL_STAHL__MATT_1`, `-METALL_ALUMINIUM__MATT_1`), which lie in the same world coordinates, under a new node `first_floor` without a transform. All other nodes are unchanged. `ModelFull` is the reference at the user's request: its glass, frames and metal all exist in the old merged mesh, but the walls differ in about 1 % of the vertices (about 2,160 only in the old mesh at x −26…2.5, z −18…24; about 700 only in `ModelFull`). The other four files stay byte-identical to `legacy/frontend/`. A unit test checks the parts.

*Why:* without the models there is nothing to show, and they will be replaced later anyway. *Alternative:* Git LFS or compression now (rejected by the team: a later change).

### D2. Layout

```
leoiot-3d/
├── compose.yaml          deploy unit: service explorer on 127.0.0.1:8091
├── compose.dev.yaml      local test stack (never deployed): explorer, broker, proxy
├── dev/
│   ├── mosquitto.conf    development broker, anonymous publish allowed (local only)
│   └── proxy.conf        nginx that behaves like vm23: /3d/ and /mqtt
├── README.md
└── explorer/
    ├── package.json      dev, build, test, preview, dev:publish
    ├── Dockerfile        node:22-alpine build → nginx:stable-alpine
    ├── nginx/explorer.conf
    ├── vite.config.ts    base /3d/, dev proxy for /mqtt
    ├── index.html
    ├── models/           the six glTF files (D1)
    ├── dev/publish.mjs   development publisher (D14)
    ├── src/
    │   ├── core/         pure logic, no three.js, no DOM: rooms, floors, messages, store, age, colours, time
    │   ├── live/         broker connection (mqtt.js)
    │   ├── scene/        three.js: loading, views, materials, picking, highlight, heatmap colouring, labels
    │   ├── ui/           buttons, info panel, loading screen, strings.ts
    │   └── main.ts
    └── tests/            Vitest, for src/core
```

*Why:* the same shape as `leoiot-pv/dashboard/`, so CI and deployment need nothing new; `core/` is kept free of three.js and the DOM so it runs in Vitest's node environment.

### D3. Stack: TypeScript, three.js and mqtt.js from npm, no UI framework

Vite, TypeScript (`tsc --noEmit` in `build`), Vitest, `three` (with `GLTFLoader`, `OrbitControls`, `CSS2DRenderer` from its addons) and `mqtt` (mqtt.js) for the broker connection. Both runtime libraries are pinned to an exact version in `package.json` when the component is set up; there is no CDN import map. The UI is a handful of buttons and one panel, written with plain DOM code.

Pinned on 2026-10-30: `three` 0.186.0 with `@types/three` 0.186.0 (0.187.0 had been published that day; a release is used only once it is some weeks old) and `mqtt` 5.16.1.

*Why:* kickoff D3 and the user's choice (2026-10-29): TypeScript as in `leoiot-pv`, mqtt.js because it speaks MQTT over WebSocket in the browser and reconnects by itself. *Alternative:* plain JavaScript as in legacy, `paho-mqtt` (both rejected on 2026-10-29).

### D4. Container: nginx on 8091, prefix `/3d/`, hashed and pre-compressed models

The image builds with `node:22-alpine` and serves `dist` from `nginx:stable-alpine` under `/usr/share/nginx/html/3d`, listening on 8091: `location = /healthz` (200), `location = /3d` (301 to `/3d/`), `location /3d/assets/` (long cache, `immutable`), `location /3d/` (`index.html` with `Cache-Control: no-cache`), everything else 404. `compose.yaml` publishes `127.0.0.1:8091:8091` only, with `restart: unless-stopped` and the health check `wget -q -O /dev/null http://127.0.0.1:8091/healthz`. It joins no network: the browser reaches the broker through the host's `/mqtt`, not through this container. No `.env` is needed.

The models live in `explorer/models/` and are imported with Vite's `?url` suffix, so the build copies them to `dist/assets/` with a content hash in the name. A changed model therefore gets a new name, and the long cache lifetime is safe. The build stage writes a gzip copy next to each `.gltf` (`gzip -k -9`) and nginx serves it with `gzip_static on` and the type `model/gltf+json` to browsers that accept gzip. Compressing once at build time avoids compressing about 192 MB on every request. Measured 2026-10-30: the six models are 191.2 MB, their gzip copies 49.8 MB (26 %), which is what a first visit downloads.

*Why the deviation from the kickoff's `public/models/`:* files in `public/` keep their names, so a long cache lifetime would keep an outdated model in browsers after an update. *Alternative:* on-the-fly `gzip on` (rejected: CPU for every download of large files).

### D5. All models are loaded up front

At start the explorer loads all six models in parallel, shows a loading screen with overall progress until all are parsed, and keeps each as its own scene graph in memory; switching views changes which one is visible. A failed download replaces the loading screen with an error and a "Try again" button that reloads the failed models.

*Why:* decided by the user on 2026-10-30, as legacy: one wait, then every switch is instant. The NFR allows a slow initial 3D load. *Alternatives:* load the whole building first and floors on demand, or in the background (rejected 2026-10-30).

### D6. Views

| View | Model shown | Heatmap |
|---|---|---|
| start, "Reset View" | `ModelFull` | no |
| Basement | `ModelU` | rooms starting with `U` |
| Ground floor | `ModelE` | `E` |
| Floor 1 | `Model1F` | `1` |
| Floor 2 | `Model2F` | `2` |
| Gym | `ModelT` | no |

The floor models are cumulative, which gives "a floor with the floors beneath it" without hiding anything (kickoff D6). The camera keeps its position when switching between views; only "Reset View" puts it back to the start position (legacy: `PerspectiveCamera` 45°, at (100, 80, 100) looking at the building; the exact values are tuned when the scene is built).

### D7. Rooms, materials and highlight

A node is a room when its name starts with `U`, `E`, `1`, `2` or `T`; its room id is the part before the first `_`. This is the legacy rule, re-implemented in `core/rooms.ts` and checked against the node names of all six models in a test that reads the names from the copied files. The name is read from `userData.name`: three.js' `GLTFLoader` removes dots and other reserved characters from `Object3D.name` (`U74.1` becomes `U741`) and keeps the original only there. Legacy read `Object3D.name`, so room `U74.1` could never match its data. Materials are replaced by name as in legacy (`GLAS` → transparent glass, `METALL` or `FENSTERRAHMEN` → metal, others → light base material); the exact look is tuned by eye. The selected room's parts get the highlight colour `#f1c40f`. A click (pointer released within 5 px of where it was pressed, so a drag does not select) is resolved with a raycast against the visible model. The nearest hit decides, as in legacy, with one refinement found while testing on 2026-10-30: the room meshes are flat patches lying almost on the floor slab (0.15–0.5 units apart along the ray), so a room hit within 0.5 units behind the nearest hit wins over it.

Walls, roof and windows in front of a room block the click. Decided by the user on 2026-10-30: clicking rooms from above is enough, clicking through windows is not wanted. So in the whole-building view, where the roof covers the rooms, no room can be clicked in practice, and the gym's deep rooms (walls 8 m high) can be clicked when the camera looks down into them. This narrows kickoff D6 ("room click works in every view").

### D8. Live data

`live/` builds the broker URL from `location` (`wss://<host>/mqtt` on https, `ws://<host>/mqtt` on http), connects with mqtt.js without credentials, subscribes once to the room-climate topics and hands every message with its topic to `core/store.ts`. The store parses and validates (spec "Messages are read as the contract specifies"), keeps the newest message per room by `ts`, and notifies the panel and the heatmap. A 10-second timer re-judges the age of all values (spec: re-judge at least every 10 s). Age is judged against the browser's clock; a `ts` in the future counts as current.

Two devices in one room publish on the same retained topic, so the explorer sees whichever came last; keeping the newest `ts` (kickoff default) also guards against a late, older message.

### D9. CO₂: continuous colour, exact FR-07 status beside it

Kickoff D9 (2026-10-29): the CO₂ heatmap uses a continuous scale so that 400 and 599 ppm look different; therefore 599 and 600 ppm look almost the same. FSD FR-07 and AC-04 ("CO2 colors render correctly at threshold boundaries") are met by the **status** — a coloured symbol with a text, decided by the exact limits < 600, 600–1200, > 1200 — shown in the info panel and in every heatmap label. AC-04 is tested on the status, not on the gradient.

Colour stops, confirmed by the user on 2026-10-30: green `#4caf50` at ≤ 400 ppm, yellow `#ffd54f` at 600, red `#e53935` at 1200, deeper red `#8e0000` at ≥ 2000, linear in RGB between stops. Status texts: "Good" (green), "Elevated" (yellow), "High" (red), held in `ui/strings.ts`.

### D10. Temperature

Kickoff D10: linear from `#8da1d6` at ≤ 20 °C to `#d68d8d` at ≥ 25 °C, label `21.3°C`. The FSD sets no temperature limits, so there is no temperature status.

### D11. Heatmap interaction

- Only the selected floor's rooms are coloured; the floors beneath keep their normal look (kickoff D6).
- Clicking a room switches the heatmap off, as in legacy (user, 2026-10-30).
- Switching floors keeps the heatmap and recolours the new floor; whole building, gym and "Reset View" switch it off (user, 2026-10-30).
- No data → normal look and label "No data"; stale → grey `#9e9e9e` with ⚠ and the last value (kickoff D11).
- Labels are `CSS2DObject`s at each room's bounding-box centre, one per room id.
- Turning a heatmap on removes the selection (the highlight and the heatmap colours would mix). A selection stays when switching views if the room exists in the new view.

### D12. Info panel and the temporary reading time

The panel shows room id, CO₂ with status, temperature with one decimal (kickoff D12), and for now the time of the newest reading formatted with `Intl.DateTimeFormat` in `Europe/Vienna` (date added when it is not today). The spec marks this as temporary; removing it is a task of the change that makes the explorer the main page. Humidity and `source` are not shown.

### D13. English only, texts in one module

All visible texts live in `src/ui/strings.ts` as one typed object (kickoff D7). `model3d-german-translation` adds a German object with the same keys and a switch.

### D14. Local development and test stack

Two ways to run it, both configured through defaults and environment variables only, so they work the same on every machine:

1. **Fast iteration**: `npm run dev` in `explorer/` serves the app at `http://localhost:5173/3d/`. The Vite dev server proxies `/mqtt` (WebSocket) to `EXPLORER_MQTT_TARGET`, default `ws://localhost:9001` (the development broker below); set it to `wss://vm23.htl-leonding.ac.at` to watch real data once the sensors team publishes. The app code is the same as in production: it always connects to `/mqtt` of its own host.
2. **Production-like test**: `docker compose -f leoiot-3d/compose.dev.yaml up --build` starts the real explorer image, a development Mosquitto (`eclipse-mosquitto:2`, listeners 1883 and 9001 WebSocket, anonymous publish allowed, ports bound to `127.0.0.1` only) and an nginx that behaves like the vm23 proxy for this app: `/3d` → 301, `/3d/` → explorer with the prefix kept, `/mqtt` → broker WebSocket with upgrade headers. Open `http://localhost:8000/3d/` (port `DEV_PROXY_PORT`, default 8000).

`dev/mosquitto.conf` and `dev/proxy.conf` are written new for this purpose; nothing is copied or mounted from `leoiot-platform/` or `legacy/`. They are development-only and never deployed (`compose.dev.yaml` is not a deploy unit).

**Development publisher** `explorer/dev/publish.mjs` (`npm run dev:publish`, `-- --once` for the fixed set only, broker `DEV_MQTT_URL`, default `mqtt://localhost:1883`) publishes retained messages that follow the contract (`source` = `simulated`, `ts` in ms, `device` = `dev-publisher`): rooms on every floor and in the gym with CO₂ at 399, 599, 600, 1200, 1201 and 2600 ppm and temperatures from 18 to 27.5 °C; one room with CO₂ only and one with temperature only; one stale room (`ts` 12 minutes old); some rooms left without a message; then a new reading for a few rooms every 5 seconds. `--clear` removes all retained messages it published. It can only publish to a broker that allows it; the vm23 broker refuses anonymous publishing.

*Why both:* the user chose a switchable data source and a production-like stack (2026-10-29/30). The stack catches what `npm run dev` hides: the nginx config, the `/3d/` prefix, caching and gzip of the models, `wss`/`ws` selection behind a proxy.

### D15. Tests and acceptance

- **Unit tests** (Vitest, `src/core`): room id from node name, floor from room id, node names of the copied models (D7), message parsing and validation, newest `ts` wins, empty retained message, stale at 5 min (exactly 5 min current), FR-07 status at 599/600/1200/1201, CO₂ and temperature colours at their stops and ends, heatmap room selection per floor, Vienna time formatting.
- **CI**: `node leoiot-3d/explorer`, `image leoiot-3d/explorer`, `compose leoiot-3d/compose.yaml`; `ci-ok` must be green.
- **Manual checklist** on the production-like stack (tasks group 7), every spec scenario that the unit tests do not cover.
- **Merge gate**: `ci-ok` green and the user (Jonas Leitner) has tried the explorer locally and approved it. No temporary, machine-specific workarounds in committed code. Problems that appear only on vm23 are fixed afterwards.

### Defaults (no team decision needed; change if wrong)

- The "running on vm 23" badge is not carried over.
- Desktop first; at 360 px the controls wrap but stay usable; legacy's mobile drawer belonged to navigation and is not built.

## Risks / Trade-offs

- [Every first visit downloads about 192 MB of glTF] → pre-compressed gzip (D4) and long-lived hashed assets; the compressed sizes are measured in task 3.4. Compression of the models themselves is the planned later change.
- [Six parsed models in memory may be heavy on weak devices] → accepted (desktop first, user decision D5); memory is noted during the manual check.
- [`ModelFull.gltf` (53 MB) triggers GitHub's 50 MB warning and the history grows by about 192 MB for good] → accepted by the team (kickoff D1); the models are committed once, unchanged.
- [Nothing publishes room climate on vm23 yet] → the empty state is specified and tested; the development publisher provides data locally. The sensors team (Elias Pointinger) is told when the explorer is live.
- [Browser clock differs from the collector's clock] → age is judged by the browser's clock as the contract allows; a `ts` in the future counts as current, so a fast collector clock never hides values.
- [The host's `/mqtt` limits connections per client address to 20] → the explorer opens one connection per tab and reconnects with mqtt.js' back-off.
- [Users do not see the app until the platform route is merged and nginx applied by hand] → intended (`platform-3d-route.md`, "Order").

## Migration Plan

1. Merge this change into `main` after the merge gate (D15). The next promotion starts the container on vm23 at `127.0.0.1:8091`; nothing changes for users.
2. Open the platform pull request from `docs/continuations/platform-3d-route.md`; it ships in the same or the next promotion; nginx is applied on vm23 by hand.
3. `/` keeps showing the legacy explorer. Retiring `legacy/frontend/` is a later step, after the explorer has replaced it as the main page.

Rollback: revert the merge. The deployment runs `docker compose up` for the units a commit touches; whether it stops the container of a unit whose folder was removed has not been checked, so the container may have to be stopped by hand on vm23 by someone with access. The legacy explorer is untouched throughout.

## Open Questions

None.
