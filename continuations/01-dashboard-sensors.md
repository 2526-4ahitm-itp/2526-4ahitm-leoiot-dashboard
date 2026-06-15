# Continuation — Convert `dashboard-sensors` to a full AS-BUILT spec

Paste this into a fresh thread. It is self-contained.

---

## Context

We are converting `docs/functional-specification.md` (FSD) into capability-sliced
OpenSpec specs for the brown-field LeoIOT project. The plan, capability map, and
locked decisions live in **`openspec/specs/README.md`** — read it first.

Locked decisions (do not relitigate):
- **Framing = AS-BUILT.** `specs/` document the system as it runs TODAY. FSD is the
  target, not the spec text. Gaps + code-vs-FSD contradictions become `changes/`
  proposals, never inline "gap" notes.
- 9 capabilities, kiosks out of scope, data-sources in scope.
- Order: sensors → pv → 3d → live-updates → sensor-overview → historical-data →
  app-shell → i18n → data-sources. **This thread = `dashboard-sensors` (first).**

## Your task this thread

Take `openspec/specs/dashboard-sensors/spec.md` from SKELETON (currently
AS-INTENDED) to a **full AS-BUILT spec**.

1. **Flip framing**: rewrite the `> Status / Framing` header to AS-BUILT. Body must
   describe the climate/sensors view as the code actually behaves. Remove the
   "Implementation Gap" and "TODO" sections — they become `changes/` (step 3).
2. **Fill requirements** as `SHALL` + `#### Scenario` (WHEN/THEN), grounded in code.
3. **Spawn changes** for the two FSD targets this capability owns:
   - `co2-threshold-retune` — code colors at 800/1000; FSD FR-07 wants 600/1200.
   - `stale-sensor-warning` — FSD FR-08 5-min stale warning NOT implemented.

Scope is bounded to the sensors slice ONLY:
`dashboard-v2/dashboard.js` (sensors view), `dashboard-v2/index.html`,
`dashboard-v2/style.css`. PV, 3D, kiosks, i18n internals = other threads.

## Verified facts (from audit — trust these, re-confirm line numbers if editing)

- CO2 status colors AS-BUILT: `> 1000` warning, `> 800` medium, else ok
  (`dashboard.js:1767,1771-1772`). NOT 600/1200.
- Sensors view is **WebSocket live-push**, NOT polled (`dashboard.js:187-204`).
  The old skeleton's "30s hardcoded @ line 35" claim is FALSE (line 35 is an i18n
  string; the 30s interval is PV-only at `dashboard.js:815`).
- Stale 5-min warning: NOT implemented (status derives only from co2/temp thresholds).
- Data source: InfluxDB via relative `/influx`, bucket `server_data`, org `leoiot`.
  Measurements: `room_temperature`, `mqtt_consumer` (`dashboard.js:1218,1236`).
- Room 105 special case: `nili3_co2 → 105` mapping (`dashboard.js:1253,1368,1553`;
  bridge `index.js:49`). Room 105 has dedicated latest-value fetches (`dashboard.js:1134-1150`).
- Temp status AS-BUILT: `> 24` warning, `< 19` cold, else ok (`dashboard.js:1763`).

## FSD requirements this capability covers

FR-01 (climate display), FR-04 (room selection), FR-07 (CO2 colors),
FR-08 (stale warning), FR-12 (active/inactive), FR-13 (low-temp alert),
FR-14 (invalid room → "No data for room"). Sensor-overview TABLE is a SEPARATE
capability (FR-06) — do NOT absorb it here.

## Guardrails

- Document reality, not wishes. If code does X, spec says X; FSD's Y goes to `changes/`.
- When done, update the `dashboard-sensors` status line in `openspec/specs/README.md`
  and note which change proposals you created.
- Do not touch other capabilities' code or specs.

Start by reading `openspec/specs/README.md` and `openspec/specs/dashboard-sensors/spec.md`,
then the sensors slice of `dashboard-v2/dashboard.js`.
