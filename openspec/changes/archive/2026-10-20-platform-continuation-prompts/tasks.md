# Tasks

## 1. Folder and rules

- [x] 1.1 Create `docs/continuations/README.md` with the short form of the rules (location, `<group>-<task>.md` naming, required contents, no secrets, delete with the finishing pull request) and a link to `openspec/specs/platform/continuation-prompts/spec.md`; verify the file exists and the link resolves after the change is archived
- [x] 1.2 Add one line to `AGENTS.md` that points to `docs/continuations/README.md` for continuation prompts; verify with `grep -n continuations AGENTS.md`

## 2. Verification

- [x] 2.1 Run `openspec validate platform-continuation-prompts --strict` and verify it passes
- [x] 2.2 Run `.github/ci/affected.sh origin/main HEAD` (bash 4 or later) and verify it prints only `docs true`, then run `npm ci && npm run build` at the root (Node 22) and verify the build passes
