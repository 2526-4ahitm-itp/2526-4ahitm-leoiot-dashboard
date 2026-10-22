# leoiot-platform

Broker, database, reverse proxy, deployment and CI, and the shared data contract (topics, payloads, measurements, fields, retention) that the other sub-projects rely on.

| | |
|---|---|
| **Owning team** | To be assigned — project lead until decided |
| **Status** | Broker, shared network and nginx configuration run from here (`platform-broker`); InfluxDB, Telegraf, Grafana, backup and `mqtt-ws-bridge` still run from `legacy/` |
| **Spec group** | `openspec/specs/platform/` |

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Replaces from `legacy/`

- `legacy/docker-compose.yaml`
- `legacy/config/` (done: `broker/`)
- `legacy/telegraf.conf`
- `legacy/grafana/`
- `legacy/deploy/nginx.conf` (done: `proxy/nginx.conf`)
- `legacy/backup/`
- `legacy/mqtt-ws-bridge/`

## What runs from here

| Path | What it is |
|---|---|
| `compose.yaml` | deploy unit `leoiot-platform`, deployed before `legacy` and the other units: the broker `mosquitto` and the shared network `2526-4ahitm-leoiot-dashboard_leoiot` |
| `broker/mosquitto.conf` | listeners: 1883 for devices and services with an account, 9001 (local only) for browsers over WebSocket |
| `broker/acl-websocket` | access of anonymous browsers: read `leoiot/room-climate/#`, nothing else |
| `broker/acl.example` | shape of the host-local `broker/acl` |
| `proxy/nginx.conf` | the host's nginx site, including `/mqtt`; applied by hand (see the operations page of the docs site) |

Specs: `openspec/specs/platform/broker/` and `openspec/specs/platform/data-contract/`. Other deploy units join the network as an external one and reach the broker as `mosquitto:1883`.

## Host-local files

`broker/pwfile` (passwords) and `broker/acl` (access rules of the accounts) are not in Git. The broker does not start without them. On a new host:

1. Create the password file with `mosquitto_passwd` (placeholders, no real values):

   ```bash
   docker run --rm -it -v "$PWD/broker:/mosquitto/config" eclipse-mosquitto:2.1.2-alpine \
     mosquitto_passwd -c /mosquitto/config/pwfile <USER>
   ```

   Without `-c` for every further account. On vm23 the file was taken over from the former `legacy/config/pwfile`.
2. Copy `broker/acl.example` to `broker/acl` and give every account of `pwfile` a block. An account without a block can connect but neither publish nor subscribe.
3. Make both files readable for the broker (`chmod 644`): the container mounts `broker/` read-only and runs as user `mosquitto`.

## Tech stack and scaffolding

The tech stack and the project scaffolding are decided in this sub-project's own first OpenSpec change (`platform-…`). Nothing is set up here yet.
