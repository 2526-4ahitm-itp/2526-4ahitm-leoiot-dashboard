# Proposal

## Why

`pv-dashboard` adds a local package `leoiot-pv/shared/` that the kiosk and the new dashboard both depend on. CI cannot verify that today: it builds every image with `docker build <dir>`, so a `Dockerfile` cannot copy anything from outside its own folder, and a change in `leoiot-pv/shared/` checks only that package, not the kiosk and dashboard that are built from it. Any sub-project that shares code between its own components meets the same limits.

## What Changes

- A `Dockerfile` directory below a `leoiot-*` folder may declare a build context that is an ancestor folder within the same sub-project, in a file `build-context` next to the `Dockerfile`. CI then builds with `docker build -f <dir>/Dockerfile <context>`. Without the file nothing changes.
- When a file of a Node component changes, CI also checks every Node component of the same sub-project that depends on it through a local `file:` dependency, and builds their images.
- `.github/ci/affected.test.sh` covers both rules; `AGENTS.md` and the Operations page describe them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform/ci-verification` (from `platform-cicd-pipeline`, not yet archived): two added requirements, a declared build context for images and verification of local dependents. Existing requirements stay as they are.

## Impact

- **Files**: `.github/ci/affected.sh`, `.github/ci/affected.test.sh`, `.github/workflows/ci.yml` (image job), `AGENTS.md`, the Operations page in both languages. A change in `.github/` makes CI run every check once.
- **Deployment**: none. The deployment builds through Compose, where each unit sets the build context in its own `compose.yaml`.
- **Other teams**: no existing component has a `build-context` file or a `file:` dependency, so their checks run exactly as before. The CI was set up by the Sensoren team's lead; he is told about this change with a link to the pull request.
- **Unblocks** `pv-dashboard`.
