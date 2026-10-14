# Spec Delta

## Purpose

Sets the rules under which several people and their coding agents change the repository in parallel: how changes reach `main`, how `main` is promoted to `release`, what an agent may and may not do on its own, and which layout and spec rules it follows.

## ADDED Requirements

### Requirement: Main changes only through verified pull requests
The repository SHALL reject direct pushes, force pushes and deletion of `main`, and SHALL allow a pull request into `main` to merge only when the aggregate verification status of its head commit is successful.

#### Scenario: Direct push to main
- **WHEN** a contributor or agent pushes a commit directly to `main`
- **THEN** the push is rejected

#### Scenario: Pull request with failing verification
- **WHEN** a pull request into `main` has a failed or missing aggregate verification status
- **THEN** it cannot be merged

### Requirement: Release changes only through approved promotion
The repository SHALL reject direct pushes, force pushes and deletion of `release`, and SHALL allow a pull request into `release` to merge only with a successful aggregate verification status and an approving review from a person other than the pull request's author.

#### Scenario: Promotion without approval
- **WHEN** a pull request from `main` into `release` has passing verification but no approving review
- **THEN** it cannot be merged and nothing is deployed

#### Scenario: Approved promotion
- **WHEN** a pull request from `main` into `release` has passing verification and one approving review
- **THEN** it can be merged, which starts a deployment

### Requirement: Isolated work per task
Each task SHALL be developed on its own short-lived branch created from the current `main`, and concurrent agents on one machine SHALL each use a separate worktree.

#### Scenario: Two agents on one machine
- **WHEN** one person runs two agents on different tasks at the same time
- **THEN** each agent works in its own worktree on its own branch and neither changes the other's files

### Requirement: Agents do not release on their own
Agent instructions in the repository SHALL state that an agent may open pull requests, including a promotion pull request, and SHALL NOT approve or merge a pull request into `release` or change branch rules, workflows' deployment targets or runner configuration without an explicit instruction from its user.

#### Scenario: Agent finishes a feature
- **WHEN** an agent has completed a task and verification passes
- **THEN** it opens a pull request into `main` and does not open or merge a release on its own initiative

### Requirement: Agents follow the repository layout and spec rules
Agent instructions in the repository SHALL state which folder belongs to which team, that `legacy/` is frozen and only receives changes that keep the running system working, that each sub-project's code stays inside its own folder, that specs are grouped by sub-project as described in `openspec/specs/README.md`, and that shared interfaces are specified in `openspec/specs/platform/` before code relies on them.

#### Scenario: Feature request for an old app
- **WHEN** an agent is asked for a new feature in an application under `legacy/`
- **THEN** its instructions direct it to specify the feature for the matching new sub-project instead of changing `legacy/`

#### Scenario: Sub-project needs a new shared interface
- **WHEN** a change in a sub-project, such as `leoiot-pv`, needs a topic, field or other interface that is not specified in `openspec/specs/platform/` yet
- **THEN** a platform change that specifies the interface is opened and merged first, and the sub-project code does not rely on the interface before that

#### Scenario: Code for another sub-project
- **WHEN** an agent working on `leoiot-pv` needs code that lives in `leoiot-sensors` or in `legacy/`
- **THEN** it does not import, copy or mount it, and obtains the behaviour through a platform interface

### Requirement: The flow is documented where agents read it
The repository SHALL contain the branch, pull request, release, layout and spec rules in a file that coding agents load automatically, and the same rules SHALL be reachable from the README.

#### Scenario: New agent session
- **WHEN** an agent starts a session in a fresh clone
- **THEN** the branch, release and layout rules are part of the instructions it loads without being told where to look
