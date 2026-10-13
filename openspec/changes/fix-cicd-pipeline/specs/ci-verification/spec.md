# Spec Delta

## Purpose

Verifies that every component of the repository still builds and passes its tests before a change is merged, and reports the outcome as one status that branch rules can require.

## ADDED Requirements

### Requirement: Verification runs for every proposed change
The system SHALL run verification for every pull request that targets `main` or `release`, and for every push to `main`, on infrastructure that is not the deployment host.

#### Scenario: Pull request opened
- **WHEN** a pull request targeting `main` is opened or updated
- **THEN** a verification run starts for the pull request's head commit without any manual action

#### Scenario: Superseded commit
- **WHEN** a new commit is pushed to a pull request while verification of the previous commit is still running
- **THEN** the older run is cancelled and only the newest commit is verified

### Requirement: Every component has a verification
For each component, verification SHALL install dependencies from the committed lockfile and build it: the docs site, each Vite app (`frontend`, `dashboard-v2`, `kiosk`, `kiosk2`, `kiosk3`, `kiosk4`, `leogreenKiosk`) and the Quarkus backend. For the Node services without a build step (`fake-sensors`, `mqtt-ws-bridge`, `solax-collector`) it SHALL install dependencies and check that the entry file parses.

#### Scenario: Lockfile out of sync
- **WHEN** a pull request changes a component's `package.json` without updating its lockfile
- **THEN** verification of that component fails and names the component

#### Scenario: Build error in one app
- **WHEN** a pull request introduces a build error in `kiosk3`
- **THEN** the `kiosk3` verification fails while the other components still report their own results

### Requirement: Pull requests verify what they affect
For a pull request, verification SHALL run the checks of every component whose files the pull request changes, and SHALL run all checks when it changes shared files (workflows, the path mapping, or files no component owns). For a push to `main`, verification SHALL run all checks.

#### Scenario: Change inside one sub-project
- **WHEN** a pull request changes only files under `frontend`
- **THEN** the `frontend` check runs and the kiosk, backend and docs checks do not

#### Scenario: Change to a workflow
- **WHEN** a pull request changes a file under `.github/workflows`
- **THEN** every component check runs

#### Scenario: Merge to main
- **WHEN** a pull request that touched only `kiosk2` is merged into `main`
- **THEN** every component check runs for the resulting `main` commit

### Requirement: Backend tests are executed
Verification SHALL run the Quarkus backend's unit tests and fail when any test fails.

#### Scenario: Failing backend test
- **WHEN** a pull request makes a test in `backend/sensor-data-generator` fail
- **THEN** verification fails and the failing test is visible in the run output

### Requirement: Compose definition is validated
Verification SHALL check that `docker-compose.yaml` is a valid Compose definition.

#### Scenario: Invalid compose file
- **WHEN** a pull request leaves `docker-compose.yaml` syntactically or structurally invalid
- **THEN** verification fails before the change can be merged

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
