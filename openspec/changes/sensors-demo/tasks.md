# Tasks

## 1. Demo component

- [x] 1.1 Add `leoiot-sensors/demo/` (room list, value model, publisher, database writer, backfill, `--clear`, README with Dump); verify with `npm test`
- [x] 1.2 Add the Dockerfile and the `demo` service behind the profile `demo` in `leoiot-sensors/compose.yaml`; verify `docker compose config --services` lists `demo` only with the profile, and the CI compose check with `.env.example` passes
- [x] 1.3 Run it against the local collector stack; verify 106 live messages without room 105, points with `device` = `demo` for the last 7 days, the explorer and the dashboard show the rooms, and `--clear` removes both and leaves room 105

## 2. Ship and run

- [x] 2.1 Run the affected checks, open the pull request, `ci-ok` is green
- [x] 2.2 After the release, with Elias Pointinger's OK: set `COMPOSE_PROFILES=demo` in `leoiot-sensors/.env` on vm23 and start the service; verify the 3D maps and the dashboard show all rooms
