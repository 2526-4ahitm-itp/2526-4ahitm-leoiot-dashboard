# Tasks

Tasks marked **(vm23)** run on the host; **(human, vm23)** ones need `sudo` and are done by the sensors team lead himself. Passwords and account files never enter the repository.

## 1. Broker unit

- [x] 1.1 Create `leoiot-platform/compose.yaml` (project `leoiot-platform`, service `mosquitto` on an exact `2.0.x` image tag, ports `1883:1883` and `127.0.0.1:9001:9001`, a persistence volume, and the network with the explicit name `2526-4ahitm-leoiot-dashboard_leoiot`); verify `docker compose -f leoiot-platform/compose.yaml config -q` passes
- [x] 1.2 Add `leoiot-platform/broker/`: `mosquitto.conf` (per-listener settings, TCP 1883 with password file and `acl`, WebSocket 9001 anonymous with `acl-websocket`, persistence, a connection limit on 9001), `acl-websocket` (read `leoiot/room-climate/#` only), `acl.example` (existing accounts `readwrite #`, sensors collector `read #` and `write leoiot/room-climate/#`), and Git ignores for `pwfile` and `acl`; verify `git check-ignore leoiot-platform/broker/pwfile leoiot-platform/broker/acl` names both
- [x] 1.3 Run the unit locally with a throwaway password file and `acl` (one legacy-style account, one collector account) and check every scenario of `specs/platform/broker/spec.md` that can run locally, plus the three browser scenarios of `platform/data-contract` against `ws://127.0.0.1:9001`; verify each scenario's result is noted in this task's pull request

## 2. Legacy removal

- [x] 2.1 In `legacy/docker-compose.yaml` remove the `mosquitto` service, every `depends_on: mosquitto`, and the `mosquitto_data` volume declaration, and declare the network `leoiot` as `external: true` with the name `2526-4ahitm-leoiot-dashboard_leoiot`; remove `legacy/config/`; verify `docker compose -f legacy/docker-compose.yaml config -q` passes and `grep -n mosquitto legacy/docker-compose.yaml` shows only `MQTT_HOST` values
- [x] 2.2 Remove the line `legacy/config/ mosquitto` from `.github/ci/legacy-services.map` and update the matching case in `.github/ci/affected.test.sh`, so that a release without `legacy/config/` does not try to recreate the removed legacy service `mosquitto`. `affected.test.sh` requires the map and `legacy/docker-compose.yaml` to match in both directions, so this lands in the same pull request as task 2.1, as an exception to the rule that `.github/` changes get a pull request of their own (CI then runs every check); decided by the sensors team lead on 2026-10-22. Verify `bash .github/ci/affected.test.sh` passes in CI

## 3. Reverse proxy

- [x] 3.1 Move `legacy/deploy/nginx.conf` to `leoiot-platform/proxy/nginx.conf` with `git mv` and add `location /mqtt` forwarding WebSocket upgrades to `127.0.0.1:9001` with a long read timeout; verify `git log --follow leoiot-platform/proxy/nginx.conf` shows the old history, the diff against the old file is only the new block, and `nginx -t` passes for the file in an nginx container with certificate paths stubbed

## 4. Signposts for other teams' agents

- [x] 4.1 Add an entry under "Removed parts" in `legacy/README.md` naming `mosquitto`, `config/`, `deploy/nginx.conf` and the network definition as replaced by `leoiot-platform/`, with the date the platform broker went live (filled in by task 5.6); verify the entry exists and points to `leoiot-platform/`
- [x] 4.2 Rewrite the `config/pwfile` note in `legacy/README.md` so it says the password file and `acl` now live in `leoiot-platform/broker/` and are copied there on a new host; verify `grep -n "legacy/config" legacy/README.md` finds no instruction to copy files there
- [x] 4.3 Update `leoiot-platform/README.md`: status, what runs from the folder (broker, network, proxy configuration), and how to provide `broker/pwfile` and `broker/acl` on a host; verify the README no longer says "Not started"
- [x] 4.4 Update `src/content/docs/{docs,en/docs}/{setup.md,interfaces.md,architecture.mdx}` and the operations pages wherever they place the broker, its config or `nginx.conf` in `legacy/`; verify `grep -rn -E "legacy/config|legacy/deploy/nginx.conf" src/content/docs` finds nothing outdated and `npm run build` at the root succeeds

## 5. Cutover with the release deployment (design D8)

Steps on vm23 are done by Claude over SSH (allowed by the sensors team lead on 2026-10-22) except where `sudo` is needed; nothing there is stopped or changed before he says go.

- [ ] 5.1 **(vm23)** After this change is merged into `main`: create `leoiot-platform/broker/` in the deploy checkout `/home/solmqadmin/2526-4ahitm-leoiot-dashboard`, copy `legacy/config/pwfile` to `leoiot-platform/broker/pwfile`, and write `leoiot-platform/broker/acl` with a block `user leoiot` / `topic readwrite #`, both mode 644; verify every name in `pwfile` (`cut -d: -f1`) has a block in `acl` and `git status` in the checkout shows neither file
- [ ] 5.2 **(vm23)** Dry-run the platform unit from the `main` commit in a temporary worktree (`docker compose --dry-run up -d`) and remove the worktree again; verify Compose 5.1.1 accepts the existing network `2526-4ahitm-leoiot-dashboard_leoiot` (a warning is fine, an error stops the cutover and falls back to recreating the network)
- [ ] 5.3 Open the promotion pull request `main` → `release` on request; right before the sensors team lead merges it, **(vm23)** stop the legacy broker (`docker stop 2526-4ahitm-leoiot-dashboard-mosquitto-1`); verify port 1883 is free on vm23 before the merge, and the deploy run (`.github/workflows/deploy.yml`) ends green, smoke test included
- [ ] 5.4 **(vm23)** After the deployment: verify the container `leoiot-platform-mosquitto-1` runs and listens on 1883 and on `127.0.0.1:9001`, the old container `2526-4ahitm-leoiot-dashboard-mosquitto-1` is gone, the broker log shows the legacy services and the PV collector connecting as `leoiot`, and `leoiot-pv` kept running
- [ ] 5.5 **(human, vm23)** The sensors team lead applies the nginx file with `sudo`: keep `/etc/nginx/sites-available/leoiot` as a copy, copy `leoiot-platform/proxy/nginx.conf` over it, `sudo nginx -t`, `sudo systemctl reload nginx`; verify every route in `.github/ci/smoke-routes` still answers
- [ ] 5.6 Check on the running system: the real box `nili3` still delivers (recent points in `mqtt_consumer`), the PV kiosk shows live data, a browser can subscribe at `wss://vm23.htl-leonding.ac.at/mqtt`, an anonymous publish there is not delivered, and retained messages survive `docker compose restart mosquitto`; then fill in the date in the "Removed parts" entry of `legacy/README.md` (task 4.1) in a docs pull request; verify each check is noted in that pull request

## 6. Close

- [ ] 6.1 Verify `openspec validate platform-broker --strict` passes, then archive the change after task 5.6 so `openspec/specs/platform/broker/spec.md` exists
