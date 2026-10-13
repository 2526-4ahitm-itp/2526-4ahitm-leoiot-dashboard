# Continuation — leogreenKiosk PV dashboard

Paste this into a fresh thread. It is self-contained.

---

## Context

This is the LeoIOT dashboard project for HTL Leonding, deployed at `https://vm23.htl-leonding.ac.at`.
The repo is `https://github.com/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard.git` on branch `main`.

The active work this thread is the **leogreenKiosk** — a fullscreen kiosk at `/leogreen/`
built for non-expert visitors to the school. It shows live PV solar data.

## Deployment

- **URL**: `https://vm23.htl-leonding.ac.at/leogreen/`
- **VM SSH**: `ssh solmqadmin@vm23.htl-leonding.ac.at` — Password: `L4Sun@leo24.vm`
- **Deploy command**: `cd /home/solmqadmin/2526-4ahitm-leoiot-dashboard && git pull && docker compose restart leogreen-kiosk`
- **nginx**: NOT managed by Docker. Changes to `deploy/nginx.conf` must be manually copied and reloaded:
  `sudo cp deploy/nginx.conf /etc/nginx/sites-enabled/leoiot && sudo systemctl reload nginx`
- **CI/CD**: `.github/workflows/deploy.yml` runs `git pull && docker compose up -d --build` on every push to main — does NOT touch nginx.
- Docker service: `leogreen-kiosk`, port `8087`, volume `./leogreenKiosk:/app`

## Git identity for this project

Commits should be authored as **DLettner**. Set before committing:
```
git config user.name "DLettner"
```
GitHub push authentication uses the existing stored credentials (password auth is not
supported by GitHub — a PAT is required if DLettner needs push attributed to their account).

## Architecture

### Data flow
- **Live**: External MQTT broker `mqtt.htl-leonding.ac.at:8883` (TLS) → `mqtt-ws-bridge`
  (Node.js, port 8090) → WebSocket `/ws` → browser. Topic: `leoenergy/solax_pv/overall_inverter`.
  Credentials: username `leo-student`, password `sTuD@w0rck`.
- **Fallback**: InfluxDB (`server_data` bucket, measurement `solax_stats`) queried on load
  and every 5 min. Fields: `daily_yield`, `daily_exported`, `daily_charged`, `daily_discharged`,
  `daily_imported`, `consumption`.
- **Note**: As of this session the external MQTT broker was returning `connack timeout` — data
  comes from InfluxDB only until that is resolved on the school's side.

### MQTT payload field names
The broker may send camelCase (`dailyYield`, `dailyImported`, etc.) or snake_case
(`daily_yield`, `daily_imported`, etc.). `applyPvData()` in `kiosk.js` handles both via `??`.

### Key formula (do not change without understanding this)
```
selfConsumed = production - exported - charged      // PV used on-site
totalConsumption = selfConsumed + imported + discharged  // battery-aware total
```
The API's `consumption` field (`yield - exported + imported`) ignores battery discharge
and must NOT be used as the consumption total — it will diverge from `selfConsumed` when
the battery is active.

## leogreenKiosk files

| File | Purpose |
|---|---|
| `leogreenKiosk/index.html` | Layout: header + 2×2 CSS grid. Top-left cell = two donut charts. |
| `leogreenKiosk/kiosk.js` | All data logic, chart updates, MQTT WS connection, InfluxDB queries |
| `leogreenKiosk/kiosk.css` | Dark theme, grid layout, donut sizing via CSS grid rows |
| `leogreenKiosk/vite.config.js` | `base: '/leogreen/'` when `DOCKER_ENV=1`, proxies `/influx` and `/ws` |
| `leogreenKiosk/package.json` | Vite on port 8087 |

## Current UI state (top-left panel — implemented)

Two donut charts side by side in the top-left quadrant of a 2×2 grid:

**Verbrauch (Consumption)** — center: total consumption kWh
- Green: Von PV (= selfConsumed)
- Orange: Vom Netz (= daily_imported)
- Purple: Von Batterie (= daily_discharged)

**Produktion (Production)** — center: daily_yield kWh
- Green: Eigenverbrauch (= selfConsumed, identical to "Von PV" above)
- Red: Ins Netz (= daily_exported)
- Teal: Batterie (= daily_charged)

Both charts guaranteed same size via `grid-template-rows: auto 1fr auto` on `.donut-wrap`.
Legend items sorted highest → lowest value on every update.
Center font size scales by digit count and is **synced** across both donuts via `syncCenters()`.
Number formatting: 1 decimal < 100, 0 decimals ≥ 100, always kWh (no MWh conversion).

## Remaining panels (not yet implemented)

The 2×2 grid has three empty `.future-panel` sections:
- Top-right
- Bottom-left
- Bottom-right

The user said "the other dashboards we'll work on later." Ask what to put there when ready.

## Vite base path — critical detail

Without `base: '/leogreen/'` in `vite.config.js` (when `DOCKER_ENV=1`), Vite serves
assets at `/kiosk.css` but nginx forwards requests as `/leogreen/kiosk.css` → 404.
The other kiosks (kiosk2/3/4) follow the same pattern with their own base paths.

## InfluxDB
- URL (in Docker): `http://influxdb:8086` (proxied to browser via nginx `/influx/`)
- Token: `ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==`
- Org: `leoiot`, Bucket: `server_data`, Measurement: `solax_stats`

## Last known real data values (from InfluxDB, this session)

| Field | Value |
|---|---|
| daily_yield | 746.2 kWh |
| daily_exported | 0 kWh |
| daily_charged | 82.4 kWh |
| daily_discharged | 141.2 kWh |
| daily_imported | 207 kWh |
| total_yield | 59813.4 kWh |
| selfConsumed (computed) | 663.8 kWh |
| totalConsumption (computed) | ~1012 kWh |
