# Design

## Context

See `proposal.md` for the motivation. Facts that shape the approach:

- **The check is in the tool, not in the repository.** `validateChangeName` in the OpenSpec CLI 1.4.1 (`dist/utils/change-utils.js`) accepts only `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. `openspec new change`, `openspec status` and `openspec instructions` run it; `openspec validate` and `openspec list` accepted a hand-made `3d-probe` change in a test on 2026-10-29. The `/opsx:*` workflow uses `status` and `instructions`, so a `3d-…` change cannot be worked on with it.
- **Where `3d` is used as the group:** `AGENTS.md`, `README.md`, `openspec/config.yaml` (project context), `openspec/specs/README.md`, `docs/continuations/README.md`, `leoiot-3d/README.md`, the main spec `platform/continuation-prompts`, the open change `restructure-for-rewrite` (proposal, design and its `platform/repository-layout` delta) and the two 3D prompts in `docs/continuations/`.
- **Nothing exists yet under the group:** no spec in `openspec/specs/3d/` and no `3d-…` change, so no spec or change folder has to move.

## Goals / Non-Goals

**Goals:**

- The 3D group has one name that works everywhere: spec path, change prefix and prompt prefix are the same, as for `platform`, `sensors` and `pv`.
- The OpenSpec CLI and the `/opsx:*` workflow work for 3D changes with the released tool.

**Non-Goals:**

- Renaming the sub-project folder `leoiot-3d/`, its Compose project or the planned address `/3d/`.
- Patching the OpenSpec CLI or asking upstream to allow digit-first names.
- Changing archived changes; they record what was decided then.

## Decisions

### D1. Group name `model3d`

Chosen by the 3D-Modell team (Jonas Leitner) on 2026-10-29. It starts with a letter, keeps "3d" recognisable and matches the team name "3D-Modell".

*Alternative:* keep `3d` as the group and name only changes `threed-…` (rejected: group and change prefix would differ, unlike every other group). *Alternative:* keep `3d` and write changes by hand, since `openspec validate` accepts the name (rejected: loses the `/opsx:*` workflow). *Alternative:* patch the CLI locally (rejected: every machine and agent would need the same patch, and an update drops it).

### D2. The folder `leoiot-3d/` keeps its name

The rule "the group is the sub-project that implements it" maps groups to folders through the table in `openspec/specs/README.md`, not by spelling: `model3d` → `leoiot-3d/`. Renaming the folder would touch CI and deployment (deploy units are named after folders) for no gain, since the CLI never sees folder names.

### D3. The open change `restructure-for-rewrite` is edited in place

Its `platform/repository-layout` delta lists the groups. Archiving it unchanged would write `3d` into the main specs after this change has removed it. This change updates the delta and the matching sentences in its proposal and design; the maintainers who own that change review it in this pull request.

### D4. The 3D prompts follow the new name

`docs/continuations/3d-rewrite-kickoff.md` becomes `model3d-rewrite-kickoff.md` (prompt rule: the group is the prefix), and the change names in it and in `platform-3d-route.md` become `model3d-…`. Its decision list (D1–D12) is not touched. `platform-3d-route.md` keeps its name: its group is `platform`, and `3d` there names the route.

## Risks / Trade-offs

- [A session still has the old rules in mind and proposes `3d-…`] → the CLI refuses the name at once, and the updated rules and prompt give the new prefix.
- [`model3d` and `leoiot-3d/` are spelled differently] → the table in `openspec/specs/README.md` and `leoiot-3d/README.md` name both side by side.
- [Upstream later allows digit-first names] → a later `platform-…` change can rename the group back; nothing outside the docs depends on it.
