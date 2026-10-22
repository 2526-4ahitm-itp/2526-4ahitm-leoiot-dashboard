# Proposal

## Why

`platform/data-contract` now requires browsers to read room-climate live data from the broker over MQTT over WebSocket at `/mqtt`, anonymously and read-only (`platform-data-contract-sensors`). The only broker runs from `legacy/docker-compose.yaml` with one TCP listener and no access rules, and the host's reverse-proxy configuration is `legacy/deploy/nginx.conf`. `legacy/` is frozen and will be deleted once every sub-project is rebuilt, so the WebSocket listener cannot be added there. The broker, the shared Docker network and the proxy configuration have to move into `leoiot-platform/`, which already claims them in its README, before the sensors dashboard and the 3D model can use the live data.

## What Changes

- `leoiot-platform/` becomes a deploy unit with its own `compose.yaml`: the broker (Mosquitto, pinned version) with
  - the TCP listener on port 1883 that devices and services use today, with the same host name `mosquitto`, the same accounts and passwords and no anonymous access;
  - a WebSocket listener, reachable only through the reverse proxy, with anonymous read-only access to `leoiot/room-climate/#`;
  - access rules: every existing account keeps the access it has today; a new account for the sensors collector may publish only on `leoiot/room-climate/#`;
  - persistence, so retained messages survive a restart.
- The platform creates the shared Docker network. `legacy/` and `leoiot-pv/` join it as an external network under its current name, so nothing in `leoiot-pv/` changes and both still start after `legacy/` is deleted.
- **BREAKING (for `legacy/`)** `legacy/docker-compose.yaml` loses its `mosquitto` service, the `depends_on` entries on it and its network definition; `legacy/config/` is removed. This is a removal the legacy freeze allows: the platform broker replaces it.
- The host's reverse-proxy configuration moves from `legacy/deploy/nginx.conf` to `leoiot-platform/proxy/nginx.conf` and gains the `/mqtt` route. It is still applied by hand on vm23.
- Signposts for other teams' agents: an entry under "Removed parts" in `legacy/README.md`, the `config/pwfile` note rewritten for the new location, the documentation pages that describe the broker and the proxy, and the status in `leoiot-platform/README.md`.

Not in this change:

- A WebSocket bridge or any change to `/ws`; the legacy `mqtt-ws-bridge` keeps running from `legacy/`.
- InfluxDB, Telegraf and Grafana. They stay in `legacy/` for now and move in later `platform-…` changes.
- Kubernetes (`platform-k8s-resources`). This change runs the broker with Compose on vm23; the cluster setup will take it from there.
- The sensors collector itself (`sensors-…`).

## Capabilities

### New Capabilities

- `platform/broker`: the shared MQTT broker: who can reach it, on which listeners, with which access, and that it keeps retained messages.

### Modified Capabilities

None. The browser access to the broker is already a requirement of `platform/data-contract`; this change implements it.

## Impact

- **vm23:** the cutover is the release deployment of this change (design D8): the password file is copied from the host's `legacy/config/` to the platform folder beforehand, the legacy broker is stopped right before the promotion is merged (about a minute without broker), and the new nginx configuration is applied by hand afterwards. `leoiot-pv` keeps running. Steps that need vm23 are done only on the explicit instruction of the sensors team lead.
- **Devices:** none. They keep connecting to port 1883 of vm23 with their current accounts.
- **`leoiot-pv/`:** none. Its default network name stays valid. The PV routes in the nginx configuration move with the file.
- **CI and deployment:** `leoiot-platform/` is picked up by shape (a `compose.yaml` in the sub-project root) and is deployed first, before `legacy` and the other units (`.github/ci/deploy.sh`). No workflow changes.
- **Docs:** `legacy/README.md`, `leoiot-platform/README.md`, `src/content/docs/{docs,en/docs}/{setup.md,interfaces.md,architecture.mdx}`, and the operations page where it names `legacy/deploy/nginx.conf`.
