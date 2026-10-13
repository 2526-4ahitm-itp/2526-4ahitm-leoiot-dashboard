# leoiot-platform

Broker, database, reverse proxy, deployment and CI, and the shared data contract (topics, payloads, measurements, fields, retention) that the other sub-projects rely on.

| | |
|---|---|
| **Owning team** | To be assigned — project lead until decided |
| **Status** | Not started |
| **Spec group** | `openspec/specs/platform/` |

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Replaces from `legacy/`

- `legacy/docker-compose.yaml`
- `legacy/config/`
- `legacy/telegraf.conf`
- `legacy/grafana/`
- `legacy/deploy/nginx.conf`
- `legacy/backup/`
- `legacy/mqtt-ws-bridge/`

## Tech stack and scaffolding

The tech stack and the project scaffolding are decided in this sub-project's own first OpenSpec change (`platform-…`). Nothing is set up here yet.
