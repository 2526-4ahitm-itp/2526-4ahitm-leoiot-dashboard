# Tasks

## 1. Component

- [x] 1.1 Add `leoiot-3d/temporary-simulator/` with the generator and `--clear`; verify with `npm test` (values, rooms against the model files, FR-07 states) Done 2026-10-30: 4 tests on Node 22
- [x] 1.2 Add the Dockerfile; verify with `.github/ci/image-build.sh leoiot-3d/temporary-simulator` Done 2026-10-30
- [x] 1.3 Add the service behind a profile and `leoiot-3d/.env.example`; verify that `docker compose config --services` lists only `explorer` without `.env`, and both with the profile Done 2026-10-30: `explorer` without a profile, both with it; CI-style config with `.env.example` passes

## 2. Check

- [x] 2.1 Run it against the local test stack; verify that the explorer shows values for all floors and the gym, and that `--clear` empties the rooms Done 2026-10-30: the container through Compose against the local stack: 107 rooms, no "No data" or stale label on any of the four floors; `--clear` leaves 0 retained messages
- [x] 2.2 Update `leoiot-3d/README.md`; verify the commands run as written Done 2026-10-30
- [ ] 2.3 Run the affected checks, open the pull request, `ci-ok` is green

## 3. On vm23, by hand (not agents)

- [ ] 3.1 Create the broker account `model3d-simulator` and its access block in the host's `pwfile` and `acl`, and reload the broker
- [ ] 3.2 Write `leoiot-3d/.env` (`COMPOSE_PROFILES`, user, password) and start the service with the next deployment; verify the rooms show values at `/3d/`

## 4. Removal (when the sensors team publishes)

- [ ] 4.1 Follow "Removal" in `leoiot-3d/temporary-simulator/README.md`
