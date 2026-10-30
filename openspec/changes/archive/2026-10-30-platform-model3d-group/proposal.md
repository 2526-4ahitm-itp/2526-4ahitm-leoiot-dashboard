# Proposal

## Why

The repository rules name the spec group of `leoiot-3d/` `3d` and its changes `3d-…`. The OpenSpec CLI (1.4.1) rejects change names that start with a digit: `openspec new change 3d-building-explorer` fails with "Change name must start with a letter", and `openspec status` and `openspec instructions` refuse such a change, so the `/opsx:*` workflow cannot be used for any 3D change. The 3D-Modell team cannot start its first change (`docs/continuations/3d-rewrite-kickoff.md`) until the group has a name the tool accepts.

## What Changes

- The spec group of `leoiot-3d/` is renamed from `3d` to `model3d`: specs live in `openspec/specs/model3d/<capability>/spec.md`, changes are named `model3d-…`, continuation prompts `model3d-….md`.
- The rule texts that list the groups are updated: `AGENTS.md`, `README.md`, `openspec/config.yaml`, `openspec/specs/README.md`, `docs/continuations/README.md`, `leoiot-3d/README.md`.
- The open change `restructure-for-rewrite` lists `3d` in its `platform/repository-layout` delta; it is updated so that archiving it does not bring the old name back.
- The 3D continuation prompt `docs/continuations/3d-rewrite-kickoff.md` is renamed to `model3d-rewrite-kickoff.md` and its change names are updated; `platform-3d-route.md` refers to the new change name.
- Not renamed: the sub-project folder `leoiot-3d/`, the planned address `/3d/`, the prompt name `platform-3d-route.md` (its group is `platform`) and archived changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform/continuation-prompts`: the list of groups a prompt name may start with says `model3d` instead of `3d`.

## Impact

- **Docs and rules only**: no code, image, Compose file or CI script changes; nothing is deployed.
- **No 3D spec or change exists yet**, so no spec or change folder moves. `openspec/specs/3d/` is not tracked by git.
- **Other teams**: none of their names change. The maintainers see the edit to `restructure-for-rewrite` in this pull request.
- **Follow-up**: the 3D team proposes `model3d-building-explorer` once this is merged.
