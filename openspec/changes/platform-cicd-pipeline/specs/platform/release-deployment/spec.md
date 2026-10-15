# Spec Delta

## Purpose

Defines how a released commit is rolled out to the vm23 host, one deploy unit at a time, how the rollout is checked and rolled back, and how the self-hosted runner that performs it is kept available and isolated.

A *deploy unit* is a top-level folder with a Compose file: `legacy` and every `leoiot-*` folder that has a `compose.yaml`. Each unit is its own Compose project.

## ADDED Requirements

### Requirement: Deployment is triggered by the release branch
The system SHALL start a deployment to vm23 when a commit is pushed to the `release` branch, and SHALL NOT start one for pushes to any other branch.

#### Scenario: Release branch updated
- **WHEN** a pull request from `main` is merged into `release`
- **THEN** a deployment of the resulting `release` commit starts automatically

#### Scenario: Merge to main
- **WHEN** a pull request is merged into `main`
- **THEN** no deployment to vm23 starts

### Requirement: The exact released commit is deployed
A deployment SHALL bring the checkout on vm23 to exactly the commit that triggered it, so that every service started or restarted afterwards runs that commit.

#### Scenario: Newer commits exist elsewhere
- **WHEN** a deployment for commit A runs while `main` already contains later commits
- **THEN** vm23 ends up running commit A and none of the later commits

#### Scenario: Uncommitted changes on the host
- **WHEN** the checkout on vm23 contains local modifications that conflict with the released commit, for example a lockfile that a container's `npm install` rewrote
- **THEN** the deployment fails with an error naming the conflicting file and the command that restores it, and does not discard the local modifications

### Requirement: Deploy units are updated in a fixed order
A deployment SHALL update the affected deploy units from the folder of each unit, in this order: `leoiot-platform`, then `legacy`, then the other `leoiot-*` units. It SHALL find units by their Compose file, so that a sub-project that adds a `compose.yaml` is deployed without a change to the workflow. If updating a unit fails, it SHALL NOT update the units after it.

#### Scenario: Release touching several units
- **WHEN** a release changes files in `legacy` and in `leoiot-pv`
- **THEN** `legacy` is updated before `leoiot-pv`

#### Scenario: New unit appears
- **WHEN** a release adds `leoiot-sensors/compose.yaml`
- **THEN** that folder is updated as its own Compose project, after `legacy`, without any change to the deployment workflow

#### Scenario: A unit fails
- **WHEN** updating `legacy` fails
- **THEN** the later units are not updated and the deployment is marked failed

### Requirement: Only affected units and services are updated
A deployment SHALL leave a deploy unit untouched when none of its files changed between the last successfully deployed commit and the commit being deployed. In an affected unit that is not `legacy`, it SHALL rebuild the images and recreate the services whose image or definition changed, and SHALL leave the others running. In `legacy`, it SHALL recreate each service whose files changed, and SHALL leave services without changes running. A service whose Compose definition changed counts as changed.

#### Scenario: Release touching one legacy service
- **WHEN** a release contains only changes under `legacy/frontend`
- **THEN** only the `frontend` service is recreated, and no other legacy container and no `leoiot-pv` container is restarted

#### Scenario: Release touching only a new unit
- **WHEN** a release contains only changes under `leoiot-pv/`
- **THEN** the images of `leoiot-pv` are rebuilt and its changed services recreated, and no legacy container is restarted

#### Scenario: Node service changed
- **WHEN** a release changes the source or the dependencies of `legacy/mqtt-ws-bridge`
- **THEN** `mqtt-ws-bridge` is recreated and afterwards runs the released code with the released dependencies

#### Scenario: Release without service changes
- **WHEN** a release contains only documentation or spec changes
- **THEN** no unit is updated and the deployment still completes and is verified

### Requirement: Changes are measured from the last successful deployment
The system SHALL record the deployed commit only after a deployment passed its verification, and SHALL determine affected units and services relative to that recorded commit. When no commit is recorded it SHALL update all units and recreate all legacy services.

#### Scenario: Deployment after a failed one
- **WHEN** a deployment fails and a later release is deployed
- **THEN** the later deployment also updates the units and services the failed deployment was meant to update

#### Scenario: First deployment
- **WHEN** a deployment runs on a host with no recorded commit
- **THEN** all units are updated and all legacy services are recreated

### Requirement: Host-local configuration is preserved
A deployment SHALL NOT create, modify or delete the untracked `.env` file of any unit, and SHALL NOT enable Compose profiles on its own. Optional services behind a profile SHALL run on a host only when that host's `.env` activates the profile. A deployment SHALL fail for a unit whose Compose file cannot be resolved with the host's `.env`, naming what is missing, before changing that unit.

#### Scenario: Optional service not enabled
- **WHEN** a release changes `leoiot-pv/collector` and the host's `leoiot-pv/.env` does not activate the `collector` profile
- **THEN** the deployment does not start the collector

#### Scenario: Optional service enabled on the host
- **WHEN** the host's `leoiot-pv/.env` activates the `collector` profile and a release changes `leoiot-pv/collector`
- **THEN** the deployment rebuilds and recreates the collector

#### Scenario: Host files untouched
- **WHEN** a deployment completes
- **THEN** every `.env` file on the host has the content it had before

#### Scenario: Required configuration missing
- **WHEN** a unit requires a variable that the host's `.env` for that unit does not provide
- **THEN** the deployment fails with Compose's message naming the variable, and the containers of that unit are unchanged

### Requirement: Host configuration outside the stack is flagged
When a deployment contains changes to the reverse-proxy configuration, which the deployment does not apply, the system SHALL say so prominently in the run output. This applies to `legacy/deploy/nginx.conf` and to any `nginx*.conf` below `leoiot-platform/`, and to every deployment that has no recorded previous commit.

#### Scenario: nginx configuration changed
- **WHEN** a release changes `legacy/deploy/nginx.conf`
- **THEN** the deployment output contains a warning that the configuration must be applied on vm23 by hand

#### Scenario: Platform proxy configuration changed
- **WHEN** a release changes an `nginx*.conf` below `leoiot-platform/`
- **THEN** the deployment output contains the same warning

### Requirement: Deployments are serialized
The system SHALL run at most one deployment at a time and SHALL NOT cancel a deployment that has started.

#### Scenario: Two releases in quick succession
- **WHEN** a second release is pushed while the first deployment is still running
- **THEN** the second deployment waits for the first to finish and then runs

### Requirement: Deployment is verified after rollout
After updating the units the system SHALL request the routes listed in the repository's smoke-route file under the public hostname, through the host's reverse proxy, following redirects, and SHALL mark the deployment failed when a route does not end in a successful response within the wait period. A sub-project SHALL add its routes by adding lines to that file.

#### Scenario: Stack comes up
- **WHEN** all listed routes answer successfully within the wait period
- **THEN** the deployment is marked successful and the deployed commit is recorded in the repository's deployment history

#### Scenario: A service does not come up
- **WHEN** a listed route still fails after the wait period
- **THEN** the deployment is marked failed and the output names the failing route

#### Scenario: Route redirects
- **WHEN** a listed route answers with a redirect to a route that answers successfully
- **THEN** the route counts as successful, both before and after the reverse proxy sends it to a new location

### Requirement: Rollback to an earlier commit
The system SHALL allow a maintainer to deploy an earlier commit of `release` manually, using the same rollout and verification as an automatic deployment, and to choose whether it updates the affected units and services, all units, or one named unit.

#### Scenario: Manual rollback
- **WHEN** a maintainer starts a manual deployment and names an earlier `release` commit
- **THEN** vm23 is brought to that commit and the post-rollout verification runs

#### Scenario: Forced restart of one unit
- **WHEN** a maintainer starts a manual deployment of the current `release` commit with the scope `leoiot-pv`
- **THEN** all services of `leoiot-pv` that its `.env` enables are recreated even though no files changed, and the legacy containers keep running

#### Scenario: Commit not on release
- **WHEN** a manual deployment names a commit that is not part of `release`
- **THEN** the deployment is refused before anything on vm23 changes

### Requirement: A missing runner is reported quickly
The system SHALL fail a deployment run with a message stating that the vm23 runner is unavailable when no runner has picked up the deployment within 10 minutes.

#### Scenario: Runner offline
- **WHEN** a release is pushed while the vm23 runner is offline
- **THEN** the run fails within about 10 minutes with a message that the runner is unavailable, instead of waiting 24 hours

### Requirement: The runner survives host restarts
The vm23 runner SHALL start automatically when the host boots and reconnect without manual action.

#### Scenario: Host reboot
- **WHEN** vm23 is rebooted
- **THEN** the runner is shown as online again in the repository settings without anyone logging in to the host

### Requirement: The runner only executes released code
The self-hosted runner SHALL execute jobs only for commits on `release`, and SHALL NOT execute jobs triggered by pull requests or by any other branch.

#### Scenario: Pull request changes a workflow
- **WHEN** a pull request, including one from a fork, modifies a workflow to request the self-hosted runner
- **THEN** no job from that pull request is executed on vm23
