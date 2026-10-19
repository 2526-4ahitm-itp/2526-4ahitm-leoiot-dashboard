# Tasks

## 1. Script and workflow

- [ ] 1.1 Extend `.github/ci/affected.sh`: record `file:` dependencies of `leoiot-*` Node components and add dependents (and their image directories) for a changed dependency, repeating until nothing is added (D2); verify `bash .github/ci/affected.test.sh` still passes unchanged against the real tree
- [ ] 1.2 Change the `images` job in `.github/workflows/ci.yml` to read `<dir>/build-context`, check that it is an ancestor inside the same `leoiot-*` folder, and build with `-f <dir>/Dockerfile <context>` (D1); verify the step's shell logic locally on `leoiot-pv/kiosk` without a `build-context` (same command as before) and with a temporary `build-context` holding `..` and `../..` (builds, fails with the file named)
- [ ] 1.3 Add the throwaway-tree part to `.github/ci/affected.test.sh` with every scenario of `specs/platform/ci-verification/spec.md` (D3); verify it passes and fails when the dependent rule in `affected.sh` is removed

## 2. Documentation

- [ ] 2.1 Describe both rules in `AGENTS.md` ("Run the checks locally", `image <dir>`) and on the Operations page in both languages; verify `npm run build` at the root exits 0

## 3. Merge

- [ ] 3.1 Open the pull request, tell the Sensoren team's lead with its link, and merge after `ci-ok` is green; verify the run shows every check (a `.github/` change runs all) and all pass
- [ ] 3.2 Sync the spec and archive the change once `platform-cicd-pipeline` is archived, so that `platform/ci-verification` exists in `openspec/specs/`; verify `openspec list --specs` shows the two added requirements
