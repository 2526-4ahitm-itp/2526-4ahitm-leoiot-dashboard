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

The platform Compose file defines the network with the explicit name `2526-4ahitm-leoiot-dashboard_leoiot`. `legacy/docker-compose.yaml` declares it `external: true` with that name; `leoiot-pv` already does. *Why the old name:* `leoiot-pv`'s default `PLATFORM_NETWORK` and every running legacy container use it, so nothing outside the platform changes. *Consequence:* the existing network carries the legacy project's Compose labels, and Compose does not adopt a network created by another project, so it is removed and recreated once at the cutover (D8). *Alternatives:* a new network name (rejected: changes `leoiot-pv`); keeping it external everywhere and creating it with a script (rejected: nothing would own it, and a fresh host would need a manual step).

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

### D8. One cutover on vm23

Because of D2, the switch is done by hand once, at a quiet time, before the release that contains this change is deployed:

1. Copy the host's `legacy/config/pwfile` to `leoiot-platform/broker/pwfile` and write `leoiot-platform/broker/acl` from the example with the real account names.
2. Stop `leoiot-pv` and the legacy stack; remove the network.
3. Start the platform unit (creates the network); start legacy and `leoiot-pv` from the new commit.
4. Apply the new nginx file and reload nginx.
5. Check the scenarios of `platform/broker` and the browser scenarios of `platform/data-contract`.

The release deployment that follows finds everything up to date. *Rollback:* stop all units, remove the network, check out the previous release and start legacy and `leoiot-pv` as before; restore the old nginx file.

## Risks / Trade-offs

- [A missing account in `broker/acl` locks a device or service out] → the example lists the known services; task 2.1 lists the accounts in the host's password file before the cutover, and step 5 checks every service and the real box.
- [The cutover stops PV kiosk and dashboard for a few minutes] → quiet time, announced to the PV team beforehand.
- [Anonymous WebSocket clients exhaust the broker] → connection limit on the WebSocket listener and in nginx.
- [nginx is applied wrongly by hand] → `nginx -t` before reload; the old file is kept for rollback.
- [The Kubernetes move (`platform-k8s-resources`) replaces this setup soon] → the access rules, listeners and network role carry over; only the Compose file is specific to vm23.

## Migration Plan

See D8. After the cutover, the release containing this change is promoted as usual; `legacy/README.md` records the removal with the date.

## Open Questions

- Which exact `2.0.x` patch version to pin; decided when the Compose file is written, from the current Mosquitto releases.
