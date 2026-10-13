# Proposal

## Why

The app deployment has been dead since 2026-06-02: `deploy.yml` needs a self-hosted runner, none is registered on the repo, and every run since 2026-06-15 (54 in a row) waited 24 hours and was cancelled. Nothing merged in the last four months has reached `vm23.htl-leonding.ac.at` through CI. At the same time nothing is checked before a merge: there is no pull-request CI and no protection on `main`, which is how a broken lockfile landed on `main` on 2026-10-07. Five people in three sub-project teams (Sensoren, PV-Dashboard, 3D-Modell), each driving Claude agents, are about to push to this repository in parallel, so both gaps will get worse quickly — and a pipeline that treats the repo as one block would make every team wait for, and be restarted by, the other two.

## What Changes

- Add a pull-request CI workflow on GitHub-hosted runners that covers every component of the monorepo (docs site, the Vite apps, the Node services, the Quarkus backend with its tests) and validates `docker-compose.yaml`, reporting one aggregate status. On a pull request it verifies only the components the change touches; on `main` it verifies everything.
- Introduce one mapping from repository paths to components, Compose services and sub-projects, used by both CI and deployment, so "what does this change affect" has a single answer.
- Protect `main` and `release` with repository rulesets: changes arrive by pull request only, the aggregate CI status must be green, no force pushes or deletions.
- **BREAKING** Deployment no longer triggers on every push to `main`. It triggers on a push to a new `release` branch (and on a manual run for rollback). Promotion is a pull request from `main` to `release` approved by a human.
- Bring the self-hosted runner on vm23 back as a repo-level runner that survives reboots, with its own label, and restrict it to the deploy workflow.
- Make the deploy job deploy the exact released commit, recreate only the services whose files changed since the last successful deployment, smoke-test the public routes, and fail visibly when they do not answer. Today's `docker compose up -d --build` does not restart the bind-mounted Node services at all, so their changes never go live; and a full restart would blank the PV kiosks for a 3D release.
- Allow a manual deployment scoped to one sub-project or to everything.
- Make a missing runner fail the run within minutes with a clear message instead of a silent 24-hour cancel.
- Harden the existing Pages workflow against the announced runner-image change (pin the image, move off deprecated action versions). Its behaviour stays the same.
- Document the branch and release flow for people and agents (`AGENTS.md`, `CLAUDE.md`, README deployment section).
- Rotate the vm23 SSH password and remove it from the public README, because that host is the deploy target and will run the runner.

Out of scope: moving the app off vm23 (for example to LeoCloud/Kubernetes), replacing the dev-server containers with production builds, managing nginx from CI, and cleaning up the other credentials committed to the repo (InfluxDB token, MQTT password). The last one deserves its own change.

## Capabilities

### New Capabilities
- `ci-verification`: automated build and test verification of every repository component for proposed and merged changes, with a single aggregate result.
- `release-deployment`: how a released commit reaches vm23 — trigger, exact-commit deploy, post-deploy smoke test, rollback, runner availability and runner isolation.
- `branch-governance`: the rules for `main` and `release` — pull requests only, required checks, human approval for releases, and the working agreement for parallel agent work.

### Modified Capabilities

None. The two existing specs (`dashboard-pv`, `dashboard-sensors`) describe dashboard behaviour and are not affected.

## Impact

- **New files**: the path mapping and a small script that turns a commit range into affected components and services, with its own test.
- **Workflows**: new `.github/workflows/ci.yml`; `.github/workflows/deploy.yml` rewritten; `.github/workflows/docs.yaml` pinned and bumped.
- **Repository settings** (need repo admin): two rulesets, a `production` environment limited to `release`, Actions fork-approval setting, a repo-level self-hosted runner.
- **vm23** (needs shell access as `solmqadmin`): runner reinstall as a service, checkout moved from tracking `main` to deploying released commits, password rotation.
- **Repo content**: lockfiles added for `kiosk`, `kiosk4` and `leogreenKiosk` (they have none today, so `npm ci` cannot run); new `AGENTS.md` and `CLAUDE.md`; README deployment section updated.
- **vm23 state**: a marker file outside the checkout records the last successfully deployed commit.
- **Team workflow**: one release train for all three sub-projects — promoting `main` ships everything merged, so unfinished work stays on its branch; direct pushes to `main` stop working for everyone; a merge to `main` no longer deploys; someone has to open and approve a `main` → `release` pull request to ship.
- **First release**: it carries four months of undeployed changes to vm23 at once and needs to be attended.
