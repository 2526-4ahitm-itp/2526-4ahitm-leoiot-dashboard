# leoiot-pv

New PV data collection, PV dashboard and kiosk displays.

| | |
|---|---|
| **Owning team** | PV-Dashboard — Daniel Lettner, Stefan Schachner |
| **Status** | Not started |
| **Spec group** | `openspec/specs/pv/` |

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Replaces from `legacy/`

- `legacy/solax-collector/`
- `legacy/kiosk/`, `legacy/kiosk2/`, `legacy/kiosk3/`, `legacy/kiosk4/`
- `legacy/leogreenKiosk/`
- the PV views of `legacy/dashboard-v2/`

## Tech stack and scaffolding

The tech stack and the project scaffolding are decided in this sub-project's own first OpenSpec change (`pv-…`). Nothing is set up here yet.
