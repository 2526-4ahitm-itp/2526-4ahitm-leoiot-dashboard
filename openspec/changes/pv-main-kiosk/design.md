# Design

## Context

See `proposal.md` for motivation. Facts that shape the approach:

- **The rebuilt kiosk exists.** On the local branch `feat/kiosk-rebuild` (tip `da1dfba`, not pushed, based on `main` from before the restructure) the folder `leogreenKiosk/` holds a Vite and TypeScript application with tests (`src/core`, `src/data`, `src/ui`, `src/panels`, `tests/`), a `Dockerfile` and an nginx template. It was written from the spec of the local change `rebuild-main-kiosk` and corrected by `fix-review-findings`; in both, only the acceptance task is open.
- **How it gets data.** Its own nginx forwards `POST <base>/api/query` to InfluxDB and adds a token from the variable `KIOSK_INFLUX_TOKEN`, and forwards `<base>/ws` to the WebSocket bridge. The browser never sees the token. It finds `influxdb` and `mqtt-ws-bridge` by name on the Compose network. The page tries `<base>/ws` first and `/ws` second.
- **Its address is built in.** The base path `/leogreen/` appears in `vite.config.ts`, the nginx template, the `Dockerfile` and the README; the container listens on 8087.
- **Legacy kiosks.** Five Compose services run Vite development servers on ports 8082 to 8085 and 8087. `legacy/deploy/nginx.conf` maps the five addresses to them; on vm23 it is a hand-maintained copy under `/etc/nginx/sites-enabled/leoiot`. `legacy/vite.config.ts` carries proxy entries for `/kiosk` to `/kiosk4`.
- **The legacy stack** has the pinned Compose project name `2526-4ahitm-leoiot-dashboard`; its network is therefore `2526-4ahitm-leoiot-dashboard_leoiot`.
- **Rule.** Nothing in `leoiot-pv/` may be imported, copied or mounted from `legacy/`, and legacy logic is re-specified and re-implemented.

## Goals / Non-Goals

**Goals:**

- At every moment each kiosk address shows a working kiosk or redirects to one.
- Every step on vm23 can be undone with one edit and a reload.
- `leoiot-pv/` has a layout the collector and the second kiosk can be added to.

**Non-Goals:**

- Changing what the kiosk shows. The screen stays as approved.
- A shared build setup across sub-projects.

## Decisions

### D1. Tech stack and layout of `leoiot-pv/`

```
leoiot-pv/
├── README.md        what is here, what is still in legacy, how to run
├── compose.yaml     the PV services (first: kiosk)
├── .env.example     names of the variables compose.yaml needs
└── kiosk/           the main kiosk (Vite, TypeScript, Vitest, nginx image)
```

Each application is a folder with its own `package.json` and `Dockerfile`; there is no workspace at the top. Later applications (`collector/`, the second kiosk) follow the same pattern.

*Why:* the kiosk already has this shape and its 189 tests pass in it; a workspace would be set up for one member. *Alternative:* a monorepo workspace now (rejected: nothing to share yet).

### D2. The kiosk code comes from the rebuild branch, not from `legacy/`

The files of `leogreenKiosk/` at the tip of `feat/kiosk-rebuild` are added under `leoiot-pv/kiosk/` in one commit on a fresh branch from `main`; the commit message names the source commit. Nothing is taken from `legacy/leogreenKiosk/`.

*Why this conforms:* the rule forbids referencing legacy files and carrying legacy logic over unspecified. This code was specified and written anew; it only sat in a folder that has since been renamed.

*Alternative:* rebase the branch onto `main` and move the folder (rejected: Git follows the rename, so the rebase would apply the rebuild onto `legacy/leogreenKiosk/` and the following move would be a move out of `legacy/`, which is the one thing the rule names. It also drags the unrelated documentation-site commits along.)

The 17 commits stay on the local branch as the record of how the kiosk was built.

### D3. Base path `/kiosk/`, container port 8088

The base path becomes `/kiosk/` in the build configuration, the nginx template, the `Dockerfile` and the README; the live-channel fallback order (`/kiosk/ws`, then `/ws`) stays. The container listens on 8088 and is published on `127.0.0.1:8088` only.

*Why 8088:* 8082 and 8087 are held by legacy kiosks until they are removed, and both have to keep running for the rollback.

### D4. Interim deployment: own Compose file on the legacy network

`leoiot-pv/compose.yaml` has the project name `leoiot-pv`, builds the kiosk image and attaches the service to the legacy stack's network, declared `external` under its full name. The kiosk reaches `influxdb` and `mqtt-ws-bridge` by service name as before. The read token comes from `leoiot-pv/.env`.

*Why not add the service to `legacy/docker-compose.yaml`:* new parts do not go into the frozen stack. *Why not wait for Kubernetes:* the cluster is not sized yet (issue #54) and the kiosk is ready now. The image is the unit that moves to the cluster later; only the wiring around it changes.

The dependency on the legacy network is on platform services that happen to still live in `legacy/`, through the interfaces of `platform/data-contract`. It ends when the platform has its own deployment.

### D5. Cut-over in three reversible steps

```
 step 1  new kiosk runs on 127.0.0.1:8088          nothing public changes
 step 2  nginx: /kiosk/ -> 8088                    old kiosk on 8082 still running
 step 3  nginx: /leogreen/ /kiosk2-4/ -> /kiosk/   old containers still running
 ------  acceptance on the real screen, one week of observation
 step 4  remove the five legacy services and folders
```

Before step 2 the new kiosk is checked on vm23 through an SSH tunnel to port 8088. There is no temporary public address, because the base path is built in and a second address would need a second build that is not the one going live.

In step 2 the `/kiosk/` location gains the WebSocket upgrade headers, so the kiosk's own `/kiosk/ws` works; the fallback to `/ws` covers the case that they are missing.

**Rollback** for steps 2 and 3: put the previous `proxy_pass` lines back and reload nginx. After step 4, rollback means reverting the removal commit and starting the services again.

### D6. Redirects are temporary until the legacy kiosks are gone

Step 3 uses status 302. After step 4 the redirects become 301.

*Why:* browsers remember a 301 indefinitely; with one, a screen would keep redirecting even after a rollback.

The redirect passes the query string on, so `?theme=dark` on an old bookmark keeps working.

### D7. Removal from `legacy/`

Removed together in one pull request after the observation week: the five folders, the five services in `legacy/docker-compose.yaml`, the proxy entries in `legacy/vite.config.ts`, `legacy/contextKiosk.md` and `legacy/continuations/02-leogreen-kiosk.md`, and the rows in `legacy/README.md`. On vm23 the stack is brought up with `--remove-orphans`, otherwise the five containers keep running and hold their ports.

### D8. Spec carried over in English

`pv/main-kiosk` is the English version of the local German spec, with its three later additions merged in, the address requirements added and the data sources replaced by references to `platform/data-contract`. One sentence was dropped: "at 1920 × 1080 the display must stay unchanged compared with the approved state" compared against a moment in time and cannot be tested from the spec alone; the concrete Full HD requirements remain.

### D9. Documentation site

Only statements that become wrong are changed: the list of kiosk addresses and their descriptions in `architecture`, `setup`, `operations`, `interfaces` and `project` (both languages) and the labels in the architecture diagrams. The larger rework of those pages sits in the documentation commits of `feat/kiosk-rebuild` and is not part of this change; whichever lands second resolves the overlap.

### D10. A counter that steps back is not a day change

Found while testing against real readings on 2026-10-13: on 4 of the last 30 days a stored daily counter (mostly `daily_imported`) fell by a few kWh and rose again within minutes, away from midnight. The kiosk took every such fall for the reset at the start of the day and dropped all readings before it, so the power panel lost the hours before the last fall.

The kiosk now recognises the start of the day only by a fall in the first 30 minutes of the day or a fall of the summed counters by more than half. After that point each counter is read as its highest value so far that day when power is computed. A short dip therefore shows as no change. A single reading that is too high still shows as one step up followed by no change; telling that apart from real consumption is not attempted.

The day totals in the rings and the weekly overview keep using the last stored value unchanged.

## Risks / Trade-offs

- **A screen in the school has `/kiosk/` or a numbered kiosk open and suddenly shows something else** → announce the switch day; that it changes is the intent. Which address the screens use is asked before step 2 (task 4.1).
- **The read token is missing or wrong on vm23** → the kiosk shows its "Keine Daten" message, not a blank page; the tunnel check in step 1 catches it before anything public changes.
- **The legacy network name differs on vm23** → `docker network ls` is checked in the host task before the first start.
- **The observation week is skipped** → the removal is its own pull request, so nothing is deleted by the same merge that adds the kiosk.
- **The dashboard is forgotten** → `leoiot-pv/README.md` lists it as still in legacy, and task 6.3 opens an issue for it.
- **Port 8088 is taken on vm23** → checked in the host task; the port is one variable in `compose.yaml`.

## Migration Plan

As in D5. Order of pull requests:

1. `leoiot-pv/` scaffold with the kiosk at base path `/kiosk/` (no effect on vm23 until started).
2. nginx configuration change for steps 2 and 3, applied by hand on vm23 in two reloads.
3. After acceptance and a week: removal from `legacy/` and the documentation update; redirects become permanent.

## Open Questions

- Which address do the screens in the school have open today? It does not change the plan, only whom to warn before step 2.
- Does the PV part move to Kubernetes before or after the collector is rebuilt? Decided with issue #54; this design works either way.
