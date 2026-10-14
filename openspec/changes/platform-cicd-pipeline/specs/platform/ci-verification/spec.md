# Spec Delta

## Purpose

Verifies that every component of the repository still builds and passes its tests before a change is merged, and reports the outcome as one status that branch rules can require. Components are found by rule, so a new sub-project is verified without changing the workflow.

## ADDED Requirements

### Requirement: Verification runs for every proposed change
The system SHALL run verification for every pull request that targets `main` or `release`, and for every push to `main`, on infrastructure that is not the deployment host.

#### Scenario: Pull request opened
- **WHEN** a pull request targeting `main` is opened or updated
- **THEN** a verification run starts for the pull request's head commit without any manual action

#### Scenario: Superseded commit
- **WHEN** a new commit is pushed to a pull request while verification of the previous commit is still running
- **THEN** the older run is cancelled and only the newest commit is verified

### Requirement: Components are discovered by rule
Verification SHALL discover components from the repository tree and SHALL NOT depend on a hand-kept list of applications. A component is the documentation site at the repository root, every directory below it that contains a `package.json` or a `pom.xml`, every Compose file, and every Dockerfile directory below a `leoiot-*` folder.

#### Scenario: New component appears
- **WHEN** a pull request adds a folder with a `package.json` below `leoiot-sensors/`
- **THEN** that folder is verified from then on without any change to the verification workflow

### Requirement: Every component has a verification
A Node component SHALL be installed from its lockfile when it has one, and without creating a lockfile when it has none, using the Node version of its runtime. It SHALL be built when it has a build script; when it has no build script, verification SHALL check that its entry file parses. A Maven component SHALL be built with its `verify` goal.

#### Scenario: Lockfile out of sync
- **WHEN** a pull request changes a component's `package.json` without updating its lockfile
- **THEN** verification of that component fails and names the component

#### Scenario: Build error in one app
- **WHEN** a pull request introduces a build error in `leoiot-pv/kiosk`
- **THEN** the `leoiot-pv/kiosk` verification fails while the other components still report their own results

#### Scenario: Component without lockfile
- **WHEN** a component has no lockfile, such as `legacy/kiosk`
- **THEN** its dependencies are installed without writing a lockfile and the rest of its verification runs

#### Scenario: Service without build step
- **WHEN** a Node component such as `legacy/mqtt-ws-bridge` has no build script
- **THEN** verification installs its dependencies and fails if the entry file does not parse

### Requirement: Tests are executed
Verification SHALL run the tests of every component that has some: `npm test` for a Node component with a `test` script (including Vitest suites) and the Maven `verify` goal, which runs the unit tests, for a Maven component. A failing test SHALL fail the verification.

#### Scenario: Failing Node test
- **WHEN** a pull request makes a test in `leoiot-pv/collector` fail
- **THEN** verification of `leoiot-pv/collector` fails and the failing test is visible in the run output

#### Scenario: Failing backend test
- **WHEN** a pull request makes a test in `legacy/backend/sensor-data-generator` fail
- **THEN** verification fails and the failing test is visible in the run output

### Requirement: Compose definitions are validated
Verification SHALL check that every Compose file in the repository is a valid Compose definition, using the unit's `.env.example` for required variables when it has one.

#### Scenario: Invalid compose file
- **WHEN** a pull request leaves `legacy/docker-compose.yaml` or `leoiot-pv/compose.yaml` syntactically or structurally invalid
- **THEN** verification fails before the change can be merged

#### Scenario: Required variable without default
- **WHEN** a Compose file requires a variable that is only set in the host's `.env`
- **THEN** validation uses the values from the unit's `.env.example` and does not fail because of the missing `.env`

### Requirement: Images of new sub-projects build
Verification SHALL build the image of every Dockerfile below a `leoiot-*` folder, without publishing it.

#### Scenario: Broken Dockerfile
- **WHEN** a pull request breaks the `Dockerfile` of `leoiot-pv/kiosk`
- **THEN** the image build check for that directory fails and no image is pushed anywhere

### Requirement: Legacy services are all mapped
Verification SHALL fail when a service of `legacy/docker-compose.yaml` has no entry in the legacy service map, when an entry names a service that does not exist, or when a `legacy/*` directory containing a `package.json` has no entry.

#### Scenario: New legacy service without map entry
- **WHEN** a pull request adds a service to `legacy/docker-compose.yaml` without adding it to the legacy service map
- **THEN** verification fails and names the service

### Requirement: Pull requests verify what they affect
For a pull request, verification SHALL run the checks of every component that owns a changed file (a changed file belongs to its nearest ancestor component), the Compose check of a unit whose files outside any component changed, and the documentation check for documentation paths. For a push to `main`, verification SHALL run all checks.

#### Scenario: Change inside one component
- **WHEN** a pull request changes only files under `leoiot-pv/kiosk`
- **THEN** the checks of that component run and the documentation, Maven, Compose and every other component check do not

#### Scenario: Change inside a legacy service
- **WHEN** a pull request changes only files under `legacy/frontend`
- **THEN** the `legacy/frontend` check runs and no `leoiot-*` check runs

#### Scenario: Merge to main
- **WHEN** a pull request that touched only `legacy/kiosk2` is merged into `main`
- **THEN** every check runs for the resulting `main` commit

### Requirement: Shared and non-code changes
Verification SHALL run all checks when a pull request changes shared files: workflows, other CI configuration, or files no rule owns. It SHALL run no component check when a pull request changes only specs or root-level Markdown, and SHALL still report the aggregate status.

#### Scenario: Change to a workflow
- **WHEN** a pull request changes a file under `.github/workflows`
- **THEN** every check runs

#### Scenario: Change to a spec only
- **WHEN** a pull request changes only files under `openspec/`
- **THEN** no component check runs and the aggregate status is still reported

### Requirement: Single aggregate result
Verification SHALL publish exactly one aggregate status for every run. It succeeds only when every check that was due succeeded, and fails when a due check failed, was cancelled or did not run, or when it could not be determined which checks were due. A check that was not due because the change does not affect its component counts as passed.

#### Scenario: All checks pass
- **WHEN** every component check succeeds
- **THEN** the aggregate status is successful

#### Scenario: One check is cancelled
- **WHEN** one due component check is cancelled or skipped because an earlier step failed
- **THEN** the aggregate status is a failure

#### Scenario: Unaffected checks
- **WHEN** a pull request affects only one component and that component's check succeeds
- **THEN** the aggregate status is successful and is reported, so the pull request is not left waiting

#### Scenario: Affected set unknown
- **WHEN** the step that determines the affected components fails
- **THEN** the aggregate status is a failure

### Requirement: Verification never deploys
Verification SHALL NOT publish the docs site, change the deployment host, or use the self-hosted runner.

#### Scenario: Pull request from a fork
- **WHEN** a pull request from a fork triggers verification
- **THEN** all jobs run on GitHub-hosted runners with read-only repository access and nothing is deployed
