# leoiot-sensors

New sensor ingestion and room-climate views (CO₂ and temperature per room).

| | |
|---|---|
| **Owning team** | Sensoren — Elias Pointinger (project lead) |
| **Status** | Not started |
| **Spec group** | `openspec/specs/sensors/` |

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Replaces from `legacy/`

- `legacy/sensorbox/`
- `legacy/fake-sensors/`
- `legacy/backend/sensor-data-generator/`
- the sensor views of `legacy/dashboard-v2/`

## Tech stack and scaffolding

The tech stack and the project scaffolding are decided in this sub-project's own first OpenSpec change (`sensors-…`). Nothing is set up here yet.
