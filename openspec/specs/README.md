# Specs

There is one spec tree for the whole repository. Every capability lives under exactly one **group**, and the group is the sub-project that implements it.

```
openspec/
├── config.yaml            project context incl. the grouping rules below
├── specs/
│   ├── README.md          this file
│   ├── platform/          leoiot-platform  — and everything shared
│   │   ├── repository-layout/
│   │   ├── data-contract/           (first change of the rewrite)
│   │   └── ci-verification/ …       (from platform-cicd-pipeline)
│   ├── sensors/           leoiot-sensors
│   ├── pv/                leoiot-pv
│   └── 3d/                leoiot-3d
└── changes/
    ├── platform-…/
    ├── sensors-…/
    ├── pv-…/
    └── 3d-…/
```

## Where does my spec go?

| The behaviour is implemented by | Group | Spec path | Sub-project folder |
|---|---|---|---|
| broker, database, proxy, deployment, CI, repository rules, or relied on by more than one sub-project | `platform` | `openspec/specs/platform/<capability>/spec.md` | `leoiot-platform/` |
| sensor ingestion, room-climate views | `sensors` | `openspec/specs/sensors/<capability>/spec.md` | `leoiot-sensors/` |
| PV data collection, PV dashboard, kiosks | `pv` | `openspec/specs/pv/<capability>/spec.md` | `leoiot-pv/` |
| 3D building model, navigation | `3d` | `openspec/specs/3d/<capability>/spec.md` | `leoiot-3d/` |

## Rules

1. **Path = group / capability.** Every capability lives at `openspec/specs/<group>/<capability>/spec.md`. The group is the sub-project that implements it: `platform` → `leoiot-platform/`, `sensors` → `leoiot-sensors/`, `pv` → `leoiot-pv/`, `3d` → `leoiot-3d/`.
2. **One home per capability.** A capability belongs to exactly one group. If two sub-projects rely on a behaviour, it is not duplicated — it belongs in `platform`.
3. **`platform` owns everything shared.** Broker, database, reverse proxy, deployment, CI, repository rules, and above all the data contract: topics, payloads, measurements, fields, retention. Sub-project specs refer to the contract ("publishes readings as specified in `platform/data-contract`") and never restate topic names or field lists.
4. **Contract first.** A sub-project may not rely on an interface that is not in the platform spec yet. The interface change is proposed and merged first.
5. **Changes are named after their group.** `pv-daily-yield-kiosk`, `sensors-stale-warning`, `platform-data-contract`. A change normally touches specs of one group only. A change that needs another group's spec, or the contract, is a `platform-…` change or is split.
6. **Legacy has no specs here.** `legacy/as-built-specs/` is reference material, not part of the spec tree, and has no change process.
