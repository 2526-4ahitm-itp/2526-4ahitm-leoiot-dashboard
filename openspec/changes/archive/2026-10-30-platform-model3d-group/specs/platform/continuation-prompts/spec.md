# Spec Delta

## MODIFIED Requirements

### Requirement: A prompt is named after its group and task
The file name SHALL be `<group>-<task>.md`, in kebab-case, where `<group>` is `platform`, `sensors`, `pv` or `model3d` as in change names. If the prompt continues an OpenSpec change, the file name SHALL be the change name.

#### Scenario: Prompt for an OpenSpec change
- **WHEN** a prompt continues the change `pv-main-kiosk`
- **THEN** its file is `docs/continuations/pv-main-kiosk.md`

#### Scenario: Prompt for work without a change
- **WHEN** a prompt continues sensor work that has no change yet, for example a stale-reading warning
- **THEN** its file name starts with `sensors-`, for example `docs/continuations/sensors-stale-warning.md`

#### Scenario: Prompt for 3D work
- **WHEN** a prompt continues work of the 3D-Modell team in `leoiot-3d/`
- **THEN** its file name starts with `model3d-`, for example `docs/continuations/model3d-building-explorer.md`
