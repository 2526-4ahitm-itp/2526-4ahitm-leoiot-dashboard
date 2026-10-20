# Proposal

## Why

A continuation prompt is a self-contained text that lets a fresh agent session go on with unfinished work. The repository has no place for new ones: the only folder, `legacy/continuations/`, is frozen. Prompts kept on one machine or in one session get lost. That happened on 2026-10-15, when work moved from leocloud to a local machine and the latest prompt did not come with it.

## What Changes

- New folder `docs/continuations/` at the root: the one place for continuation prompts of every team.
- A prompt is named after its group and task (`sensors-stale-warning.md`), contains no credentials, and is deleted by the pull request that finishes its work.
- `docs/continuations/README.md` explains the rules, and `AGENTS.md` gets one line that points to it.
- `legacy/continuations/` stays as it is (frozen reference material).

## Capabilities

### New Capabilities

- `platform/continuation-prompts`: where continuation prompts live, how they are named, what they may contain, when they are removed, and that adding one starts no deployment.

### Modified Capabilities

None.

## Impact

- **Files**: new `docs/continuations/README.md`, one line in `AGENTS.md`. Both are shared files, so they go in a pull request of their own.
- **CI**: a file under `docs/` runs only the documentation check. Root `*.md` files and `openspec/` run nothing. No `.github/` change.
- **Deployment**: none. No folder of a deploy unit is touched, so a prompt never causes a redeploy.
- **Other teams**: none of their folders change. They can use the folder from the day it is merged.
