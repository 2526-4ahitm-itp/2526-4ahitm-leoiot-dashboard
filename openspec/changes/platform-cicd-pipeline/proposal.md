# Proposal

## Why

The app deployment has been dead since 2026-06-02: `deploy.yml` needs a self-hosted runner, none is registered on the repo, and every run since 2026-06-15 (54 in a row) waited 24 hours and was cancelled. Nothing merged in the last four months has reached `vm23.htl-leonding.ac.at` through CI. Since the repository was restructured, the workflow would also be wrong if it ran: it calls `docker compose` in the repository root, and the Compose file of the running system now lives in `legacy/`.

At the same time nothing is checked before a merge: there is no pull-request CI and no protection on `main`. A broken lockfile landed on `main` on 2026-10-07, and on 2026-10-13/14 fifteen commits reached `main` by direct push, without a pull request and without review; one of them refers to a spec, `platform/data-contract`, that does not exist yet. The restructure divided the repository into `legacy/` (the running system, frozen) and four sub-project folders (`leoiot-platform/`, `leoiot-sensors/`, `leoiot-pv/`, `leoiot-3d/`), and `leoiot-pv/` already carries real code with its own Compose project. Five people in three sub-project teams (Sensoren, PV-Dashboard, 3D-Modell) plus a platform group that has no owner yet, each driving Claude agents, push to this repository in parallel, so both gaps will get worse quickly — and a pipeline that treats the repo as one block would make every team wait for, and be restarted by, the others.

## What Changes

- Add a pull-request CI workflow on GitHub-hosted runners that finds the components of the monorepo by rule instead of by list (every folder with a `package.json` or `pom.xml`, every Compose file, every `leoiot-*` image with a `Dockerfile`, and the docs site), checks each one (install, tests, build or syntax check, Maven `verify`, `docker compose config`, `docker build`) and reports one aggregate status. On a pull request it verifies only the components the change touches; on `main` it verifies everything.
- Introduce one set of CI configuration files under `.github/ci/` — an affected-set script with its test, a map from `legacy/` paths to legacy Compose services, and a list of smoke-test routes — used by both CI and deployment, so "what does this change affect" has a single answer and a new sub-project is picked up without editing the workflow.
- Protect `main` and `release` with repository rulesets: changes arrive by pull request only, the aggregate CI status must be green, no force pushes or deletions.
- **BREAKING** Deployment no longer triggers on every push to `main`. It triggers on a push to a new `release` branch (and on a manual run for rollback). Promotion is a pull request from `main` to `release` with green `ci-ok`, merged by a person.
- Deploy per *deploy unit*: a top-level folder with a Compose file — `legacy` and every `leoiot-*` folder that has a `compose.yaml` (today `leoiot-pv`). Each unit is its own Compose project, run from its folder so its own host-local `.env` is used. The deploy job updates only the units a release touches, in a fixed order.
- Make the deploy job deploy the exact released commit, update only what changed since the last successful deployment — legacy per service (its Node containers bind-mount the repo and need a forced recreate), new units by rebuilding their images — smoke-test the public routes, and fail visibly when they do not answer. Today's `docker compose up -d --build` does not restart the bind-mounted Node services at all, so their changes never go live; and a full restart would blank the PV kiosk for a legacy-only release.
- Allow a manual deployment of everything or of one unit.
- Bring the self-hosted runner on vm23 back as a repo-level runner that survives reboots, with its own label, and restrict it to the deploy workflow.
- Make a missing runner fail the run within minutes with a clear message instead of a silent 24-hour cancel.
- Harden the existing Pages workflow against the announced runner-image change (pin the image, move off deprecated action versions). Its behaviour stays the same.
- Document the branch, release and layout rules for people and agents (`AGENTS.md`, `CLAUDE.md`, README deployment section).
- Rotate the vm23 SSH password and remove it from the public `legacy/README.adoc`, because that host is the deploy target and will run the runner.

Out of scope: moving the app off vm23 (for example to LeoCloud/Kubernetes), replacing the legacy dev-server containers with production builds, managing nginx from CI, the PV kiosk cut-over on vm23 (switching nginx to `leoiot-pv`), and cleaning up the other credentials committed to the repo (InfluxDB token, MQTT password). The last one deserves its own change.

## Capabilities

### New Capabilities
- `platform/ci-verification`: automated build and test verification of every repository component for proposed and merged changes, with a single aggregate result.
- `platform/release-deployment`: how a released commit reaches vm23 — trigger, exact-commit deploy per deploy unit, selective update, post-deploy smoke test, rollback, runner availability and runner isolation.
- `platform/branch-governance`: the rules for `main` and `release` — pull requests only, required checks, promotion to `release` by pull request only, and the working agreement for parallel agent work, including the layout and spec rules agents must follow.

### Modified Capabilities

None. The existing specs (`dashboard-pv`, `dashboard-sensors`) describe legacy dashboard behaviour and are not affected; `platform/repository-layout` comes from `restructure-for-rewrite` and is only referred to.

## Impact

- **New files**: `.github/ci/affected.sh` (turns a commit range into affected components, units and legacy services) with its test `.github/ci/affected.test.sh`, `.github/ci/legacy-services.map` and `.github/ci/smoke-routes`. No lockfiles are added anywhere.
- **Workflows**: new `.github/workflows/ci.yml`; `.github/workflows/deploy.yml` rewritten; `.github/workflows/docs.yaml` pinned and bumped.
- **Repository settings** (need repo admin): two rulesets, a `production` environment limited to `release`, Actions fork-approval setting, a repo-level self-hosted runner.
- **vm23** (needs shell access as `solmqadmin`): runner reinstall as a service, checkout moved from tracking `main` to deploying released commits, password rotation, a check that each unit's host-local `.env` exists.
- **Repo content**: new `AGENTS.md` and `CLAUDE.md`; README deployment section and the `legacy/README.adoc` password lines updated.
- **vm23 state**: a marker file outside the checkout records the last successfully deployed commit. Host `.env` files stay untracked and are never touched by the deploy.
- **Team workflow**: one release train for all teams — promoting `main` ships everything merged, so unfinished work stays on its branch; direct pushes to `main`, which people use today, stop working for everyone; a merge to `main` no longer deploys; someone has to open and merge a `main` → `release` pull request to ship.
- **First release**: there is no recorded deployed commit, so it updates every unit and recreates every legacy service at once and needs to be attended.
