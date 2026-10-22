# legacy/ — the previous LeoIoT implementation

This folder holds the system that runs on the school server today: the Docker Compose stack, all web apps and services, the sensor firmware and the backup scripts. The broker, the shared Docker network and the nginx configuration have moved to [`leoiot-platform/`](../leoiot-platform/).

**This folder is frozen.** It only receives changes that keep the running system working, or that remove parts a new implementation has replaced. No new features are added here. A feature request for an old app is specified for the corresponding new sub-project instead.

## Start the stack

Start the platform unit first: it runs the broker (`mosquitto`) and provides the network `2526-4ahitm-leoiot-dashboard_leoiot` that this stack joins. Without it `docker compose up` stops with "network … not found", and the MQTT services cannot connect. Then run Compose from this folder (not from the repository root):

```bash
(cd leoiot-platform && docker compose up -d)
cd legacy
docker compose up -d
```

All relative paths in `docker-compose.yaml` (`./frontend`, `./telegraf.conf`, `./grafana/...`) resolve inside this folder.

The Compose project name is pinned to `2526-4ahitm-leoiot-dashboard` in `docker-compose.yaml`, so the stack keeps the data volumes it used when it ran from the repository root. Do not remove the `name:` line.

> **The broker's password file has moved.** `legacy/config/` no longer exists. The password file and the access rules of the accounts are host-local files in `leoiot-platform/broker/` (`pwfile`, `acl`), not in Git; how to provide them on a new host is in [`leoiot-platform/README.md`](../leoiot-platform/README.md). The legacy services keep their accounts and still reach the broker as `mosquitto:1883`.

> The web apps run `npm install` into their bind-mounted folders on every start, so untracked `package-lock.json` files (owned by root) can appear here. They are harmless; delete them with `rm -f` if they get in the way.

## What replaces what

| Legacy part | Replaced by | Team |
|---|---|---|
| `docker-compose.yaml`, `telegraf.conf`, `grafana/`, `backup/`, `mqtt-ws-bridge/` | [`leoiot-platform/`](../leoiot-platform/) | to be assigned |
| `sensorbox/`, `fake-sensors/`, `backend/sensor-data-generator/`, sensor views of `dashboard-v2/` | [`leoiot-sensors/`](../leoiot-sensors/) | Sensoren |
| PV views of `dashboard-v2/` | [`leoiot-pv/`](../leoiot-pv/) | PV-Dashboard |
| `frontend/` | [`leoiot-3d/`](../leoiot-3d/) | 3D-Modell |

## Removed parts

- `solax-collector/` (Compose service `solax-collector`): replaced by `leoiot-pv/collector`, which runs in production on vm23 since 2026-10-14. The SolaX cloud keeps one session per account, so the old collector must not run again. The code is in the Git history before this removal.
- `kiosk/`, `kiosk2/`, `kiosk3/`, `kiosk4/`, `leogreenKiosk/` (Compose services `kiosk`, `kiosk2`, `kiosk3`, `kiosk4`, `leogreen-kiosk`, ports 8082 to 8085 and 8087), with `contextKiosk.md` and `continuations/02-leogreen-kiosk.md`: replaced by the main kiosk in `leoiot-pv/kiosk`, live at `/kiosk/` since 2026-10-13. `/leogreen/`, `/kiosk2/`, `/kiosk3/` and `/kiosk4/` redirect permanently (301) to `/kiosk/`. The code is in the Git history before this removal.
- Compose service `mosquitto` (the MQTT broker, port 1883) with `config/` and its volume `mosquitto_data`, the definition of the network `leoiot`, and `deploy/nginx.conf`: replaced by [`leoiot-platform/`](../leoiot-platform/) (change `platform-broker`), live on vm23 since the cutover (date added after it). The broker keeps the host name `mosquitto`, port 1883 and all accounts; the network keeps its name `2526-4ahitm-leoiot-dashboard_leoiot` and is now created by `leoiot-platform/compose.yaml`, so this stack joins it as an external network. The nginx configuration is now `leoiot-platform/proxy/nginx.conf`. The old files are in the Git history before this removal.

## More documentation

- [`README.adoc`](README.adoc): the full documentation of the old system (architecture, access points, deployment, backup).
- [`as-built-specs/`](as-built-specs/): as-built reference notes about the legacy dashboard and the conversion tracker. Not part of the active spec tree.
- [`project_overview.md`](project_overview.md): architecture notes for agents (services, ports, routes, data pipeline).
