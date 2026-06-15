# LeoIOT — Spec Conversion Tracker

Converting `docs/functional-specification.md` (FSD) into capability-sliced OpenSpec
specs. Brown-field: the system already runs. This file is the durable index — each
conversion thread reads it cold, picks one capability, fills it, ticks the line.

## Framing decision (LOCKED)

**AS-BUILT.** `specs/` document the system **as it runs today** — validatable against
the code. The FSD is the *target*, not the spec text. Every FSD gap and every
code-vs-FSD contradiction becomes a `changes/` proposal, never an inline "gap" note.

- `specs/`  = current truth (what the code does now)
- `changes/` = proposed deltas toward the FSD target → applied → archived

> The two existing skeletons (`dashboard-sensors`, `dashboard-pv`) were written
> AS-INTENDED. They must be **flipped** to AS-BUILT during their fill thread:
> body documents reality; their "Implementation Gap" lists move out to `changes/`.

## Per-thread process

```
1. Pick ONE capability from the tracker below (default order = top to bottom).
2. Deep-dive its code surface only (bounded → fits one thread).
3. Write Requirements as SHALL + #### Scenario (WHEN/THEN), describing CURRENT behavior.
4. Any FSD target not yet built, or code that contradicts the FSD → a changes/ proposal.
5. Tick the tracker line here. Note the spawned change proposals.
```

## Capability tracker

| Capability             | Code surface                                  | FSD coverage              | Status |
|------------------------|-----------------------------------------------|---------------------------|--------|
| dashboard-sensors      | `dashboard-v2/dashboard.js` (sensors view), `index.html`, `style.css` | FR-01,04,07,08,12,13,14 | skeleton — needs AS-BUILT flip + fill |
| dashboard-pv           | `dashboard-v2/dashboard.js` (PV view, Solax)  | FR-03                     | skeleton — needs AS-BUILT flip + fill |
| 3d-building-explorer   | `frontend/logic.js` (1891 lines), `*.gltf/.glb` | FR-02                   | empty dir — not started |
| live-updates           | `mqtt-ws-bridge/index.js` (197 lines)         | FR-05, FR-09              | not started |
| sensor-overview        | `dashboard-v2/dashboard.js` (table, status)   | FR-06, FR-08, FR-12       | not started |
| historical-data        | `dashboard-v2/dashboard.js` (Flux range queries) | FR-10 + retention Q    | not started |
| app-shell / routing     | `index.html`, router (redirect, invalid room) | FR-11, FR-14, §8 routing  | not started |
| i18n (de/en)           | `dashboard.js` `t()` tables                   | bilingual, AC-12          | not started |
| data-sources           | `fake-sensors/`, `backend/sensor-data-generator/` (Java), bridge | §10 assumptions/deps | not started |

Cross-cutting FR-09 (configurable interval) + FR-10 (history) live in their own
capabilities (`live-updates`, `historical-data`) per locked decision — not duplicated
into each view spec.

Kiosks (`kiosk`, `kiosk2`, `kiosk3`, `kiosk4`) are OUT of spec scope (locked).

## changes/ backlog (FSD targets + contradictions found during audit)

Spawn these as proposals when their capability thread runs:

- **co2-threshold-retune**: code colors at 800/1000 (`dashboard.js:1767`); FSD FR-07 wants 600/1200.
- **stale-sensor-warning**: FSD FR-08 5-min stale warning is NOT implemented.
- **configurable-refresh**: FSD FR-09 configurable, 10s default. Reality: sensors=WS push,
  PV=30s (`dashboard.js:815`), kiosks=5min (`REFRESH_MS`). Nothing configurable.
- **fix-fsd-no-polling-assumption**: FSD §10 / FR-05 says "WebSockets, no polling in scope."
  Reality is mixed push + poll. FSD assumption is false → correct it.
- **room-model-consistency**: FSD/specs anchor on room "105" (nili3). `fake-sensors/README.md`
  lists 103,104,137,214,251,E10,E24,U07 (no 105) and self-contradicts ("7 Rooms" vs 8 rows
  vs "109 more"). Room model inconsistent across sources.

## Security note (out-of-band, not a spec item)

`dashboard-v2/dashboard.js` hard-codes live credentials shipped to every browser:
InfluxDB token (line 3) and Solax client_id/secret/username/password/plant_id (lines 9–13).
Rotate + move server-side independent of this spec effort. Track as its own security change.
