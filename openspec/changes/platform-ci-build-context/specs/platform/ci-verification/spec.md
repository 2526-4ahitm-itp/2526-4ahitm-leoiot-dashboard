# Spec Delta

## ADDED Requirements

### Requirement: Images can declare a build context
A Dockerfile directory below a `leoiot-*` folder MAY declare its build context in a file `build-context` next to the `Dockerfile`, holding one relative path to an ancestor folder within the same `leoiot-*` folder. Verification SHALL then build the image with that folder as the context and the directory's `Dockerfile`. Without the file the context SHALL be the Dockerfile directory itself. A declared path outside the `leoiot-*` folder, or one that is not an ancestor of the Dockerfile directory, SHALL fail the verification of that image.

#### Scenario: Image with shared code
- **WHEN** `leoiot-pv/kiosk/build-context` holds `..`
- **THEN** the image check of `leoiot-pv/kiosk` builds with `leoiot-pv/` as the context and `leoiot-pv/kiosk/Dockerfile` as the Dockerfile

#### Scenario: No declaration
- **WHEN** `leoiot-pv/collector` has no `build-context` file
- **THEN** its image is built with `leoiot-pv/collector` as the context, as before

#### Scenario: Context outside the sub-project
- **WHEN** a `build-context` file below `leoiot-pv/` holds `../..`
- **THEN** the image check of that directory fails and names the file

### Requirement: Local dependents are verified with their dependency
When a pull request changes a file of a Node component, verification SHALL also run the checks of every Node component in the same `leoiot-*` folder that lists it as a local `file:` dependency in its `package.json`, and SHALL build the images of the Dockerfile directories that own those dependents.

#### Scenario: Change in a shared package
- **WHEN** a pull request changes only `leoiot-pv/shared/src/energy.ts`, and `leoiot-pv/kiosk` and `leoiot-pv/dashboard` depend on `file:../shared`
- **THEN** the checks of `leoiot-pv/shared`, `leoiot-pv/kiosk` and `leoiot-pv/dashboard` run and the images of `leoiot-pv/kiosk` and `leoiot-pv/dashboard` are built

#### Scenario: Change in a dependent
- **WHEN** a pull request changes only files under `leoiot-pv/kiosk`
- **THEN** the checks of `leoiot-pv/kiosk` run and those of `leoiot-pv/shared` and `leoiot-pv/dashboard` do not

#### Scenario: No local dependencies
- **WHEN** a pull request changes only files under `leoiot-pv/collector`, which has no local dependents
- **THEN** the same checks run as without this rule
