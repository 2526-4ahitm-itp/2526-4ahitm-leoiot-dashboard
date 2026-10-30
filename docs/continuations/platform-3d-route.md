# platform-3d-route

Continuation prompt for the reverse-proxy route of the new 3D building explorer. Planned 2026-10-28 by the 3D-Modell team (Paul Kreinecker, Jonas Leitner) together with `docs/continuations/model3d-rewrite-kickoff.md`; read that prompt for the 3D app itself. Nothing of this is implemented yet.

## State

- **Branch / change:** none yet. Planned branch `feat/platform-3d-route`, created from `origin/main` in its own worktree (`AGENTS.md`). No OpenSpec change: no platform spec covers proxy routes, and a route is not a data interface.
- **Depends on:** the 3D app from the change `model3d-building-explorer` (`leoiot-3d/`), which serves its build under `/3d/` on `127.0.0.1:8091`. It does not exist yet.
- **Next step:** when the 3D app is ready to ship, open this pull request so that both go out in the same release (see "Order").

## Goal

The new 3D app is reachable at `https://vm23.htl-leonding.ac.at/3d/`. The main page `/` stays exactly as it is today (legacy 3D explorer on `127.0.0.1:8080`). Making `/` open the new app is a later iteration (below).

## Why a separate pull request

The route only concerns 3D, but the files belong to the platform or are shared: `leoiot-platform/` is owned by the platform, `.github/` and root files are shared (`AGENTS.md`: change them in a pull request of their own). A change in `.github/` makes CI run every check.

## Changes

### 1. `leoiot-platform/proxy/nginx.conf`

This file is the repository copy of the host's nginx site. Add two blocks next to the PV blocks (`location = /pv/ws`, `location /pv/`), in the same style. Nothing else in the file changes.

```nginx
# 3D building explorer of leoiot-3d (leoiot-3d/compose.yaml)
location = /3d { return 301 /3d/$is_args$args; }

location /3d/ {
    proxy_pass http://127.0.0.1:8091;
    proxy_set_header Host $host;
}
```

- `location = /3d` sends `/3d` without slash permanently (301) to `/3d/`, like the existing `/kiosk` and `/dashboard` redirects. 301 is fine here because it never changes.
- `proxy_pass` has no trailing slash, so the `/3d/` prefix is passed on; the 3D container serves its files under `/3d/` (as the PV dashboard does under `/pv/`), and Vite builds with `base: '/3d/'`.
- nginx picks the longest matching prefix, so `/3d/` wins over the catch-all `location /` wherever the block stands.
- Port 8091 is free. Ports in use: 1883, 3000, 8080, 8081, 8086, 8088, 8089, 8090, 9001. `leoiot-3d/compose.yaml` binds 8091 to `127.0.0.1` only.
- No WebSocket block is needed: the app gets live data from the existing `location = /mqtt`.

### 2. `.github/ci/smoke-routes`

Add the line `/3d/`. After every deployment the runner requests each listed route through nginx and fails the deployment if one does not answer with 2xx within 5 minutes (`src/content/docs/en/docs/operations.md`, "Check after the deployment"). The rule that a sub-project adds its routes there is also in the unarchived change `openspec/changes/platform-cicd-pipeline/specs/platform/release-deployment/spec.md`.

### 3. `src/content/docs/en/docs/operations.md`, section "Nginx routing"

Add a row to the route table, e.g.

```
| `/3d/` | `127.0.0.1:8091` (3D building explorer from `leoiot-3d/`, prefix kept) |
```

and mention `/3d` in the sentence about paths without trailing slash that are redirected with 301. Note: the table has no row for `/pv/` either; adding it in the same pull request is optional.

## Checks before pushing

`.github/ci/affected.sh origin/main HEAD` – expect `docs true` and the checks triggered by `.github/` (every check). Run `npm ci && npm run build` at the root (Node 22) for the docs. The file references TLS certificates that exist only on vm23, so `nginx -t` works only there; review the nginx change by eye.

## Applying nginx on vm23

nginx is **not** updated by the deployment (`operations.md`: "Nginx is not managed by the deployment"; the deploy run prints a warning when `nginx.conf` changed). After the release, someone with access to vm23 copies `leoiot-platform/proxy/nginx.conf` to `/etc/nginx/sites-available/leoiot`, runs `nginx -t` and reloads nginx. Agents do not log in to vm23 or change anything there (`AGENTS.md`).

## Order

1. The 3D app (`leoiot-3d/`) is merged into `main`.
2. This pull request is merged into `main`.
3. One promotion `main` → `release` ships both; the deployment starts the 3D container.
4. nginx is applied on vm23 by hand.

The smoke route `/3d/` fails until steps 3 and 4 are done. If nginx cannot be applied right after the release, the deployment is marked failed; the next deployment repeats the check. Alternatively, apply the nginx part first (it does no harm while nothing listens on 8091, `/3d/` just answers 502) and add the smoke route with the release.

## Later iteration (not now): `/` opens the new 3D app

Until another page becomes the main page, `/` could open the new explorer instead of the legacy one. Another platform pull request then adds to `nginx.conf`:

```nginx
# Main page: the 3D explorer, until another page becomes the main page
location = / { return 302 /3d/; }
```

- 302 (temporary), not 301 (permanent): browsers remember a 301 and would keep jumping to `/3d/` after the main page changes again; a 302 is asked anew every time.
- `location = /` matches only the bare `/`; the legacy catch-all `location /` stays for all other paths until legacy is switched off.
- Update the `/` row in `operations.md`; `smoke-routes` already has `/` (redirects are followed).
- Apply on vm23 by hand as above.
