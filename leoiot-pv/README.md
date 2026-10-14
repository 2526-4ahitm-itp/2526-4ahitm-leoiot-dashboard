# leoiot-pv

New PV data collection, PV dashboard and kiosk displays.

| | |
|---|---|
| **Owning team** | PV-Dashboard — Daniel Lettner, Stefan Schachner |
| **Status** | Main kiosk live; collector built, not yet switched; dashboard still in legacy |
| **Spec group** | `openspec/specs/pv/` |

## Layout

- `compose.yaml`: the Compose project `leoiot-pv`
- `.env.example`: template for the local `.env`
- `kiosk/`: the main kiosk
- `collector/`: the PV collector for the SolaX cloud (Node, TypeScript, Vitest)

Each application is its own folder with its own `package.json` and `Dockerfile`; there is no shared workspace. The kiosk is Vite + TypeScript + Vitest, served by an nginx image. Later applications (`collector/`, a second kiosk) follow the same pattern.

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Tests and running

Tests and build:

```
cd leoiot-pv/kiosk && npm ci && npm test && npm run build
```

Container:

1. `cd leoiot-pv`
2. Copy `.env.example` to `.env` and enter the read token.
3. `docker compose up -d --build`
4. Open `http://localhost:8088/kiosk/`.

The previous stack (`legacy/docker-compose.yaml`) must be running, because InfluxDB and the WebSocket bridge still live there.

## Variables

- `KIOSK_INFLUX_TOKEN` (required): read token for the bucket `server_data`.
- `KIOSK_PORT` (optional, default `8088`): host port, bound to `127.0.0.1`.
- `PLATFORM_NETWORK` (optional, default `2526-4ahitm-leoiot-dashboard_leoiot`): network of the previous stack.
- `COLLECTOR_*`: settings of the collector, only needed with the profile `collector`; see `collector/README.md`.

## What is live

The kiosk is built for `/kiosk/`. The switch on the host is a manual step and has not happened yet.

## Still in the previous system

- The collector that is in production (`legacy/solax-collector/`). The new one in `collector/` replaces it at a planned switch; until then it runs only on request (Compose profile `collector`). The SolaX cloud keeps one session per account, so the two must never run at the same time.
- The PV views of `/dashboard/` (`legacy/dashboard-v2/`).

Rebuilding the PV views of the dashboard needs its own spec and its own `pv-…` change. This is open and must not be forgotten. An issue link will be added later.

## Planned

After the migration is finished, a second, more eye-catching kiosk at its own address. It should take over the content that only the removed kiosks of the previous system showed: weather, avoided CO₂, total yield over the lifetime, and the battery charge of the day.
