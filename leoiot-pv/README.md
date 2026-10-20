# leoiot-pv

New PV data collection, PV dashboard and kiosk displays.

| | |
|---|---|
| **Owning team** | PV-Dashboard — Daniel Lettner, Stefan Schachner |
| **Status** | Main kiosk and collector live on vm23; dashboard still in legacy |
| **Spec group** | `openspec/specs/pv/` |

## Layout

- `compose.yaml`: the Compose project `leoiot-pv`
- `.env.example`: template for the local `.env`
- `shared/`: code the kiosk and the coming dashboard share (energy quantities, Vienna time, database query, number format, live channel), TypeScript sources with their tests
- `kiosk/`: the main kiosk
- `dashboard/`: the PV dashboard at `/pv/` (in progress, change `pv-dashboard`; not yet served on vm23)
- `collector/`: the PV collector for the SolaX cloud (Node, TypeScript, Vitest)

Each application is its own folder with its own `package.json` and `Dockerfile`; there is no workspace. The kiosk is Vite + TypeScript + Vitest, served by an nginx image. It uses `shared/` as a local package (`"@leoiot-pv/shared": "file:../shared"`, imports like `@leoiot-pv/shared/energy`); its image is therefore built with `leoiot-pv/` as the context, which `kiosk/build-context` declares for CI and `compose.yaml` for the deployment. A change in `shared/` makes CI check `shared/` and every app that uses it.

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Tests and running

Tests and build:

```
cd leoiot-pv/shared && npm ci && npm test && npm run build
cd ../kiosk && npm ci && npm test && npm run build
cd ../dashboard && npm ci && npm test && npm run build
```

Image as CI builds it, from the repository root: `.github/ci/image-build.sh leoiot-pv/kiosk` (or `leoiot-pv/dashboard`).

Container:

1. `cd leoiot-pv`
2. Copy `.env.example` to `.env` and enter the read token.
3. `docker compose up -d --build`
4. Open `http://localhost:8088/kiosk/` and `http://localhost:8089/pv/`.

The previous stack (`legacy/docker-compose.yaml`) must be running, because InfluxDB and the WebSocket bridge still live there.

## Variables

- `KIOSK_INFLUX_TOKEN` (required): read token for the bucket `server_data`; the dashboard uses the same token.
- `DASHBOARD_PORT` (optional, default `8089`): host port of the dashboard, bound to `127.0.0.1`.
- `KIOSK_PORT` (optional, default `8088`): host port, bound to `127.0.0.1`.
- `PLATFORM_NETWORK` (optional, default `2526-4ahitm-leoiot-dashboard_leoiot`): network of the previous stack.
- `COLLECTOR_*`: settings of the collector, only needed with the profile `collector`; see `collector/README.md`.

## What is live

- Main kiosk at `https://vm23.htl-leonding.ac.at/kiosk/` since 2026-10-13. The former kiosk addresses `/leogreen/`, `/kiosk2/`, `/kiosk3/` and `/kiosk4/` redirect permanently to it; the five old kiosks are removed from `legacy/`.
- Collector writing to `server_data` since 2026-10-14.

## Still in the previous system

- The PV views of `/dashboard/` (`legacy/dashboard-v2/`).

Rebuilding the PV views of the dashboard needs its own spec and its own `pv-…` change. This is open and must not be forgotten. Tracked in [#64](https://github.com/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard/issues/64).

## Planned

After the migration is finished, a second, more eye-catching kiosk at its own address. It should take over the content that only the removed kiosks of the previous system showed: weather, avoided CO₂, total yield over the lifetime, and the battery charge of the day.
