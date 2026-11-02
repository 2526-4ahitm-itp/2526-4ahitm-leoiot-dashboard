# Continuation prompts

A continuation prompt is a self-contained text that lets a fresh session on any machine go on with unfinished work. This folder is the one place for them, for every team. The rules are in the spec [`platform/continuation-prompts`](../../openspec/specs/platform/continuation-prompts/spec.md); this page is the short form.

## Name

`<group>-<task>.md`, in kebab-case. The group is `platform`, `sensors`, `pv` or `model3d`, as in change names. If the prompt continues an OpenSpec change, the file name is the change name.

Examples: `pv-main-kiosk.md`, `sensors-stale-warning.md`.

## Content

A prompt names the branch or change it continues, the state of the work and the next steps. A session with no earlier conversation must be able to go on from it.

## No secrets

Never write credentials, tokens, `.env` contents or the credentials found in `legacy/` into a prompt. Name the variable, or say where the person running it gets the value.

## Lifecycle

- Commit the prompt on the task's branch, so it is pushed and not lost.
- One prompt per task. A newer prompt replaces the old one in place.
- The pull request that finishes the work deletes the prompt. Git history keeps the old versions.

## Not here

Do not put prompts in a sub-project folder, in `openspec/` or in `legacy/`. `legacy/continuations/` is frozen reference material.

A change that only touches this folder runs just the documentation check in CI and deploys nothing.
