# Spec Delta

## Purpose

Defines how a released commit is rolled out to the vm23 host, how the rollout is checked and rolled back, and how the self-hosted runner that performs it is kept available and isolated.

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
- **WHEN** the checkout on vm23 contains local modifications that conflict with the released commit
- **THEN** the deployment fails with an error naming the conflict and does not discard the local modifications

### Requirement: Only affected services are restarted
A deployment SHALL recreate each service whose files changed between the last successfully deployed commit and the commit being deployed, rebuilding its image where it has one, and SHALL leave services without changes running. A service whose Compose definition changed counts as changed.

#### Scenario: Release touching one sub-project
- **WHEN** a release contains only changes under `frontend`
- **THEN** the `frontend` service is recreated and the kiosk services keep running without interruption

#### Scenario: Node service changed
- **WHEN** a release changes the source or the dependencies of `mqtt-ws-bridge`
- **THEN** `mqtt-ws-bridge` is recreated and afterwards runs the released code with the released dependencies

#### Scenario: Release without service changes
- **WHEN** a release contains only documentation changes
- **THEN** no service is recreated and the deployment still completes and is verified

### Requirement: Changes are measured from the last successful deployment
The system SHALL record the deployed commit only after a deployment passed its verification, and SHALL determine affected services relative to that recorded commit. When no commit is recorded it SHALL recreate all services.

#### Scenario: Deployment after a failed one
- **WHEN** a deployment fails and a later release is deployed
- **THEN** the later deployment also recreates the services the failed deployment was meant to update

#### Scenario: First deployment
- **WHEN** a deployment runs on a host with no recorded commit
- **THEN** all services are recreated

### Requirement: Host configuration outside the stack is flagged
When a deployment contains changes to the reverse-proxy configuration, which the deployment does not apply, the system SHALL say so prominently in the run output.

#### Scenario: nginx configuration changed
- **WHEN** a release changes `deploy/nginx.conf`
- **THEN** the deployment output contains a warning that the configuration must be applied on vm23 by hand

### Requirement: Deployments are serialized
The system SHALL run at most one deployment at a time and SHALL NOT cancel a deployment that has started.

#### Scenario: Two releases in quick succession
- **WHEN** a second release is pushed while the first deployment is still running
- **THEN** the second deployment waits for the first to finish and then runs

### Requirement: Deployment is verified after rollout
After restarting the stack the system SHALL request the public routes of the application and SHALL mark the deployment failed when a route does not answer successfully within the wait period.

#### Scenario: Stack comes up
- **WHEN** all checked routes answer successfully within the wait period
- **THEN** the deployment is marked successful and the deployed commit is recorded in the repository's deployment history

#### Scenario: A service does not come up
- **WHEN** a checked route still fails after the wait period
- **THEN** the deployment is marked failed and the output names the failing route

### Requirement: Rollback to an earlier commit
The system SHALL allow a maintainer to deploy an earlier commit of `release` manually, using the same rollout and verification as an automatic deployment, and to choose whether it recreates the affected services, the services of one sub-project, or all services.

#### Scenario: Manual rollback
- **WHEN** a maintainer starts a manual deployment and names an earlier `release` commit
- **THEN** vm23 is brought to that commit and the post-rollout verification runs

#### Scenario: Forced restart of one sub-project
- **WHEN** a maintainer starts a manual deployment of the current `release` commit scoped to the PV-Dashboard sub-project
- **THEN** the PV-Dashboard services are recreated even though no files changed, and other services keep running

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
