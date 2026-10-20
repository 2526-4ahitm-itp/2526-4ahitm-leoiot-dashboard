# Design

## Context

See `proposal.md` for motivation. `.github/ci/affected.sh` (design D11 of `platform-cicd-pipeline`) discovers components from tracked files and assigns each changed file to its nearest ancestor Node or Maven component and its nearest ancestor Dockerfile directory below `leoiot-*`. The `images` job in `.github/workflows/ci.yml` runs `docker build "$IMAGE_DIR"`. `affected.test.sh` tests the script against the real tree with fixed lists of changed files. The deployment builds through `docker compose up -d --build`, where `compose.yaml` sets the context.

## Goals / Non-Goals

**Goals:**

- A sub-project can share code between its own components and still have every image built in CI.
- Nothing changes for components that do not opt in.

**Non-Goals:**

- Sharing between sub-projects; that stays forbidden and goes through `platform` interfaces.
- npm workspaces or a common lockfile.

## Decisions

### D1. Declaration in a file `build-context` next to the `Dockerfile`

One line, a relative path such as `..`. `affected.sh` keeps printing `image <dir>`; the `images` job calls `.github/ci/image-build.sh <dir>`, which reads `<dir>/build-context` when present, fails unless the path is an ancestor of `<dir>` inside the same `leoiot-*` folder, and runs `docker build -f "$dir/Dockerfile" "$context"`. A script rather than inline workflow code, so that people run the same build locally and the test covers it (`--print`).

*Why a file:* CI and humans see the declaration where the `Dockerfile` is, and `affected.sh` can find it with the same `git ls-files` walk. *Alternative:* read the context from the unit's `compose.yaml` (rejected: needs YAML parsing in the script and couples CI to service names). *Alternative:* a comment line in the `Dockerfile` (rejected: easy to break unnoticed by editing the `Dockerfile`). *Alternative:* always build with the sub-project root as context (rejected: changes every existing image build at once).

### D2. Dependents from `file:` entries in `package.json`

While walking the tree, `affected.sh` reads each `leoiot-*` component's `package.json` and records entries in `dependencies` and `devDependencies` whose value starts with `file:`, resolved relative to the component. When a changed file belongs to a component that others depend on, those dependents are added as Node components, and their nearest Dockerfile directories as images. One level is enough; a dependency chain is resolved by repeating until nothing is added.

Reading JSON uses `node -e` (Node is present on the runner and locally for everyone who runs the checks); `jq` would also work but is not needed elsewhere in the script.

*Alternative:* follow the TypeScript import graph (rejected: much more work for the same answer in this repository).

### D3. Tests with a throwaway tree

The rules need components that do not exist on `main` yet. `affected.test.sh` gets a part that creates a temporary Git repository with a minimal `leoiot-x/` tree (a shared package, two dependents, one with `build-context`), copies `affected.sh` and the legacy map into it and runs the scenarios of the spec there. The checks against the real tree stay unchanged and must still pass.

## Risks / Trade-offs

- **A shared folder makes every PV pull request slower** → only components with a `file:` dependency on the changed one are added; a change in `kiosk/` alone still runs only the kiosk.
- **`node` is missing where someone runs `affected.sh`** → the script fails with a message naming `node`; CI always has it.
- **A malformed `build-context`** → the image check fails and names the file (spec scenario).

## Migration Plan

One pull request; no deployment effect. Rollback by reverting it, which is safe as long as no component relies on the two rules yet.
