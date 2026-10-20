# Design

## Context

Agents hand work between sessions with continuation prompts. The old ones are in `legacy/continuations/`, which is frozen. Several teams work in parallel, each in its own sub-project folder. `.github/ci/affected.sh` decides what CI checks and what a promotion deploys from the changed paths, so the folder for prompts also decides what saving a prompt costs.

## Goals / Non-Goals

**Goals:**
- One place for prompts that every team and every machine finds.
- Saving a prompt costs no more than one cheap check and never redeploys anything.

**Non-Goals:**
- Moving or editing `legacy/continuations/` (frozen).
- Publishing the prompts on the documentation site.
- A template every prompt has to follow. The README lists what a prompt must contain and no more.

## Decisions

**D1: `docs/continuations/` at the root.** `docs/` is the platform's folder for working documents (it already holds the functional specification). `affected.sh` maps `docs/*` to the documentation check only, and the case `docs/functional-specification.md` in `affected.test.sh` already tests that rule, so no `.github/` change is needed. Alternatives:
- `leoiot-3d/continuations/`: the 3D team owns that folder, and prompts of the other teams do not belong there.
- `<sub-project>/continuations/` per team: `affected.sh` treats any file in a sub-project with a `compose.yaml` as a change to that deploy unit. Today a prompt in `leoiot-pv/` would trigger the Compose check and a redeploy of `leoiot-pv` at the next promotion, and so would the other sub-projects once they get a `compose.yaml`. Cross-team prompts would also have no home.
- A new root folder `continuations/`: no rule in `affected.sh` owns it, so every change there runs every check.
- `openspec/`: free in CI, but the spec tree has fixed rules and prompts are not specs.
- Keeping prompts only on a machine or in agent memory: exactly what lost the last prompt.

**D2: The name is `<group>-<task>.md`, the change name when there is one.** This matches the change naming, so `ls docs/continuations/` sorts the prompts by team, and a prompt is easy to match to its change.

**D3: Prompts are removed with their work.** This keeps the folder to open work only. The prompt is committed on the task's branch, so it is pushed and safe before the pull request merges. Git history keeps every older version.

**D4: The rules are written once, in the spec.** `docs/continuations/README.md` gives the short form for people and agents and links to the spec. `AGENTS.md` gets one line pointing to the README, in the same way it points to `openspec/specs/README.md`.

## Risks / Trade-offs

- [Prompts that are never deleted pile up] → The finishing pull request deletes its prompt (spec requirement). A reviewer can see from the file name which change or branch a prompt belongs to.
- [A prompt leaks a secret] → The spec and the README forbid it. The repository's general credential rule in `AGENTS.md` also applies.
- [A later change to `affected.sh` makes `docs/*` deploy something] → The existing test case for `docs/functional-specification.md` fails first, and the spec scenario names the expected output.
