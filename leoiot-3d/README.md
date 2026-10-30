# leoiot-3d

New 3D building model and navigation.

| | |
|---|---|
| **Owning team** | 3D-Modell — Paul Kreinecker, Jonas Leitner |
| **Status** | Not started |
| **Spec group** | `openspec/specs/model3d/` |

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Replaces from `legacy/`

- `legacy/frontend/`

## Tech stack and scaffolding

The tech stack and the project scaffolding are decided in this sub-project's own first OpenSpec change (`model3d-…`). Nothing is set up here yet.
