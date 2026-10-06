---
name: project-overview
description: Full architecture, services, ports, routing, data pipeline, and deployment for leoiot-dashboard (HTL Leonding IoT project)
metadata:
  type: project
---

## leoiot-dashboard — HTL Leonding IoT Dashboard

**Live URL:** https://vm23.htl-leonding.ac.at  
**VM:** vm23.htl-leonding.ac.at (nginx NOT in Docker — manually managed)  
**CI/CD:** GitHub Actions → `git pull && docker compose up -d --build` (does NOT touch nginx)

---

## Services & Routes

| nginx route | Docker service | Port | Stack | Purpose |
|---|---|---|---|---|
| `/` | `frontend` | 8080 | Vite + Three.js | 3D building viewer with A* navigation, GLTF models |
| `/dashboard/` | `dashboard-v2` | 8081 | Vite vanilla JS + Chart.js | CO2 + PV data dashboard, date picker, live MQTT |
| `/kiosk/` | `kiosk` | 8082 | Vite vanilla JS + Chart.js | PV kiosk fullscreen display |
| `/kiosk2/` | `kiosk2` | 8083 | Vite vanilla JS + Chart.js | PV overview kiosk, 45-day bar chart |
| `/grafana/` | `grafana` | 3000 | Grafana | — |
| `/influx/` | `influxdb` | 8086 | InfluxDB 2.7 | Time-series DB |
| `/ws` | `mqtt-ws-bridge` | 8090 | Node.js ws | MQTT → WebSocket bridge for frontend live data |
| `/solax/` | nginx proxy | — | nginx → solaxcloud.com | CORS proxy for Solax API |

**Redirect rules in nginx:** `= /kiosk`, `= /kiosk2`, `= /dashboard` all 301 → trailing slash.

---

## Data Pipeline

```
Physical sensors → MQTT (Mosquitto :1883) → Telegraf → InfluxDB
Solax inverter   → solax-collector (polls 1 min) → InfluxDB
                                                       ↓
frontend / kiosk / kiosk2 / dashboard-v2 ← InfluxDB queries via /influx/ proxy
                                         ← MQTT live via /ws WebSocket
fake-sensors (dev) or quarkus-app (backend/) → MQTT
```

---

## InfluxDB Credentials (hardcoded in JS files)

- **Bucket:** `server_data` | **Org:** `leoiot`
- **Token:** `ih3lGQ2dVqXG7ec0Ai-flUi5ZWTqp3AChtwI0fu4014-cn5h0MRE6-RcWtlL1yYGUaaSg6NOtcW_TEjQdGGA5A==`
- **Measurement:** `solax_stats`
- **Fields:** `daily_yield`, `total_yield`, `consumption`, `daily_charged`, `daily_discharged`, `daily_imported`, `daily_exported`

---

## Key Files

| File | Purpose |
|---|---|
| `docker-compose.yaml` | All services |
| `deploy/nginx.conf` | nginx config — copy manually to `/etc/nginx/sites-enabled/leoiot`, reload |
| `vite.config.ts` (root) | Local dev proxy: `root: './frontend'`, proxies all subpaths → localhost ports |
| `frontend/vite.config.ts` | INACTIVE — fully commented out (merged into root) |
| `frontend/logic.js` | Three.js 3D scene, GLTF models, A* pathfinding, CSS2DRenderer labels |
| `frontend/index.html` | 3D viewer entry point |
| `frontend/*.gltf` | Building models (ModelFull, Model1F, Model2F, ModelE, ModelT, ModelU, waypoints) |
| `dashboard-v2/dashboard.js` | CO2/PV charts, Solax token refresh, date picker, MQTT live |
| `kiosk/kiosk.js` | PV kiosk: InfluxDB queries, weather (Open-Meteo), Chart.js, 6-day history |
| `kiosk/kiosk.css` | Kiosk styles, responsive at 768px |
| `kiosk2/kiosk2.js` | PV overview: 45-day grouped bar chart, InfluxDB |
| `solax-collector/` | Node.js — polls Solax API → InfluxDB |
| `mqtt-ws-bridge/` | Node.js — bridges Mosquitto MQTT to WebSocket |
| `fake-sensors/` | Node.js — publishes fake sensor data to MQTT |
| `backend/sensor-data-generator/` | Quarkus Java — alternative fake sensor generator |
| `contextKiosk.md` | Detailed kiosk context: Solax API, CET timezone, chart config |
| `telegraf.conf` | Telegraf: MQTT → InfluxDB |

---

## Critical: Vite Subpath Base

Kiosk/kiosk2 run as **Vite dev servers in Docker** (not built). nginx strips `/kiosk/` prefix before proxying. Without `base`, Vite injects `/@vite/client` (absolute path) → nginx routes to frontend (8080) → 404.

**Fix applied:** `base: isDocker ? '/kiosk/' : '/'` in `kiosk/vite.config.ts`, same for kiosk2.

`dashboard-v2` has same potential issue if it ever breaks.

---

## Local Dev

```bash
npx vite --config vite.config.ts   # serves http://localhost:5173
# root vite.config.ts has root: './frontend' + all subpath proxies
```

Kiosk/kiosk2 local: `npm run dev` in their dirs → `localhost:8082` / `localhost:8083` (base `/` locally).

---

## Solax API (via nginx /solax/ proxy)

- **Base:** `https://openapi-eu.solaxcloud.com` (nginx proxies, adds CORS headers)
- **Auth:** POST `/openapi/auth/get_token` → `code === 0` = success, token valid ~30 days
- **Realtime:** GET `/openapi/v2/plant/realtime_data?plantId=508819503377442&businessType=4`
- **Credentials:** client_id `b6d55e642b304989be96a3e0f0ce1793`, username `m.remake` (see contextKiosk.md)
- **code 10401/10402** = token expired → re-auth

---

## nginx Management

nginx on VM is NOT in Docker Compose. Changes to `deploy/nginx.conf` need:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-enabled/leoiot
sudo systemctl reload nginx
```
CI/CD does NOT do this automatically.

**Why:** To apply routing changes, must SSH to VM and reload manually.
