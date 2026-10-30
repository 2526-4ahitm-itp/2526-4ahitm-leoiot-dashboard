# leoiot-3d

New 3D building model and navigation.

| | |
|---|---|
| **Owning team** | 3D-Modell — Paul Kreinecker, Jonas Leitner |
| **Status** | In development: `model3d-building-explorer` |
| **Spec group** | `openspec/specs/model3d/` (changes are named `model3d-…`) |
| **Address** | `/3d/` (container on `127.0.0.1:8091`) |

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

One exception, decided by the team: the glTF models in `explorer/models/` were copied from `legacy/frontend/` (data assets only, design D1 of `model3d-building-explorer`, which also records the edit to `Model1F.gltf` and `Model2F.gltf`).

## Replaces from `legacy/`

- `legacy/frontend/`

## Layout

```
leoiot-3d/
├── compose.yaml          deploy unit: the explorer on 127.0.0.1:8091
├── compose.dev.yaml      local test stack, never deployed
├── dev/                  configuration of the local test stack
└── explorer/             the 3D building explorer (Vite, TypeScript, three.js, mqtt.js)
    ├── models/           the building models (glTF)
    ├── dev/publish.mjs   development publisher of simulated room-climate readings
    ├── src/core/         pure logic, unit-tested
    ├── src/live/         broker connection
    ├── src/scene/        three.js scene
    ├── src/ui/           buttons, panel, texts (ui/strings.ts)
    └── tests/
```

## Live data

The explorer reads the room-climate live data of `platform/data-contract` from `/mqtt` of the host that served the page, without credentials. It has no token and no configuration. On vm23 every room shows "No data for room" until the sensors collector or simulator publishes.

## Develop and test

Node 22 and Docker with Compose. All commands below run from `leoiot-3d/`.

**Unit tests and build** (what CI runs):

```bash
cd explorer
npm ci
npm test
npm run build
```

**Fast iteration** with the Vite dev server at <http://localhost:5173/3d/>. It forwards `/mqtt` to the development broker:

```bash
docker compose -f compose.dev.yaml up -d mosquitto
cd explorer
npm run dev
```

To watch the real broker on vm23 instead (read-only), start the dev server with `EXPLORER_MQTT_TARGET=wss://vm23.htl-leonding.ac.at npm run dev`.

**Production-like test**: the real explorer image behind a proxy that behaves like vm23 (`/3d/` and `/mqtt` on one host), at <http://localhost:8000/3d/>:

```bash
docker compose -f compose.dev.yaml up -d --build
```

**Test data**: publish simulated readings to the development broker (both ways above use it):

```bash
cd explorer
npm run dev:publish              # fixed set, live updates every 5 s, fixed set again every minute; Ctrl+C stops
npm run dev:publish -- --once    # fixed set only
npm run dev:publish -- --clear   # remove what it published
```

The fixed set covers every floor and the gym: CO₂ at the FR-07 limits (599/600, 1200/1201 ppm), rooms with CO₂ or temperature only, two stale rooms (`154`, `E581`) and rooms without any message (for example `106`, `U08`).

**Stop the stack**: `docker compose -f compose.dev.yaml down`.

Ports (all on `127.0.0.1`, changeable with the variables): proxy 8000 (`DEV_PROXY_PORT`), broker 1883 (`DEV_MQTT_PORT`) and 9001 WebSocket (`DEV_MQTT_WS_PORT`), dev server 5173. The publisher uses `DEV_MQTT_URL` (default `mqtt://localhost:1883`).
