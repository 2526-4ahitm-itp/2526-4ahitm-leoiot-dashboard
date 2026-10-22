# Tasks

Tasks marked **(human, vm23)** need a shell on the host and are done only on the explicit instruction of the sensors team lead. Passwords and account files never enter the repository.

## 1. Broker unit

- [x] 1.1 Create `leoiot-platform/compose.yaml` (project `leoiot-platform`, service `mosquitto` on an exact `2.0.x` image tag, ports `1883:1883` and `127.0.0.1:9001:9001`, a persistence volume, and the network with the explicit name `2526-4ahitm-leoiot-dashboard_leoiot`); verify `docker compose -f leoiot-platform/compose.yaml config -q` passes
- [x] 1.2 Add `leoiot-platform/broker/`: `mosquitto.conf` (per-listener settings, TCP 1883 with password file and `acl`, WebSocket 9001 anonymous with `acl-websocket`, persistence, a connection limit on 9001), `acl-websocket` (read `leoiot/room-climate/#` only), `acl.example` (existing accounts `readwrite #`, sensors collector `read #` and `write leoiot/room-climate/#`), and Git ignores for `pwfile` and `acl`; verify `git check-ignore leoiot-platform/broker/pwfile leoiot-platform/broker/acl` names both
- [ ] 1.3 Run the unit locally with a throwaway password file and `acl` (one legacy-style account, one collector account) and check every scenario of `specs/platform/broker/spec.md` that can run locally, plus the three browser scenarios of `platform/data-contract` against `ws://127.0.0.1:9001`; verify each scenario's result is noted in this task's pull request

## 2. Legacy removal

- [x] 2.1 In `legacy/docker-compose.yaml` remove the `mosquitto` service, every `depends_on: mosquitto`, and the `mosquitto_data` volume declaration, and declare the network `leoiot` as `external: true` with the name `2526-4ahitm-leoiot-dashboard_leoiot`; remove `legacy/config/`; verify `docker compose -f legacy/docker-compose.yaml config -q` passes and `grep -n mosquitto legacy/docker-compose.yaml` shows only `MQTT_HOST` values
- [ ] 2.2 In a pull request of its own (`.github/` is shared), remove the line `legacy/config/ mosquitto` from `.github/ci/legacy-services.map` and update the matching case in `.github/ci/affected.test.sh`, so that a release without `legacy/config/` does not try to recreate the removed legacy service `mosquitto`; it is merged before this change is promoted to `release`. Verify `bash .github/ci/affected.test.sh` passes

## 3. Reverse proxy

- [ ] 3.1 Move `legacy/deploy/nginx.conf` to `leoiot-platform/proxy/nginx.conf` with `git mv` and add `location /mqtt` forwarding WebSocket upgrades to `127.0.0.1:9001` with a long read timeout; verify `git log --follow leoiot-platform/proxy/nginx.conf` shows the old history, the diff against the old file is only the new block, and `nginx -t` passes for the file in an nginx container with certificate paths stubbed

## 4. Signposts for other teams' agents

- [x] 4.1 Add an entry under "Removed parts" in `legacy/README.md` naming `mosquitto`, `config/`, `deploy/nginx.conf` and the network definition as replaced by `leoiot-platform/`, with the date the platform broker went live (filled in after task 5.2); verify the entry exists and points to `leoiot-platform/`
- [x] 4.2 Rewrite the `config/pwfile` note in `legacy/README.md` so it says the password file and `acl` now live in `leoiot-platform/broker/` and are copied there on a new host; verify `grep -n "legacy/config" legacy/README.md` finds no instruction to copy files there
- [x] 4.3 Update `leoiot-platform/README.md`: status, what runs from the folder (broker, network, proxy configuration), and how to provide `broker/pwfile` and `broker/acl` on a host; verify the README no longer says "Not started"
- [x] 4.4 Update `src/content/docs/{docs,en/docs}/{setup.md,interfaces.md,architecture.mdx}` and the operations pages wherever they place the broker, its config or `nginx.conf` in `legacy/`; verify `grep -rn -E "legacy/config|legacy/deploy/nginx.conf" src/content/docs` finds nothing outdated and `npm run build` at the root succeeds

## 5. Cutover (design D8)

- [ ] 5.1 **(human, vm23)** List the account names in the host's `legacy/config/pwfile` (names only), write `leoiot-platform/broker/acl` from the example, copy the password file to `leoiot-platform/broker/pwfile`, and add the sensors collector account; verify every name in the password file has a line in `acl`
- [ ] 5.2 **(human, vm23)** At a quiet time announced to the PV team: stop `leoiot-pv` and legacy, remove the network, start the platform unit, then legacy and `leoiot-pv` from the commit of this change; verify `docker network inspect 2526-4ahitm-leoiot-dashboard_leoiot` shows the Compose project `leoiot-platform` and all containers of the three units run
- [ ] 5.3 **(human, vm23)** Apply `leoiot-platform/proxy/nginx.conf` to `/etc/nginx/sites-available/leoiot`, keeping the old file; verify `nginx -t` passes, nginx reloads and every route in `.github/ci/smoke-routes` answers
- [ ] 5.4 Check on the running system: the real box `nili3` still delivers (recent points in `mqtt_consumer`), the PV kiosk shows live data, a browser can subscribe at `wss://vm23.htl-leonding.ac.at/mqtt`, an anonymous publish there is not delivered, and retained messages survive `docker compose restart mosquitto`; verify each check is noted in the pull request

## 6. Close

- [ ] 6.1 Verify `openspec validate platform-broker --strict` passes, then archive the change after task 5.4 so `openspec/specs/platform/broker/spec.md` exists
