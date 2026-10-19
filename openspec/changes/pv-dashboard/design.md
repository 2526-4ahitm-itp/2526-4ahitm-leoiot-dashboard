# Design

## Context

See `proposal.md` for motivation and `specs/pv/dashboard/spec.md` for the behaviour. Facts that shape the approach:

- **The legacy PV view** (`legacy/dashboard-v2/dashboard.js`, read only): four cards (yield today, lifetime yield, battery net, grid net), two cumulative line charts (`daily_yield`, `consumption`) and a detail list. Today's cards come from the SolaX cloud: the browser posts client id, client secret, user name and password to the host proxy `/solax/` and polls `realtime_data` every 30 s. The charts query InfluxDB through the host proxy `/influx/` with a token built into the page. For a past day the cards take the last point and show missing fields as 0. Only `dashboard-v2` uses `/solax/`; `legacy/vite.config.ts` and `legacy/frontend/vite.config.ts` carry it as a development proxy only.
- **The main kiosk** (`leoiot-pv/kiosk/`, Vite, TypeScript, Vitest, Chart.js, nginx image) already contains what the dashboard needs: `src/core/energy.ts` (quantity definitions, counter step-back handling from its design D10), `src/core/time.ts` (Vienna day boundaries), `src/core/influx.ts` (Flux over `<base>/api/query`), `src/core/format.ts`, `src/data/live.ts` (WebSocket with fallback from `<base>/ws` to `/ws`). Its own nginx adds the read token from `KIOSK_INFLUX_TOKEN` to `POST <base>/api/query`.
- **CI** builds each image with `docker build <dir>`, so the build context is the folder of the `Dockerfile`; a change in a folder without `package.json` or `Dockerfile` of its own checks nothing in another folder. `platform-ci-build-context` changes both and is merged first.
- **Data** (`platform/data-contract`): one point per minute in `solax_stats`, the six daily counters restart near zero after midnight Vienna time and the first points after midnight may still carry the totals of the day before; points before 2026-04-20 may carry only `daily_yield` and `consumption`; no expiry.
- **Host**: `legacy/deploy/nginx.conf` maps `/dashboard/` to port 8081 and `/kiosk/` to 8088; on vm23 it is installed by hand. The PV stack (`leoiot-pv/compose.yaml`) joins the legacy network as an external one.

## Goals / Non-Goals

**Goals:**

- One implementation of every quantity definition for kiosk and dashboard.
- The kiosk shows exactly what it showed before after moving to the shared package.
- `/dashboard/` keeps working at every step; the switch of its PV tab is one reversible pull request.

**Non-Goals:**

- A workspace or build setup across sub-projects.
- Server-side code of our own: the dashboard stays a static page with a proxying nginx, like the kiosk.

## Decisions

### D1. Layout: `shared/`, `kiosk/`, `dashboard/`

```
leoiot-pv/
├── compose.yaml       kiosk, dashboard, collector (profile)
├── shared/            TypeScript sources + tests, no build step of its own
│   └── src/  energy.ts  time.ts  influx.ts  format.ts  live.ts
├── kiosk/             depends on "@leoiot-pv/shared": "file:../shared"
└── dashboard/         depends on "@leoiot-pv/shared": "file:../shared"
```

`shared/` has its own `package.json` with `test` (Vitest) and `build` (`tsc --noEmit`), so CI checks it as a Node component. Kiosk and dashboard import its TypeScript sources; Vite compiles them with the application. Both `Dockerfile`s are built with `leoiot-pv/` as the context (declared as `platform-ci-build-context` specifies, and `build.context: .` with `dockerfile:` in `compose.yaml`) and copy `shared/` next to their own folder before `npm ci`.

*Why:* the definitions must not drift (spec "One definition of every quantity"), and the kiosk's 189 tests already cover them. *Alternative:* copy the modules into the dashboard (rejected by Daniel on 2026-10-19: two copies drift apart). *Alternative:* one Vite application with two pages for kiosk and dashboard (rejected: rebuilds the running kiosk and couples their releases). *Alternative:* npm workspace at `leoiot-pv/` (rejected: one lockfile for three components conflicts with CI's per-component `npm ci`).

### D2. What moves into `shared/`

Only modules both applications use unchanged: quantity definitions and counter handling, Vienna time, the Flux client, formatting, the live channel. Formatting gains a language parameter (the kiosk passes German). Panels, styles and the theme switch stay in each application, because the kiosk's switch hides itself and the dashboard's must always be visible. The move happens in one commit per module with the kiosk tests run after each; the kiosk's test count does not drop.

### D3. Stack of the dashboard: as the kiosk, without a framework

Vite, TypeScript, Vitest, Chart.js, no UI framework; a small hash-free router reads and writes the view and period in the query string (`?view=month&date=2026-09`). Translations are two typed objects (`de`, `en`) with the same keys, checked by a test.

*Why:* the dashboard has four views and a handful of controls; a framework adds a dependency and a second way of building things in `leoiot-pv/`. *Alternative:* Svelte or React (rejected: nothing in `shared/` would use it, and the team knows the kiosk's pattern).

### D4. Address `/pv/`, container port 8089

The base path `/pv/` is set in the build configuration, the nginx template and the `Dockerfile`. The container listens on 8089, published on `127.0.0.1:8089`. The host nginx maps `/pv/` and `/pv/ws` (with upgrade headers) to it, as for `/kiosk/`.

*Why a path of its own:* `/dashboard/` belongs to the legacy container with the sensor views until the Sensoren team replaces it; a sub-path under it would tie the PV dashboard to that address for good. *Alternative:* `/dashboard/pv/` and `/energie/` (rejected by Daniel on 2026-10-19).

### D5. Reading with the kiosk's token

The dashboard's nginx forwards `POST /pv/api/query` to InfluxDB with the token from `DASHBOARD_INFLUX_TOKEN`; `compose.yaml` sets it from the existing `KIOSK_INFLUX_TOKEN` in `leoiot-pv/.env`. The Flux query stays in the browser as in the kiosk; nginx accepts only `POST` to that one location with a body of at most 64 KiB.

*Why:* decided by Daniel on 2026-10-19; no new step with an administrator token on vm23. The contract asks for a read-only token per reading sub-project, which this is. *Trade-off:* revoking the token stops kiosk and dashboard together. *Alternative:* own read token (rejected for now; the variable name in the container lets it be split later by changing one line in `compose.yaml`).

### D6. Day totals and period sums in the database

A day's totals are the last value of each daily counter within the Vienna day; week and month bars are those per-day values; year bars are the sums of the day values per month. The query uses Flux with `option location = timezone.location(name: "Europe/Vienna")` and `aggregateWindow(every: 1d, fn: last, createEmpty: true)`, so a year needs about 365 rows per field instead of 525 600 points.

Taking the last value, not the maximum, follows from the contract: the first points after midnight may still carry the totals of the day before, which would make the maximum of a new day too high. A counter that steps back shortly before midnight makes the day's total too low by the step; this is accepted (see `platform-pv-counter-stepback`). `createEmpty: true` makes days without a point visible as gaps rather than missing bars.

The power curve of a day is computed from counter differences per five minutes as in the kiosk, through the shared counter handling (kiosk design D10).

### D7. Missing fields

A per-day row carries `null` for every field without a point; totals add only non-null days and report the count of null days; ratios use only days where all five input fields are present. Before 2026-04-20 this leaves production as the only full figure, which is what the spec asks for. The note text names the date from which the fields are recorded; the date is a constant with a test, not looked up.

### D8. Live power

In the day view of today the dashboard opens the live channel as the kiosk does and takes momentary-power messages younger than two minutes; otherwise it computes average power from the last ten minutes of stored readings. Totals and curves of today are queried again every 60 s. Past views open no live channel and query once.

### D9. Design through three previews

Before any view is built, three clickable previews with sample data run on localhost (Impeccable for direction and critique, conservative, light animation), each covering the day view of today, the month view and the phone layout. Daniel picks one; the choice and the reason go into this design as D9a. Colours of the quantities and the design tokens are fixed by the kiosk and the documentation site and are not varied between the previews.

### D9a. Chosen structure: plain-language report

Daniel chose preview A ("Bericht") on 2026-10-19: "A ist am besten. B finde ich schrecklich." The three previews (structures drawn by the Impeccable surface seed `b4fad8c4` from seven candidates) were:

- **A, Bericht (chosen):** one or two plain sentences summarise the shown period ("Am Mittwoch, 14. Oktober 2026 hat die Anlage 410 kWh produziert. Die Schule hat 356 kWh verbraucht, 95 % davon kamen nicht aus dem Netz."). Every number in the sentence is a chip in its quantity colour; pointing at or focusing it highlights the matching series in the chart. Below: the chart, the figures of all seven quantities, the two ratios with their explanations. Missing data are said in the sentence ("Vom 20. bis 30. April hat die Schule …").
- **B, Archiv-Leiste (rejected):** a persistent side rail with months, production bars and a mini calendar. Rejected outright.
- **C, Vergleich (not chosen):** every figure against the previous period, ghosted previous-period bars, energy balance bars. It would have needed a spec addition (previous-period comparison).

*Why A fits:* the dashboard's main audience are students and teachers looking up a day or month (spec "Four views with one question each"); the sentence answers the view's question before any chart has to be read, and it states gaps in words, which the spec demands ("Missing readings are unknown, not zero").

The previews live outside the repository in `/home/daniel/leoiot/previews/pv-dashboard/` (shared sample data `shared/data.js`); preview A is the reference for the build, not code to copy. The direction contract for the build is in `leoiot-pv/.impeccable/surfaces/dashboard.md`; product facts for design work are in `leoiot-pv/PRODUCT.md`.

English labels, as used in the previews: Production, Consumption, Self-consumption, From grid, To grid, From battery, To battery, Self-sufficiency (Autarkie), Self-consumption rate (Eigenverbrauchsquote), Live, Avg. last 10 min, no data, Day, Week, Month, Year.

### D10. Replacing the legacy PV view

After acceptance, one pull request changes `legacy/dashboard-v2/`: the button "PV System" becomes a link to `/pv/`, and the PV view (markup, the SolaX login and polling, the PV queries and charts, PV-only translations and styles) is removed. Another line removes `/solax/` from `legacy/deploy/nginx.conf`. The sensor part is checked before and after against the same running stack: same requests in the network log, same cards, charts and room table (rule from 2026-10-13: parts outside PV keep working as before).

The Sensoren team is told with a link to the pull request before it is merged; they share the three files. The development proxies for `/solax/` in `legacy/vite.config.ts` and `legacy/frontend/vite.config.ts` are left alone: they are not ours and do nothing in production.

*Why a link rather than a redirect of `/dashboard/`:* the sensor views stay at that address. *Alternative:* leave the legacy PV view in place and only add a link (rejected: the client secret would stay in every visitor's browser, against #64 criterion 3).

## Risks / Trade-offs

- **Moving code out of the kiosk changes what it shows** → one module per commit, kiosk tests after each, and a side-by-side comparison of the running kiosk against the same readings before merging (task 2.4).
- **`platform-ci-build-context` is not merged or changes shape** → this change waits; nothing in `leoiot-pv/` moves before it is merged.
- **Year queries are slow** (one point per minute, about 525 000 per field and year) → aggregation runs in InfluxDB (D6); measured in task 4.5 against vm23's data through an SSH tunnel; if it takes more than 3 s the year view shows a loading state and the result is cached for the session.
- **Port 8089 is taken on vm23** → checked in the host task; the port is one variable in `compose.yaml`.
- **The Sensoren team changes `dashboard-v2` at the same time** → the PV removal is a separate, small pull request at the end; conflicts are resolved by us.
- **The SolaX secret stays valid after it leaves the browser** → it has been public for months; rotating it is a collector matter and is raised with Daniel (Open Questions), not done here.

## Migration Plan

```
 step 1  platform-ci-build-context merged                 no effect on vm23
 step 2  shared/ + kiosk switched, released               kiosk unchanged on vm23
 step 3  dashboard released, running on 127.0.0.1:8089    nothing public changes
 step 4  host nginx: /pv/ -> 8089                         /dashboard/ unchanged
 step 5  smoke route /pv/ (own pull request)
 ------  acceptance by Daniel and Stefan
 step 6  dashboard-v2: PV tab -> /pv/, PV view removed, released
 step 7  host nginx: /solax/ removed
```

**Rollback:** steps 2 and 3 by reverting the pull request and releasing; step 4 by removing the location and reloading nginx; step 6 by reverting its pull request and releasing; step 7 by putting the location back.

## Open Questions

- Should the SolaX client secret be rotated once no browser uses it any more? It does not change this change; the collector reads it from `leoiot-pv/.env`.
- What is the earliest stored PV reading? The dashboard finds it by query at run time; the answer only matters for the note shown in the earliest periods.
