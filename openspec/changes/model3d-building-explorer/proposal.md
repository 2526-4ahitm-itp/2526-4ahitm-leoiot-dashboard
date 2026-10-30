# Proposal

## Why

The 3D building explorer that runs on vm23 today is `legacy/frontend/`: it holds an InfluxDB administrator token in browser code, reads legacy sensor data (`room_temperature`, `nili3/…`, the `/ws` bridge) instead of the `room_climate` contract, has no stale-data marker (FR-08), uses CO₂ limits that differ from FR-07 and runs as a Vite development server in production. `leoiot-3d/` is the sub-project that replaces it and has not started. This first change builds the explorer in `leoiot-3d/` on the platform contract, so the 3D-Modell team has a working base that later changes (navigation, German) extend.

## What Changes

- New application `leoiot-3d/explorer/`: a three.js building explorer at the address `/3d/`, built with Vite and TypeScript and served by nginx from its own container on `127.0.0.1:8091`. It holds no token and needs no configuration.
- Building view: the whole building at start, floor buttons for basement, ground floor, floor 1, floor 2 (each with the floors beneath it) and the gym (alone), "Reset View", a loading screen until all models are loaded.
- Room climate: clicking a room highlights it and opens an info panel with room id, CO₂ (with FR-07 status) and temperature, updated live; "No data for room" without a message; a warning symbol and the last values when the newest reading is older than 5 minutes. For now the panel also shows the time of the last reading (temporary, D12 of the kickoff).
- Heatmaps: temperature and CO₂ colouring of the selected floor's rooms with value labels, updated live; uncoloured "No data" rooms; grey stale rooms with a warning symbol.
- Live data only from the broker at `/mqtt` (`leoiot/room-climate/#`, retained messages); no database access.
- The glTF models of `legacy/frontend/` are copied into `leoiot-3d/` as they are (ModelU, ModelE, Model1F, Model2F, ModelFull, ModelT; about 192 MB), a deliberate exception to "copy nothing from legacy" for data assets.
- Deploy unit `leoiot-3d/compose.yaml`; a local test stack `leoiot-3d/compose.dev.yaml` (not deployed) with the production image, a development broker and a proxy that behaves like vm23; a development publisher for simulated room-climate messages.
- Not in this change: the proxy route `/3d/` on vm23 (separate platform pull request, `docs/continuations/platform-3d-route.md`), navigation to a room (`model3d-room-navigation`), German UI (`model3d-german-translation`, FSD AC-12), history from the database, model compression.

## Capabilities

### New Capabilities

- `model3d/building-viewer`: loading the models, the start view, floor and gym views, reset, camera controls, the loading screen, the address `/3d/`.
- `model3d/room-climate-view`: room selection by click, highlight, info panel with live CO₂ and temperature, FR-07 status, stale marker, "No data for room", how live room-climate messages are read and judged.
- `model3d/room-heatmap`: temperature and CO₂ heatmaps of the selected floor, colour scales, labels, live updates, rooms without current data.

### Modified Capabilities

None.

## Impact

- **Data**: only `platform/data-contract` (room-climate live data on `/mqtt`, room ids) and `platform/broker` (WebSocket listener reached through `/mqtt`). No new interface, no `platform-…` change.
- **New code**: `leoiot-3d/explorer/`, `leoiot-3d/compose.yaml`, `leoiot-3d/compose.dev.yaml`, `leoiot-3d/dev/`; `leoiot-3d/README.md` updated.
- **Repository size**: about 192 MB of glTF text; `ModelFull.gltf` (53 MB) triggers GitHub's 50 MB warning on push. Accepted by the team; compression is a later change.
- **CI**: `node leoiot-3d/explorer`, `image leoiot-3d/explorer`, `compose leoiot-3d/compose.yaml`.
- **Deployment**: after the merge the container runs on vm23 on `127.0.0.1:8091`, but users reach it only once the platform route `/3d/` is merged and applied. `/` keeps showing the legacy explorer.
- **FSD deviation**: English only (AC-12 deferred to `model3d-german-translation`).
- **Live data on vm23**: nothing publishes `leoiot/room-climate/#` yet (the sensors collector and simulator are `sensors-…` changes), so on vm23 every room shows "No data for room" until they publish. Local testing uses the development publisher.
