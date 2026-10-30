# platform/continuation-prompts Specification

## Purpose
Continuation prompts let a fresh agent session, on any machine, go on with unfinished work. This capability fixes where they live, how they are named, what they may contain and when they are removed, so that every team finds them in the same place and none is lost.

## Requirements

### Requirement: Continuation prompts live in one folder at the root
A continuation prompt SHALL be a Markdown file directly in `docs/continuations/`. No continuation prompt SHALL be added to a sub-project folder, to `openspec/` or to `legacy/`. `legacy/continuations/` is frozen reference material and gets no new prompts.

#### Scenario: A team saves a prompt
- **WHEN** a member of any team saves a prompt for unfinished work in the repository
- **THEN** the file is `docs/continuations/<name>.md`, whichever sub-project the work belongs to

#### Scenario: A prompt in a sub-project folder
- **WHEN** a pull request adds a continuation prompt below `leoiot-sensors/`, `leoiot-pv/`, `leoiot-3d/`, `leoiot-platform/`, `openspec/` or `legacy/`
- **THEN** the reviewer asks for it to be moved to `docs/continuations/`

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

### Requirement: A prompt is self-contained and holds no secrets
A prompt SHALL name the branch or change it continues, the state of the work and the next steps, so that a session with no earlier context can go on from it. It SHALL NOT contain credentials, tokens, the contents of `.env` files or the credentials found in `legacy/`.

#### Scenario: A fresh session reads a prompt
- **WHEN** a new session on another machine is given only the prompt and the repository
- **THEN** it can tell which branch or change to open and what to do next, without asking for earlier conversation

#### Scenario: Work that needs a secret
- **WHEN** the next step needs a password or token
- **THEN** the prompt names the variable or where the person running it gets it, never the value

### Requirement: A prompt is removed when its work is finished
A prompt SHALL describe unfinished work only. The pull request that finishes the work SHALL delete the prompt, and a prompt replaced by a newer one for the same task SHALL be deleted in the same commit that adds the new one. Git history keeps the deleted prompts.

#### Scenario: The last task of a change is merged
- **WHEN** the pull request that completes `pv-main-kiosk` is opened
- **THEN** it deletes `docs/continuations/pv-main-kiosk.md`

#### Scenario: A newer prompt for the same task
- **WHEN** a session writes a new prompt for a task that already has one
- **THEN** the old file is replaced in place, so the task has exactly one prompt

### Requirement: Saving a prompt starts no deployment
A change that only adds, edits or deletes files in `docs/continuations/` SHALL run no CI check except the documentation check, and SHALL update no deploy unit when it is promoted.

#### Scenario: CI for a prompt-only pull request
- **WHEN** `.github/ci/affected.sh` is given only `docs/continuations/sensors-stale-warning.md`
- **THEN** it prints `docs true` and no `node`, `maven`, `compose`, `image`, `unit` or `service` line
