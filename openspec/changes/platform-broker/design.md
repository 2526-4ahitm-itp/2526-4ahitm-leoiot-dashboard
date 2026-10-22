# Design

## Context

See `proposal.md` for motivation. Current state, read from the repository (not checked on vm23):

| Fact | Source |
|---|---|
| Mosquitto runs as service `mosquitto` (`eclipse-mosquitto:latest`) in the Compose project `2526-4ahitm-leoiot-dashboard`, port `1883:1883`, config from `legacy/config/` | `legacy/docker-compose.yaml` |
| One listener on 1883, no anonymous access, a password file that is not in Git; no ACL, so every account may do everything; no persistence | `legacy/config/mosquitto.conf`, `legacy/README.md` |
| The legacy stack creates the network `leoiot` (actual name `2526-4ahitm-leoiot-dashboard_leoiot`) | `legacy/docker-compose.yaml` |
| `leoiot-pv` joins that network as external `platform`, default name `2526-4ahitm-leoiot-dashboard_leoiot`; its collector reaches `mqtt://mosquitto:1883` | `leoiot-pv/compose.yaml`, `leoiot-pv/collector/src/config.ts` |
| Five legacy services `depends_on: mosquitto` | `legacy/docker-compose.yaml` |
| Deploy order is platform, legacy, then the other units; a `compose.yaml` in `leoiot-platform/` makes it a unit | `.github/ci/deploy.sh`, `.github/ci/affected.sh` |
| CI and deployment already treat `leoiot-platform/**/nginx*.conf` as reverse-proxy files that are applied by hand, with a test case for `leoiot-platform/proxy/nginx.conf` | `.github/ci/affected.sh`, `.github/ci/affected.test.sh` |

## Goals / Non-Goals

**Goals:**

- The broker, its access rules, the shared network and the proxy configuration live in `leoiot-platform/` and keep working after `legacy/` is deleted.
- Devices, legacy services and `leoiot-pv` notice nothing apart from one short cutover.

**Non-Goals:**

- Moving InfluxDB, Telegraf, Grafana or `mqtt-ws-bridge`.
- Managing nginx from CI.

## Decisions

### D1. `leoiot-platform/` becomes a Compose deploy unit

`leoiot-platform/compose.yaml`, project name `leoiot-platform`, with one service `mosquitto` (an exact `2.0.x` image tag instead of `latest`). Broker files sit in `leoiot-platform/broker/`. *Why:* CI and deployment pick the unit up by shape and deploy it first, so the broker and the network exist before `legacy` and `leoiot-pv` start. *Alternative:* keep the broker in the legacy stack and only add files (rejected: everything there is deleted with `legacy/`).

### D2. The platform owns the network under its current name

The platform Compose file defines the network with the explicit name `2526-4ahitm-leoiot-dashboard_leoiot`. `legacy/docker-compose.yaml` declares it `external: true` with that name; `leoiot-pv` already does. *Why the old name:* `leoiot-pv`'s default `PLATFORM_NETWORK` and every running legacy container use it, so nothing outside the platform changes. *Consequence:* the existing network carries the legacy project's Compose labels. Compose 2.40 only warns about that and uses the network (checked locally on 2026-10-22), but vm23 runs Compose 5.1.1, and a dry run there (2026-10-22) shows that it removes and recreates such a network. That fails while other containers are attached, so the cutover removes the old network before the deployment creates the platform's (D8). *Alternatives:* a new network name (rejected: changes `leoiot-pv`); keeping it external everywhere and creating it with a script (rejected: nothing would own it, and a fresh host would need a manual step).

### D3. Two listeners with their own settings

| Listener | Reachable | Authentication | Access rules |
|---|---|---|---|
| TCP 1883 | host port 1883 (devices) and `mosquitto:1883` on the network | password file, no anonymous | `broker/acl` (host-local) |
| WebSocket 9001 | `127.0.0.1:9001` on the host only; nginx forwards `/mqtt` | anonymous | `broker/acl-websocket` (in Git): read `leoiot/room-climate/#` |

Per-listener settings let anonymous access exist only on the WebSocket listener. *Why 127.0.0.1:* the spec allows browsers only through the proxy, which also terminates TLS. *Alternative:* one listener with anonymous access plus ACL (rejected: devices could then connect without an account).

### D4. Access rules: reviewable where they protect, host-local where they name accounts

The WebSocket rules contain no account and are in Git, so the rule that keeps the public from publishing is reviewed with every change. The TCP rules name the existing accounts, whose names are known only on vm23; they live in a host-local `broker/acl` next to the host-local password file, both ignored by Git. `broker/acl.example` in Git shows the shape: each existing account gets `readwrite #` (spec "Existing accounts keep their access"), the sensors collector account gets `read #` and `write leoiot/room-climate/#`. *Alternative:* list the accounts in Git (rejected: half of a credential, and the device names are not in the repository).

### D5. Persistence on a new volume

`persistence true` with a platform volume. The legacy broker has no persistence, so there is no data to migrate; the legacy volume stays untouched and is cleaned up with `legacy/`.

### D6. The proxy configuration moves as it is, plus `/mqtt`

`legacy/deploy/nginx.conf` moves unchanged to `leoiot-platform/proxy/nginx.conf` (history kept with `git mv`), then gains a `location /mqtt` that forwards WebSocket upgrades to `127.0.0.1:9001` with a long read timeout. It is still applied by hand to `/etc/nginx/sites-available/leoiot`; the deployment already warns when the file changes. The legacy path in `.github/ci/affected.sh` then matches nothing and is harmless; removing it is left to a separate `.github/` pull request, as `AGENTS.md` asks for shared files.

### D7. What `legacy/` loses

Only removals: the `mosquitto` service, the `depends_on: mosquitto` entries, the network definition (replaced by the external reference of D2), the `mosquitto_data` volume declaration, and `legacy/config/`. The MQTT clients in legacy reconnect on their own, so the missing start order does no harm.

### D8. The cutover rides on the release deployment

The deploy job starts the platform unit before `legacy` and runs `docker compose up -d --remove-orphans` in each unit (`.github/ci/deploy.sh`), so it does most of the switch. Checked on vm23 on 2026-10-22: Compose 5.1.1, one broker account `leoiot`, `pwfile` mode 644, nginx identical to the repository file, `sudo` needs a password, and a dry run of the platform unit prints "a network with name 2526-4ahitm-leoiot-dashboard_leoiot exists but was not created for project leoiot-platform" followed by "Network … Removed". With the legacy and PV containers attached, that removal would fail in the middle of the deployment, so the old network is cleared first:

1. **Before the promotion**, after this change is on `main`: `leoiot-platform/broker/pwfile` (a copy of `legacy/config/pwfile`) and `broker/acl` (`leoiot` gets `readwrite #`) are created in the deploy checkout; both are ignored by the new commit, so the deployment's checkout keeps them. The dry run above is done from a temporary worktree.
2. **Right before the promotion pull request is merged:**
   1. the three `leoiot-pv` containers are disconnected from the network (`docker network disconnect`). They keep serving their pages on their local ports; only their database queries and live data pause;
   2. in `legacy/` of the deploy checkout, still on the previous release, `docker compose down` runs without `-v`. It removes the legacy containers, the old broker among them, and the network; all data volumes stay.
3. **The merge** starts the deployment: it checks out the new commit, starts the platform unit (a new network labelled for `leoiot-platform`, and the broker), then all legacy services, and runs the smoke test. `/kiosk/` and `/pv/` answer throughout.
4. **After the deployment:** the three `leoiot-pv` containers are connected to the new network again (`docker network connect`), without a restart, so the PV collector keeps its SolaX session. The sensors team lead applies `leoiot-platform/proxy/nginx.conf` with `sudo` and reloads nginx.

Legacy (`/dashboard/`, `/grafana/`, `/influx/`, the broker) is down for the length of the deployment, a few minutes while its Node services run `npm install`; PV live data pauses from step 2 to step 4. The `sensors-collector` account is not part of the cutover: it is added with `mosquitto_passwd` plus an `acl` block when the collector is built.

*Rollback:* if the deployment fails, the deploy checkout is put back on the previous `release` commit, `docker compose down` runs in `leoiot-platform/` if its unit started, `docker compose up -d` in `legacy/` brings back the network and the legacy broker, and the PV containers are connected again; the deployment marker only advances after a passed smoke test. After a completed deployment the same steps apply, plus restoring the old nginx file. *Alternatives:* taking the network over as it is (rejected: Compose 5.1.1 recreates it, see the dry run); a manual cutover with every unit stopped (rejected: it also takes the PV pages down).

## Risks / Trade-offs

- [A missing account in `broker/acl` locks a device or service out] → the example lists the known services; task 2.1 lists the accounts in the host's password file before the cutover, and step 5 checks every service and the real box.
- [Legacy and the broker are down for the length of the deployment] → promotion at a quiet time; devices and services reconnect on their own; the PV pages keep answering.
- [The PV containers stay disconnected if step 4 is forgotten] → step 4 is a task of its own (5.5) with a check that the collector writes again.
- [`docker compose down` in legacy removes data] → it runs without `-v`; named volumes, InfluxDB's among them, are never removed by `down`.
- [Anonymous WebSocket clients exhaust the broker] → connection limit on the WebSocket listener and in nginx.
- [nginx is applied wrongly by hand] → `nginx -t` before reload; the old file is kept for rollback.
- [The Kubernetes move (`platform-k8s-resources`) replaces this setup soon] → the access rules, listeners and network role carry over; only the Compose file is specific to vm23.

## Migration Plan

See D8: the cutover is the promotion of this change to `release`, with three steps by hand around it. `legacy/README.md` then records the removal with the date.

## Open Questions

- Which exact `2.0.x` patch version to pin; decided when the Compose file is written, from the current Mosquitto releases.
