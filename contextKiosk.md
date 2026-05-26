# PV Kiosk Dashboard Context

## Overview
Standalone fullscreen PV dashboard deployed at `https://vm23.htl-leonding.ac.at/kiosk/`.
Built as a separate Vite app in `/kiosk/`, mirroring the `dashboard-v2` pattern.

## Architecture
- **Stack:** Vanilla JS (ES module), Chart.js 4.4.1 (CDN), Vite dev server on port 8082
- **Data:** InfluxDB (`solax_stats` measurement) via `/influx/` nginx proxy
- **Weather:** Open-Meteo API (free, no key) — Leonding coords `48.267, 14.253`
- **Deployment:** Docker Compose service `kiosk`, nginx `location /kiosk/` → `http://127.0.0.1:8082/`
- **Auto-refresh:** every 5 minutes; clock updates every second

## Layout
```
header (HTL logo + clock + last updated)
─────────────────────────────────────────────────────
left-col (flex:7)          │ history-panel (flex:3)
  info-boxes (5 boxes)     │   day-panel ×6 (yesterday → 6 days ago)
  main-panel (today chart) │
─────────────────────────────────────────────────────
```
Single `--g: 10px` gap used everywhere so all edges and gutters align perfectly.
Responsive breakpoint at 768 px: body becomes scrollable, info boxes go 2×3 grid, charts stack vertically.

## Data Series (4 chart lines)
| Field | Label | Colour |
|---|---|---|
| `daily_yield` | PV Generated | `#f59e0b` amber |
| `consumption` | PV Consumed | `#3b82f6` blue |
| `daily_discharged` | From Battery | `#14b8a6` teal |
| `daily_imported` | From Grid | `#ef4444` red |

All are cumulative daily kWh values reset at midnight CET. `total_yield` is also fetched (not charted) for the Lifetime Generated info box.

## Axes & Tooltip (main chart)
- **X-axis:** linear 0–24, ticks `HH:MMh` (e.g. `08:00h`), title `time in h`
- **Y-axis:** `suggestedMin: 0`, ticks `{v} kWh`, no axis title
- **Tooltip:** sorted by value descending, semi-transparent dark bg (`rgba(20,22,28,0.82)`), coloured circle markers, title shows `HH:MM`

## Info Boxes (top row, left → right)
1. **Weather** (`#0ea5e9`) — condition text + temperature from Open-Meteo
2. **Generated Today** (`#f59e0b`) — latest `daily_yield`
3. **Consumed Today** (`#3b82f6`) — latest `consumption`
4. **CO₂ Avoided** (`#22c55e`) — `daily_yield × 0.4 kg/kWh`
5. **Lifetime Generated** (`#a78bfa`) — latest `total_yield`

## Day Charts (right column, 6 panels)
Each shows the same 4 series for one past day (yesterday first, 6 days ago last).
Header row per panel: `DD.MM.  ↑ X.X kWh  ↓ X.X kWh  X.X kg CO₂`
X-axis ticks every 6 h (plain numbers), no axis titles, no tooltip, no legend.

## CET Timezone Handling
`getCETDayRange(daysAgo)` computes exact UTC start/stop for a CET calendar day:
1. Gets date string in `Europe/Vienna` via `toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })`
2. Determines offset (1 = CET, 2 = CEST) via `Intl.DateTimeFormat` with `timeZoneName: 'shortOffset'`
3. Midnight CET in UTC = `dateStr T00:00:00Z − offset hours`

Data x-values are decimal hours since CET midnight (e.g. 14.5 = 14:30).

## Weather Codes (WMO)
Mapped from Open-Meteo `weather_code` field to plain English strings.
Key mappings: 0 = Clear Sky, 1 = Mainly Clear, 2 = Partly Cloudy, 3 = Overcast,
45/48 = Fog, 51–55 = Drizzle, 61–65 = Rain, 71–75 = Snow,
80–82 = Showers, 95–99 = Thunderstorm.

## Key Files
| File | Purpose |
|---|---|
| `kiosk/index.html` | Layout skeleton |
| `kiosk/kiosk.js` | All data fetching, chart init, refresh loop |
| `kiosk/kiosk.css` | Styles + responsive breakpoint |
| `kiosk/vite.config.js` | `server.allowedHosts: true` (required for nginx proxy) |
| `kiosk/package.json` | Vite dev server on port 8082 |
| `kiosk/htllogo.png` | HTL Leonding logo (transparent PNG) |

## Solax API Tutorial

### Overview
The kiosk reads PV data from InfluxDB (written by `solax-collector`). If you need to fetch live Solax data directly from the frontend (as `dashboard-v2` does), here is the complete integration.

### Credentials
```javascript
const SOLAX_HOST       = '/solax/';                          // nginx proxy (avoids CORS)
const SOLAX_CLIENT_ID  = 'b6d55e642b304989be96a3e0f0ce1793';
const SOLAX_CLIENT_SECRET = 'HCRctfp7_ezVhnIWlNrzO3--U_wFSjscVEhdQd5RpUI';
const SOLAX_USERNAME   = 'm.remake';
const SOLAX_PASSWORD   = 'Uniformed-Auction-Lanky1';
const SOLAX_PLANT_ID   = '508819503377442';
```
The real base URL is `https://openapi-eu.solaxcloud.com`. The nginx proxy at `/solax/` forwards to it and adds CORS headers (see nginx config below).

### Step 1 — Get Access Token
```javascript
let solaxToken = null;

async function getSolaxToken() {
  if (solaxToken) return solaxToken;
  const res = await fetch(`${SOLAX_HOST}openapi/auth/get_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SOLAX_CLIENT_ID,
      client_secret: SOLAX_CLIENT_SECRET,
      grant_type: 'CICS',
      username: SOLAX_USERNAME,
      password: SOLAX_PASSWORD,
    }),
  });
  const data = await res.json();
  if (data.code === 0) {
    solaxToken = data.result.access_token;  // valid ~30 days
    return solaxToken;
  }
  throw new Error(`Solax token error: ${JSON.stringify(data)}`);
}
```
- `data.code === 0` = success
- `data.code === 10401` = token expired → clear cached token, re-fetch
- `data.code === 10402` = token invalid → same

### Step 2 — Real-time Plant Data
```javascript
async function fetchSolaxRealtime() {
  const token = await getSolaxToken();
  const res = await fetch(
    `${SOLAX_HOST}openapi/v2/plant/realtime_data?plantId=${SOLAX_PLANT_ID}&businessType=4`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.code === 10401 || data.code === 10402) {
    solaxToken = null;       // token expired — next call will re-auth
    return null;
  }
  if (data.code !== 10000) throw new Error(`Solax error: ${data.msg}`);
  return data.result;
}
```
Key fields in `data.result`:
| Field | Description |
|---|---|
| `dailyYield` | kWh generated today |
| `totalYield` | Lifetime kWh generated |
| `dailyCharged` | kWh charged into battery today |
| `dailyDischarged` | kWh discharged from battery today |
| `dailyImported` | kWh imported from grid today |
| `dailyExported` | kWh exported to grid today |
| `plantLocalTime` | Local timestamp string, e.g. `"2025-05-20 14:32:00"` |

Consumption can be derived: `consumption = dailyYield - dailyExported + dailyImported`

### Step 3 — History Data (optional)
History is fetched per device, not per plant. Device serial numbers for HTL Leonding:
```javascript
const INVERTER_SNS = ['X3G050J2826027', 'X3G050J2806032', 'X3G050J2826077', '8013T0020H0S01'];
const METER_SN     = ['240423171652'];
```
```
GET /openapi/v2/device/history_data
  ?snList=X3G050J2826027,X3G050J2806032,...
  &deviceType=1          (1=inverter, 3=meter)
  &startTime=<ms>
  &endTime=<ms>
  &timeInterval=5        (minutes)
  &businessType=4
Authorization: Bearer <token>
```

### nginx CORS Proxy (already configured)
```nginx
location /solax/ {
    proxy_pass https://openapi-eu.solaxcloud.com/;
    proxy_set_header Host openapi-eu.solaxcloud.com;
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    if ($request_method = 'OPTIONS') { return 204; }
}
```

### Data Flow in This Project
The kiosk does **not** call the Solax API directly. Instead:
1. `solax-collector` (Docker service) polls Solax every 1 minute via the real `openapi-eu.solaxcloud.com` URL
2. Writes to InfluxDB `server_data` bucket, measurement `solax_stats`, fields: `daily_yield`, `total_yield`, `consumption`, `daily_charged`, `daily_discharged`, `daily_imported`, `daily_exported`
3. Kiosk queries InfluxDB via `/influx/` proxy

If you want to add live (sub-minute) data to the kiosk, call `fetchSolaxRealtime()` on an interval and update the info boxes directly.

## InfluxDB Query Pattern
```flux
from(bucket: "server_data")
  |> range(start: {midnightCET_UTC}, stop: {midnight+24h_UTC})
  |> filter(fn: (r) => r._measurement == "solax_stats")
  |> filter(fn: (r) => r._field == "daily_yield" or r._field == "consumption"
       or r._field == "daily_discharged" or r._field == "daily_imported"
       or r._field == "total_yield")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> yield(name: "mean")
```
All 7 days (today + 6 history) are fetched in parallel via `Promise.all`.

## Deployment Notes
- **nginx** on the VM is NOT managed by Docker Compose — changes to `deploy/nginx.conf`
  must be manually copied to `/etc/nginx/sites-enabled/leoiot` and nginx reloaded:
  `sudo systemctl reload nginx`
- **CI/CD** (`deploy.yml`) only runs `git pull && docker compose up -d --build` — does not touch nginx.
- Docker volume mounts `./kiosk:/app`, so all files must exist in the repo before the container starts.
- Vite's `server.allowedHosts: true` in `vite.config.js` is required — without it Vite returns 403 for proxied requests from nginx.
