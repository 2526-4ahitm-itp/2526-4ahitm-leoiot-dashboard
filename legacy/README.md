# legacy/ — the previous LeoIoT implementation

This folder holds the system that runs on the school server today: the Docker Compose stack, all web apps and services, the sensor firmware, the backup scripts and the nginx configuration.

**This folder is frozen.** It only receives changes that keep the running system working, or that remove parts a new implementation has replaced. No new features are added here. A feature request for an old app is specified for the corresponding new sub-project instead.

## Start the stack

Run Compose from this folder (not from the repository root):

```bash
cd legacy
docker compose up -d
```

All relative paths in `docker-compose.yaml` (`./frontend`, `./config`, `./telegraf.conf`, `./grafana/...`) resolve inside this folder.

> The Compose project name is derived from the directory name. Run from `legacy/` it is `legacy`, which would create new, empty data volumes on a host that ran the stack from the repository root before. On the production host the project name has to be pinned first; see the `restructure-for-rewrite` OpenSpec change.

## What replaces what

| Legacy part | Replaced by | Team |
|---|---|---|
| `docker-compose.yaml`, `config/`, `telegraf.conf`, `grafana/`, `deploy/nginx.conf`, `backup/`, `mqtt-ws-bridge/` | [`leoiot-platform/`](../leoiot-platform/) | to be assigned |
| `sensorbox/`, `fake-sensors/`, `backend/sensor-data-generator/`, sensor views of `dashboard-v2/` | [`leoiot-sensors/`](../leoiot-sensors/) | Sensoren |
| `solax-collector/`, `kiosk*/`, `leogreenKiosk/`, PV views of `dashboard-v2/` | [`leoiot-pv/`](../leoiot-pv/) | PV-Dashboard |
| `frontend/` | [`leoiot-3d/`](../leoiot-3d/) | 3D-Modell |

## More documentation

- [`README.adoc`](README.adoc): the full documentation of the old system (architecture, access points, deployment, backup).
- [`as-built-specs/`](as-built-specs/): as-built reference notes about the legacy dashboard and the conversion tracker. Not part of the active spec tree.
- [`project_overview.md`](project_overview.md): architecture notes for agents (services, ports, routes, data pipeline).
