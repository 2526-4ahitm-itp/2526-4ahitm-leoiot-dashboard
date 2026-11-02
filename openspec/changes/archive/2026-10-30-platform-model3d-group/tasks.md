# Tasks

## 1. Rules and docs

- [x] 1.1 Replace the group `3d` by `model3d` (group lists, spec path `openspec/specs/model3d/`, change prefix `model3d-…`, tree diagram) in `AGENTS.md`, `README.md`, `openspec/config.yaml`, `openspec/specs/README.md`, `docs/continuations/README.md` and `leoiot-3d/README.md`; keep `leoiot-3d/` and `/3d/` unchanged
- [x] 1.2 Update the open change `restructure-for-rewrite`: group list in `specs/platform/repository-layout/spec.md`, and the group mentions in its `proposal.md` and `design.md` (design D3)

## 2. Continuation prompts

- [x] 2.1 Rename `docs/continuations/3d-rewrite-kickoff.md` to `model3d-rewrite-kickoff.md` with `git mv`, and update its title, spec path and change names (`model3d-building-explorer`, `model3d-room-navigation`, `model3d-german-translation`, `openspec/specs/model3d/`); leave the decisions D1–D12 and the address `/3d/` unchanged
- [x] 2.2 Update the change name in `docs/continuations/platform-3d-route.md` to `model3d-building-explorer` and its reference to the kickoff prompt

## 3. Verify

- [x] 3.1 `git grep` outside `legacy/` and `openspec/changes/archive/` finds no remaining use of `3d` as a spec group or change prefix (`specs/3d`, `` `3d` ``, `3d-…`, `3d-building`, `3d-room`, `3d-german`)
- [x] 3.2 Run `openspec validate platform-model3d-group --strict` and `openspec validate restructure-for-rewrite --strict`; they report no error other than "No deltas found", which every open change with the nested layout `specs/<group>/<capability>/` gets under OpenSpec CLI 1.4.1 (checked 2026-10-29 for `pv-dashboard`, `restructure-for-rewrite`, `platform-pv-counter-stepback`; a separate platform issue)
- [x] 3.3 `openspec new change model3d-probe` succeeds and the probe folder is deleted again
- [x] 3.4 `.github/ci/affected.sh origin/main HEAD` lists only `docs true` (and nothing that deploys); `npm ci && npm run build` at the root passes with Node 22
