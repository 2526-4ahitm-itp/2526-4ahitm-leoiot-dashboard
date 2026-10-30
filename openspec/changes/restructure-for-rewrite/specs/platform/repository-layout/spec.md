# Spec Delta

## Purpose

Defines how the repository is divided between the legacy system and the new sub-projects, what each part may depend on, and where specs and shared contracts live, so several teams and their agents can rebuild the system in parallel.

## ADDED Requirements

### Requirement: The repository is divided into legacy and four sub-projects
The repository SHALL contain the running legacy system in `legacy/` and one top-level folder per new sub-project: `leoiot-platform/`, `leoiot-sensors/`, `leoiot-pv/` and `leoiot-3d/`. Each sub-project folder SHALL state its purpose, owning team and status in a README.

#### Scenario: Newcomer looks for the PV code
- **WHEN** a person or agent opens the repository root
- **THEN** the folder names and their READMEs show that new PV work belongs in `leoiot-pv/` and the old PV code is in `legacy/`

### Requirement: New code lives in exactly one sub-project
All code of a new implementation SHALL live inside its sub-project folder. The repository root SHALL hold only repository-wide material: the documentation site, specs, agent and CI configuration, and licence and overview files.

#### Scenario: New application file at the root
- **WHEN** a change adds application code outside the four sub-project folders
- **THEN** it does not conform to the layout and is moved into the owning sub-project before merge

### Requirement: Sub-projects do not depend on each other's files
A sub-project SHALL NOT import, copy at build time, or mount files from another sub-project folder or from `legacy/`. Sub-projects SHALL interact only through the interfaces the platform sub-project specifies.

#### Scenario: PV needs a sensor value
- **WHEN** the PV implementation needs room-climate data
- **THEN** it reads it through the platform's specified data interface and does not reference files in `leoiot-sensors/`

#### Scenario: Reusing legacy code
- **WHEN** a new implementation wants logic that exists in `legacy/`
- **THEN** the logic is re-specified and re-implemented in the sub-project, and nothing in the sub-project references a path under `legacy/`

### Requirement: Legacy is frozen
`legacy/` SHALL receive only changes needed to keep the running system working or to remove parts a new implementation has replaced. New features SHALL NOT be added to it.

#### Scenario: Feature request for the old dashboard
- **WHEN** someone asks for a new feature in a legacy app
- **THEN** it is specified for the corresponding new sub-project and `legacy/` stays unchanged

#### Scenario: Legacy service stops working
- **WHEN** a legacy service that is still in use breaks
- **THEN** a fix inside `legacy/` is allowed

### Requirement: Legacy stays deployable with its data
Until every route is served by a new implementation, the legacy stack SHALL be startable from `legacy/` and SHALL use the same data volumes it used before the move.

#### Scenario: First start from the new location
- **WHEN** the legacy stack is started from `legacy/` on a host that ran it from the repository root before
- **THEN** InfluxDB shows the previously collected data and no new empty data volumes are created

#### Scenario: Scheduled backup
- **WHEN** the weekly InfluxDB backup is due after the move
- **THEN** it runs from the script's new location and produces a backup

### Requirement: Specs are grouped by sub-project
The repository SHALL have a single spec tree. Every capability SHALL live under exactly one group — `platform`, `sensors`, `pv` or `model3d` — matching the sub-project that implements it, and the grouping rules SHALL be part of the context agents receive when they create spec artifacts.

#### Scenario: Agent proposes a PV capability
- **WHEN** an agent creates a spec for a new PV kiosk behaviour
- **THEN** the capability path starts with `pv/`

#### Scenario: Capability needed by two sub-projects
- **WHEN** a behaviour is relied on by more than one sub-project
- **THEN** its capability lives under `platform/` and the sub-project specs refer to it instead of restating it

### Requirement: Shared interfaces are specified once, in the platform group
Message topics, payload formats, stored measurements and fields, and any other interface between sub-projects SHALL be specified in the `platform` group. A change to such an interface SHALL be made in the platform spec before any sub-project relies on it.

#### Scenario: Sensor payload gains a field
- **WHEN** the sensors sub-project wants to publish an additional field
- **THEN** the platform interface spec is changed first and the other sub-projects can see the change there

### Requirement: The documentation site says what it describes
While the documentation site describes the legacy system rather than the new implementations, every documentation page SHALL carry a visible notice saying so.

#### Scenario: Reader opens the architecture page
- **WHEN** a reader opens a documentation page that still describes the legacy system
- **THEN** a notice states that the page describes the previous implementation and is being updated
