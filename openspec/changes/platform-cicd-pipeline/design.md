# Design

## Context

See `proposal.md` for motivation. The facts that shape the approach:

- **Deploy target.** The app runs on `vm23.htl-leonding.ac.at` from one checkout, `/home/solmqadmin/2526-4ahitm-leoiot-dashboard`. As of 2026-10-14 its `git status` is clean. It hosts two Compose projects:
  - the legacy stack, project name `2526-4ahitm-leoiot-dashboard`, defined in `legacy/docker-compose.yaml` and run from `legacy/`. Services: `mosquitto`, `influxdb`, `telegraf`, `frontend`, `grafana`, `quarkus-app`, `dashboard-v2`, `fake-sensors`, `mqtt-ws-bridge`, `kiosk`, `kiosk2`, `kiosk3`, `kiosk4`, `leogreen-kiosk`, `solax-collector`, on the network `leoiot`;
  - `leoiot-pv`, defined in `leoiot-pv/compose.yaml` and run from `leoiot-pv/`: the service `kiosk` (image built from `./kiosk`, published on `127.0.0.1:8088`) and the service `collector` behind the Compose profile `collector`. It joins the legacy network `2526-4ahitm-leoiot-dashboard_leoiot` as an external network, and Compose refuses to start it without `leoiot-pv/.env` (git-ignored, created from `.env.example`; `KIOSK_INFLUX_TOKEN` is required).
- **nginx.** nginx on the host (not in Compose) is configured by hand. The live file is `/etc/nginx/sites-available/leoiot`, copied from `legacy/deploy/nginx.conf`, not linked to it. It proxies `/`, `/dashboard/`, `/kiosk/` … `/kiosk4/`, `/leogreen/`, `/grafana/`, `/influx/` and `/ws` to the containers. The version of `legacy/deploy/nginx.conf` on `main` already contains the PV kiosk cut-over (`/kiosk/` and `/kiosk/ws` to port 8088, redirects from `/kiosk2/`, `/kiosk3/`, `/kiosk4/` and `/leogreen/` to `/kiosk/`); this is not applied on vm23 yet. The host answers on HTTPS today, so it is alive; only the runner is gone.
- **How the legacy stack runs.** Most legacy services are `node:20-alpine` containers that bind-mount their folder under `legacy/` and run `npm install && npm run dev` (or `node index.js`). `docker compose up` therefore returns long before the apps answer. Because `npm install` writes into the bind mount, the containers create root-owned, untracked `package-lock.json` files on the host, and once rewrote the tracked `legacy/solax-collector/package-lock.json`, which blocked a `git pull` on vm23.
- **What `compose up` actually updates.** Compose recreates a container only when its image or its service definition changed. For the legacy bind-mounted services neither changes on a normal release, so `docker compose up -d --build` rebuilds `quarkus-app` and leaves everything else running. The Vite dev servers happen to pick up new files through file watching; `fake-sensors`, `mqtt-ws-bridge` and `solax-collector` keep running old code, and no service installs new dependencies, until something restarts them. This follows from the compose file and Compose's documented behaviour; it has not been observed on vm23. The new units are different: their code is baked into images, so a code change changes the image and `up --build` recreates the service.
- **Teams.** Sensoren (1 person), PV-Dashboard (2), 3D-Modell (2), per `src/content/docs/docs/project.md`, plus the platform group (`leoiot-platform/`: broker, database, proxy, deployment, CI, data contract), which has no owner yet. Legacy has no team; it is frozen. The sub-projects share one host and one data path (MQTT → Telegraf → InfluxDB), which for now is still the legacy stack.
- **Runner.** The repo has zero registered runners. Whether an org-level runner exists is not visible without org-admin rights. A runner that stays disconnected for 14 days is removed by GitHub, which fits the timeline (last success 2 June, first cancel 15 June) but is not confirmed.
- **Network.** The legacy README says the school firewall only lets port 80/443 through to vm23. Inbound SSH from GitHub's runners is therefore assumed unavailable; this was not tested.
- **Repo is public.** A self-hosted runner on a public repo executes whatever a workflow tells it to, so which events can reach it is a security decision.
- **Monorepo without a workspace.** The root `package.json` builds only the Astro docs. Ten Node components live under `legacy/` (`frontend`, `dashboard-v2`, `kiosk`, `kiosk2`, `kiosk3`, `kiosk4`, `leogreenKiosk`, `fake-sensors`, `mqtt-ws-bridge`, `solax-collector`); `kiosk`, `kiosk4` and `leogreenKiosk` have no lockfile. The Quarkus backend in `legacy/backend/sensor-data-generator` targets Java 21 and has three test classes. `leoiot-pv/kiosk` and `leoiot-pv/collector` are Node 22 apps, each with `package.json`, `package-lock.json`, a `Dockerfile` (`node:22-alpine`), `npm test` (Vitest) and `npm run build`. More folders of this kind will appear in the other sub-projects.
- **Team habits.** Five people, each running Claude agents (the repo also carries `.gemini`, `.opencode` and `.qwen` configs), all with push rights. On 2026-10-13/14 fifteen commits reached `main` by direct push.

## Goals / Non-Goals

**Goals:**

- A merge into `release` reliably ends with vm23 running that commit, or with a red run that says why.
- A broken build cannot reach `main`, whoever or whatever opened the pull request.
- A dead runner is noticed in minutes.
- One sub-project's pull request or release does not wait for, or restart, the others: a legacy-only release does not rebuild PV images and a PV-only release does not restart a legacy container.
- A new sub-project folder with the usual shape (package files, Dockerfile, Compose file) is verified and deployed without editing the workflows.
- The whole flow is simple enough to state in a few lines of agent instructions.

**Non-Goals:**

- Changing where or how the app runs (no Kubernetes/LeoCloud move, no production builds for legacy, no image registry).
- Bringing nginx under CI control, or applying the PV kiosk cut-over to nginx on vm23.
- Staging or preview environments.
- Independent release branches or version numbers per sub-project (see D1).
- Contract or integration tests between the sub-projects.
- Changing `legacy/` beyond removing a secret from its README and documenting the new deployment: legacy stays frozen, which is also why no lockfiles are committed for it (see D7).
- Rotating the InfluxDB token and MQTT password committed in `legacy/docker-compose.yaml` and the JS sources (separate change).
- Linting, type checks or new tests beyond what exists.

## Decisions

### D1. Deploy on push to `release`, promote by pull request from `main`

`deploy.yml` triggers on `push` to `release` and on `workflow_dispatch`. Shipping means opening a pull request `main` → `release` and merging it with a merge commit.

*Why:* with five agents merging into `main` many times a day, deploying each merge would restart the kiosks constantly and make "what is live" a moving target. A promotion pull request gives one visible, reviewable place that lists exactly which commits go out.

*Alternatives:* deploy every push to `main` (today's behaviour — rejected for the reason above); version tags or GitHub Releases as the trigger (works, but tags cannot be gated by review the way a pull request can, and the team asked for a branch); a manual-only dispatch (no audit trail of what was meant to ship).

*Why one `release` branch for all sub-projects:* vm23 has one checkout, so "what is live" has to be one commit. A branch per sub-project (`release/pv`, …) would each point at a commit of the whole repo, and the checkout could only be on one of them; making that work needs one checkout per branch. The Compose projects are already split per deploy unit (D4), and isolation between sub-projects comes from there (D4a: only affected units and services are touched), not from separate branches. The cost: promoting `main` ships everything that is merged, so `main` must always be shippable and unfinished work stays on its branch.

*Consequence:* `release` accumulates merge commits that `main` does not have. Nothing flows back from `release` to `main`, so this is harmless; hotfixes go to `main` first and are promoted like everything else.

### D2. Keep a self-hosted runner on vm23, registered on the repository

Reinstall the Actions runner on vm23 as user `solmqadmin`, register it on this repository (repo admin is enough; org admin is not available), install it as a systemd service, and give it the extra label `vm23`. The deploy job uses `runs-on: [self-hosted, vm23]`.

*Why:* the runner connects outbound, so it works behind the school firewall, and the deploy only needs local Docker access. A specific label prevents another self-hosted runner from ever picking up the job.

*Alternatives:* SSH from a GitHub-hosted runner with a deploy key (needs inbound SSH, which the firewall is documented to block, and puts a host credential into GitHub secrets); a pull-based timer on the VM (`git fetch` every few minutes — no run history, no status in GitHub); moving to LeoCloud (a different project).

### D3. The runner only ever sees `release`

Four layers, because the repo is public:

1. No workflow that uses the self-hosted runner has a `pull_request` or `pull_request_target` trigger.
2. The deploy job declares `environment: production`, and that environment's deployment branch policy allows only `release`. A workflow edited on another branch to target the runner is refused at the environment gate.
3. The `release` ruleset (D6) means the only way onto `release` is a human-approved pull request.
4. Repository Actions setting "Require approval for all outside collaborators" for fork pull requests.

The deploy workflow requests `permissions: contents: read` only.

### D4. Deploy the triggering commit, per deploy unit, never "whatever is newest"

A *deploy unit* is a top-level folder with a Compose file: `legacy` (`legacy/docker-compose.yaml`) and every `leoiot-*` folder that has a `compose.yaml`. Today that is `legacy` and `leoiot-pv`; `leoiot-platform`, `leoiot-sensors` and `leoiot-3d` become units the day they add a `compose.yaml`, without any change to the workflow. Each unit is its own Compose project and is always run from its own folder, so Compose reads that folder's git-ignored `.env`.

The job runs, in the existing checkout:

```
git fetch --prune origin
git merge-base --is-ancestor "$SHA" origin/release   # refuse commits not on release
git checkout --detach "$SHA"                          # no --force
for UNIT in $UNITS; do                                # order below; only affected units (D4a)
  cd "$UNIT"
  docker compose config -q                            # fails early on a missing or incomplete .env
  docker compose up -d --build --remove-orphans       # new, removed and redefined services
  docker compose up -d --build --force-recreate $LEGACY_SERVICES   # legacy only, see D4a; skipped when empty
done
```

`$SHA` is `github.sha` for a push and the `ref` input (resolved to a commit) for a manual run. A unit that fails stops the rollout: later units are not updated and the marker (D4a) is not advanced.

*Unit order.* `leoiot-platform` first, then `legacy`, then the other `leoiot-*` units in alphabetical order. `leoiot-pv` joins the legacy network, so legacy has to be up before it; later the platform provides broker, database and network, so it has to be up before everything else. Units are found by looking for Compose files, so the order needs no list.

*Why:* `git pull` deploys whatever the branch points at when the job happens to run and fails on a diverged checkout. A detached checkout of a named commit is reproducible and is also the rollback mechanism. Leaving out `--force` means unexpected local edits on the VM stop the deploy rather than being silently destroyed. That includes a tracked file that a legacy container rewrote through `npm install` (for example `legacy/solax-collector/package-lock.json`): if the release changes that file, the checkout stops. The failure message names the file and the fix, `git checkout -- <file>` on the host, and the README repeats it.

*Alternative:* `git reset --hard` (rejected: would erase hand edits on the host that nobody has inventoried yet, and would hide the container rewrites instead of surfacing them).

### D4a. Update the units and services that changed since the last good deployment

`$UNITS` and `$LEGACY_SERVICES` come from `.github/ci/affected.sh` (D11) applied to `git diff --name-only <last-deployed>..<SHA>`. `<last-deployed>` is read from a marker file outside the checkout (`/home/solmqadmin/.leoiot-deployed-sha`), which the job rewrites only after the smoke test (D5) passed. No marker, or a marker commit that no longer exists, means "all units, all legacy services". One marker serves all units, because there is one deployed commit (D1).

A unit is affected when any file under its folder changed. The two kinds of unit are updated differently:

- **`legacy`: per service.** Its Node services bind-mount their folders, so neither their image nor their definition changes on a release and `up` leaves them alone. The job maps changed paths to Compose services with `.github/ci/legacy-services.map` and recreates exactly those with `--force-recreate`; `up -d --build` runs for the unit as well, which rebuilds `quarkus-app` and picks up changed service definitions.
- **New units: by image.** Their services are built into images, so `docker compose up -d --build --remove-orphans` rebuilds the images and recreates only the services whose image or definition changed. No service map is needed. A unit without changed files is not touched at all: a legacy-only release does not rebuild PV images, and a PV-only release does not recreate a legacy container.

Optional services behind Compose profiles (for example the PV `collector`) are activated per host through `COMPOSE_PROFILES` in that unit's `.env` on vm23, which Compose reads. The deploy never passes `--profile` and never enables a profile on its own. This matters for the collector in particular: the SolaX cloud allows one session per account, so a second collector running next to the legacy `solax-collector` would break both. The `.env` files stay untracked and are never touched by the deploy.

A manual run takes a `scope` input: `affected` (default), `all`, or a unit name (`legacy`, `leoiot-pv`, and later the others). `all` updates every unit, adding `--force-recreate` for new units and recreating every legacy service. A unit name does the same for that unit alone, whatever the diff says.

When the diff contains `legacy/deploy/nginx.conf`, or later a `nginx*.conf` below `leoiot-platform/`, the job emits a `::warning::` that the file must be applied on vm23 by hand (the live file is `/etc/nginx/sites-available/leoiot`, a copy). When there is no marker, the file counts as changed.

*Why recreate at all in legacy:* see Context — without it the Node services never run released code and no service installs new dependencies. Recreating is the simplest thing that makes "deployed" true for a bind-mounted `npm install && …` container.

*Why only affected ones:* a full `--force-recreate` takes every legacy kiosk through a cold `npm install` on each release, and a rebuild of unrelated images wastes minutes and risks failures unrelated to the release. Scoping by unit and, in legacy, by service means a legacy release leaves the PV kiosk in the hallway alone, which is what makes one release train tolerable for several teams.

*Why diff against the marker and not against the previous push:* `github.event.before` describes what was pushed, not what is running. If a deployment fails, or GitHub drops a queued run (a concurrency group keeps only the newest pending one), the next deployment must still pick up everything that was missed. The marker also makes rollback symmetrical: the diff between two commits is the same set of files in either direction.

*Alternatives:* always recreate everything (correct, but restarts all displays on every release); rely on file watching (wrong for three legacy services and for dependency changes); one service map for all units (the new units do not need it, and it would have to be kept in step with every sub-project's Compose file); one Compose project for everything (conflicts with each sub-project owning its own Compose file and `.env`).

### D5. Smoke test through nginx under the public hostname, with retries

After the units are updated, the job polls every route in `.github/ci/smoke-routes` (one route per line) every 10 seconds for up to 5 minutes, and fails naming any route that never returned a success status. The requests use the public hostname `https://vm23.htl-leonding.ac.at` but connect to `127.0.0.1` (`curl --connect-to`, overridable with `SMOKE_CONNECT_TO`), because vm23 has no hairpin NAT: a request from vm23 to its own public IP times out, which failed the first release deploy on 2026-10-15 although every route answered from outside. nginx, TLS and the server name are still exercised; the network path from outside is not. The initial list is `/`, `/dashboard/`, `/kiosk/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/`, `/leogreen/`, `/grafana/` and `/influx/health`. The check follows redirects and requires a final 2xx status. That makes the list correct both before and after the PV kiosk cut-over in nginx: today `/kiosk2/` is served by a legacy container, afterwards it redirects to `/kiosk/`, and both end in 200. The Grafana login redirect is covered by the same rule. Sub-projects add their own routes to the file. All routes are checked on every deployment, whatever was updated; it is cheap and catches a service that died for unrelated reasons.

*Why:* the containers install dependencies on start, so "compose exited 0" proves nothing. Going through the public hostname also checks nginx, which is the part CI does not manage. Five minutes covers a cold `npm install` in every legacy container.

The job has `timeout-minutes: 20` and the workflow uses `concurrency: { group: deploy-vm23, cancel-in-progress: false }`.

### D6. Rulesets on `main` and `release`

Repository rulesets (not classic branch protection — they can be exported, and can be set by a repo admin):

| | `main` | `release` |
|---|---|---|
| Pull request required | yes | yes |
| Required status check | `ci-ok` | `ci-ok` |
| Approving reviews | 0 | 1 |
| Force push / delete | blocked | blocked |
| Branches must be up to date | no | no |

*Why 0 approvals on `main`:* agents open many small pull requests; requiring a second person for each would stall five people. CI is the gate on `main`; the human gate sits on `release`, where it costs one click per deployment. GitHub does not let an author approve their own pull request, so a release always involves two people.

*Why not "up to date" / merge queue:* requiring up-to-date branches makes every merge invalidate all other open pull requests, which with five agents turns into constant rebasing. A merge queue fixes that properly but adds a concept the team has to learn. Start without; the push-to-`main` CI run and the `ci-ok` requirement on the promotion pull request catch a `main` that two individually-green merges broke before it can deploy. Revisit if that happens more than occasionally.

*Why this order matters for people:* the `main` ruleset takes away direct pushes that the team uses today (fifteen commits arrived that way on 2026-10-13/14). The team is told before it goes live (task group 7), so nobody finds out from a rejected push.

### D7. One CI workflow, scoped by path on pull requests

`.github/workflows/ci.yml`, on `pull_request` (targets `main`, `release`) and `push` to `main`, all on `ubuntu-24.04`:

- `changes`: runs `.github/ci/affected.sh` (D11) on the pull request's diff and outputs the affected components as matrices: Node components, Maven components, Compose files and Dockerfile directories, plus flags for docs and for the script test. On `push` to `main`, and whenever a shared path changed, it outputs everything.
- `docs`: `npm ci && npm run build` at the root (Node 22).
- `node` (matrix over Node components, `fail-fast: false`): the Node version is 22 for `leoiot-*` and 20 for `legacy/*`, which matches the legacy containers. Install with `npm ci` when the component has a lockfile; otherwise `npm install --no-package-lock`, so no lockfile is created. Then `npm test` if a `test` script exists, `npm run build` if a `build` script exists, and if there is no build script `node --check` on the entry file (`main` in `package.json`, default `index.js`).
- `maven` (matrix over `pom.xml` components): Java 21 (Temurin), `./mvnw -B verify` in `legacy/backend/sensor-data-generator`.
- `compose` (matrix over Compose files): `docker compose -f <file> config -q`, with `--env-file <unit>/.env.example` when the unit has one, so a required variable does not fail the check.
- `images` (matrix over Dockerfile directories below `leoiot-*`): `docker build` of the directory, no push.
- `ci-scripts`: `.github/ci/affected.test.sh`.
- `ci-ok`: `needs` all of the above, `if: always()`. Fails unless `changes` succeeded and every other job's result is `success` or `skipped`.

`concurrency` is keyed on the pull request and cancels superseded runs. `permissions: contents: read`. The workflow triggers on `pull_request` only, not on branch pushes, so an agent that pushes ten work-in-progress commits before opening a pull request costs nothing.

*Why no lockfiles for the legacy apps that lack one:* `kiosk`, `kiosk4` and `leogreenKiosk` have none, so `npm ci` cannot run there. Committing lockfiles would not help the running system, because the legacy containers run `npm install` into their bind-mounted folders on every start. That rewrites the tracked lockfile on the host, and the next deploy's checkout then stops on the modified file (this already happened with `legacy/solax-collector/package-lock.json`). Legacy is frozen, so CI installs without a lockfile for these three and accepts that their result can drift with the registry.

*Why scope pull requests:* with five agents the number of open pull requests is the multiplier. A PV pull request that builds ten unrelated legacy apps and runs Maven gives slower feedback and more unrelated red (a flaky registry download in `legacy/kiosk4` should not block a `leoiot-pv` change).

*Why still run everything on `main`:* it is the safety net for two individually green pull requests that break each other, and it keeps a fresh full signal on the commit that will be promoted.

*Why the workflow itself is never path-filtered:* a required check that does not report leaves the pull request waiting forever. The workflow always starts; only jobs inside it are skipped, and `ci-ok` always reports. `ci-ok` must distinguish "skipped because not affected" from "skipped because `changes` broke", which is why it checks `changes` explicitly.

*Why one gate job:* rulesets require a single stable name (`ci-ok`), and adding a component later does not mean editing repository settings.

*Alternative:* always run everything (simpler, and what the first draft of this design chose; rejected once the multi-team structure made feedback time and cross-team noise the main concern). One workflow file per sub-project with `paths:` filters (rejected: several required checks, each of which is missing on most pull requests, and every new sub-project would need its own file).

### D8. Runner watchdog

`deploy.yml` gets a second job on a GitHub-hosted runner that polls the run's jobs through the API and, if the deploy job is still `queued` after 10 minutes, cancels the run and fails with "vm23 runner did not pick up the job — check the runner service on vm23". It needs `actions: write` for the cancel.

*Why:* `timeout-minutes` does not count queue time, so nothing else bounds the wait; the 24-hour silent cancel is exactly how the outage went unnoticed for four months. Listing runners directly would need an admin token stored as a secret; watching the job needs only the default token.

### D9. Pages workflow: same behaviour, pinned image

`docs.yaml` keeps publishing on push to `main`. Change `runs-on` to `ubuntu-24.04` (the `ubuntu-latest` label is announced to move to Ubuntu 26 from 2026-10-19) and move `actions/checkout` and `actions/setup-node` to their current major versions, checked at implementation time. Same pin and versions in `ci.yml`.

### D10. Agent instructions in `AGENTS.md`, loaded from `CLAUDE.md`

One `AGENTS.md` at the repo root holds the rules, in two parts.

*Branch and release rules:* branch per task from fresh `main`, worktree per concurrent agent, branch names `feat/…`, `fix/…`, `docs/…`, open a pull request, never push to `main`/`release`, never merge a promotion, how to run the CI steps locally.

*Layout and spec rules*, which `openspec/config.yaml` states for spec work and which agents need just as much when they write code: which folder belongs to which team (`legacy/` none and frozen, `leoiot-platform/`, `leoiot-sensors/`, `leoiot-pv/`, `leoiot-3d/`); that legacy only receives keep-alive fixes and feature requests are specified for the matching new sub-project; that specs are grouped by sub-project, with a pointer to `openspec/specs/README.md` instead of a copy of its rules; contract first (a shared interface goes into `openspec/specs/platform/` through a `platform-…` change before any code relies on it); and that each sub-project's code stays in its own folder.

`CLAUDE.md` imports it with `@AGENTS.md`. The README's deployment section links to it and replaces the manual `git pull` instructions.

*Why:* the repo is used with several agent tools; `AGENTS.md` is the name most of them read, and Claude Code reads `CLAUDE.md`. The layout rules belong in the same file because agents read only what is loaded automatically, and the rule that enforces them (branch governance) is the same file's job.

### D11. CI and deployment find components by rule; legacy services use a map

The CI and deploy tooling lives at the repository root as CI configuration under `.github/ci/`:

- `affected.sh <base> <head>`: prints the affected components, units and legacy services for a commit range. It prints one `kind value` line per result, so the workflows can read it with `grep`.
- `affected.test.sh`: feeds `affected.sh` fixed file lists and runs the completeness check below.
- `legacy-services.map`: one line per legacy path, `prefix service`, where `prefix` is relative to the repository root and a prefix ending in `/` matches a directory. A service without files in the repository (`influxdb`, which is an image) is listed with the prefix `-`.
- `smoke-routes`: one route per line (D5).

```
# prefix                                   legacy Compose service
legacy/frontend/                           frontend
legacy/dashboard-v2/                       dashboard-v2
legacy/kiosk/                              kiosk
legacy/kiosk2/                             kiosk2
legacy/kiosk3/                             kiosk3
legacy/kiosk4/                             kiosk4
legacy/leogreenKiosk/                      leogreen-kiosk
legacy/solax-collector/                    solax-collector
legacy/mqtt-ws-bridge/                     mqtt-ws-bridge
legacy/fake-sensors/                       fake-sensors
legacy/backend/sensor-data-generator/      quarkus-app
legacy/telegraf.conf                       telegraf
legacy/config/                             mosquitto
legacy/grafana/                            grafana
-                                          influxdb
```

*Discovery rules.* Everything except the legacy service map is found by looking at the tree:

- A CI *component* is every directory that contains a `package.json` (excluding `node_modules` and the repository root, which is the docs component) or a `pom.xml`. A changed file belongs to its nearest ancestor component.
- Each Compose file is a *compose component*; its folder is a deploy unit (D4). CI validates it with `--env-file` built from the unit's `.env.example`, where every empty value is replaced by a placeholder, so `${VAR:?…}` guards in the Compose file stay in force for real hosts.
- Each `leoiot-*` directory that contains a `Dockerfile` gets an *image build check* for that directory.

*What a path triggers.*

| Changed path | CI | Deploy |
|---|---|---|
| inside a component (nearest ancestor with `package.json` or `pom.xml`) | that component's check, plus the image build if the directory has a `Dockerfile` | `legacy`: the mapped service is recreated; new unit: the unit is updated |
| a file under a unit folder that is in no component (for example `legacy/config/`, `leoiot-pv/compose.yaml`) | the unit's Compose check | `legacy`: the mapped service if a map line matches; new unit: the unit is updated |
| a Compose file | Compose check; for `legacy` also `ci-scripts` | the unit is updated; for `legacy`, plain `up` handles a changed service definition |
| `src/`, `public/`, `asciidocs/`, `astro.config.*`, root `package.json` and lockfile, `docs/` | docs | nothing |
| `openspec/`, root `*.md`, `LICENSE*`, `.gitignore` | no checks (only `ci-ok` reports) | nothing |
| a file in a `leoiot-*` folder that has no component, `Dockerfile` or Compose file yet (for example `leoiot-sensors/README.md`) | no checks | nothing |
| `.github/` and any other path | everything | nothing forced |

The `leoiot-*` row keeps early sub-project work (READMEs, notes) from running all of CI. The last row keeps the old rule that an unknown path makes CI over-run rather than under-run. Manual `scope` input values are `affected` (default), `all`, or a unit name (`legacy`, `leoiot-pv`, later others). The old "sub-project" column and the per-team scope names are gone: a team is not a unit of deployment, a Compose project is.

*Completeness test.* `affected.test.sh` fails when a Compose service of `legacy/docker-compose.yaml` is missing from `legacy-services.map`, when a map line names a service that does not exist in that file, or when a directory `legacy/*` that contains a `package.json` has no map line. New units need no map and no test entry.

*Why a script and files instead of a paths-filter action:* the deploy job runs on vm23 and needs the same answer as CI. One implementation, runnable locally (`.github/ci/affected.sh origin/main HEAD`), with a test that feeds it file lists.

*Why discovery for new units and a map only for legacy:* a new sub-project then adds a folder with a `package.json`, a `Dockerfile` and a `compose.yaml` and gets CI and deployment without touching shared files; the one thing that cannot be derived is which legacy service reads which bind-mounted path, and legacy is frozen, so that map will not grow.

*Why the unit, and for legacy the service, is the grain and not the team:* it is finer and needs no agreement on ownership to work. A change under `legacy/dashboard-v2` recreates `dashboard-v2` whoever owns it.

## Risks / Trade-offs

- **vm23 SSH password is in the public `legacy/README.adoc`** → anyone who can reach the host can log in as the user that will run the runner and owns the Docker stacks. Rotate the password and remove it from the README before re-registering the runner (task group 1). Git history keeps the old value, which is why it should be rotated and not only deleted. **Decision 2026-10-14:** the project lead keeps the password; the risk is accepted on the assumption that SSH to vm23 is reachable only from the school network. If that assumption changes, or the runner is ever given more than this repository, rotate it.
- **State of the checkout on vm23** was clean on 2026-10-14, but hand edits and untracked files can come back → inventory it before the first deploy; D4 fails safe rather than overwriting.
- **A container rewrites a tracked file** → the legacy `npm install` on start can modify tracked files such as `legacy/solax-collector/package-lock.json`. If a release changes that file, the deploy's detached checkout stops. This is fail-safe by design (nothing is discarded); the fix is `git checkout -- <file>` on the host, and it is written into the deploy failure message and the README.
- **First release has no marker** → it updates every unit and recreates every legacy service; do it attended, note the currently running commit first so D4's manual run can return to it.
- **nginx drift** stays possible because CI does not manage it → the smoke test at least turns a missing route into a red deploy.
- **The nginx file on `main` is ahead of vm23** → `legacy/deploy/nginx.conf` already contains the PV kiosk cut-over (port 8088 and the redirects). Applying it before `leoiot-pv` runs on vm23 would break `/kiosk/`. The deploy only warns; applying the file is a separate step, coordinated with the PV team, and not part of this change. Because the smoke test follows redirects, it passes before and after the switch.
- **A required `.env` is missing or incomplete on vm23** → Compose refuses to start the unit (for `leoiot-pv`, without `KIOSK_INFLUX_TOKEN`). `docker compose config -q` runs first, so the deploy fails early with Compose's message and later units are not touched. Task group 1 checks that the file exists before the first release.
- **A Compose profile enabled by mistake** → the PV `collector` must not run next to the legacy `solax-collector` (one SolaX session per account). The deploy never enables profiles; only `COMPOSE_PROFILES` in the host's `.env` does, which is a deliberate, local act.
- **Org admins and repo admins can bypass rulesets** → acceptable; keep the bypass list empty so bypassing is a deliberate settings change.
- **`ci-ok` must exist before it is required** → the ruleset is created only after `ci.yml` has run once on `main`; otherwise every pull request blocks on a check that never reports.
- **The `main` ruleset blocks direct pushes the team uses today** → tell the team before it goes live; until then direct pushes continue unchecked.
- **A path no rule knows** → treated as shared, so CI over-runs rather than under-runs; for deployment, an unmapped new legacy service directory would not be force-recreated. Mitigation: the completeness test fails when a legacy Compose service or a `legacy/*` directory with a `package.json` has no map line. New units need no map.
- **Legacy apps without a lockfile are installed unpinned in CI** → their CI result can change with the registry. Accepted: legacy is frozen, and the alternative (committed lockfiles) breaks the host checkout, see D7.
- **Cross-sub-project breakage is invisible to path scoping** → a sensor change to an MQTT topic or InfluxDB field can break the PV kiosk without touching its folder. No test covers this today either; the full run on `main` does not catch it. Accepted, and listed as follow-up; the contract-first rule in `AGENTS.md` and the platform group are the intended answer.
- **One release train** → a team cannot ship its change without shipping whatever else is on `main`. Mitigated by D4a (other units and services only update if their files changed) and by the rule that `main` is always shippable.
- **Recreating a legacy service means a cold `npm install`** → that service is down for up to a few minutes per release. Unchanged from a manual restart today; removing it means production builds, a non-goal. New units rebuild an image first and swap the container, so their downtime is short.
- **Marker file lost or edited by hand** → falls back to updating everything, which is safe.
- **Smoke test checks HTTP status, not correctness** → it catches "service did not start", not "chart is wrong". Accepted for now.
- **`eclipse-mosquitto:latest`, `telegraf:latest`, `grafana:latest`** can change under a redeploy → out of scope, noted for the follow-up change.
- **Runner host compromise equals app compromise** → unchanged from before; D3 narrows who can reach it.

## Migration Plan

Order matters; each step leaves the repo in a working state.

1. Host hygiene: rotate the password, remove the secrets from `legacy/README.adoc`, inventory the VM checkout and Compose projects, record the running commit, compare the nginx file, check the units' `.env` files.
2. Land the CI scripts (`.github/ci/`) with their test, and `ci.yml`, through a normal pull request; confirm `ci-ok` reports on `main`.
3. Pin and bump `docs.yaml`.
4. Re-register the runner as a service with the `vm23` label; create the `production` environment restricted to `release`.
5. Land the new `deploy.yml` on `main`. From this merge on, nothing deploys automatically until `release` exists — the same as the last four months.
6. Create `release` from `main`. This push is the first deployment; with no marker file it updates every unit and recreates every legacy service, so attend it.
7. Tell the team that direct pushes to `main` stop working, then create the two rulesets and the fork-approval setting.
8. Land `AGENTS.md`, `CLAUDE.md` and the README changes (through a pull request, proving the rules).
9. Confirm with the team that shipping is now a `main` → `release` pull request.

**Rollback.** Workflows and docs: revert the pull request. Rulesets: disable (they are not deleted, so re-enabling is one click). A bad deployment: run `deploy.yml` manually with the previous `release` commit, or merge a revert into `main` and promote it. The old behaviour (deploy on push to `main`) is restorable by reverting `deploy.yml`, but only works while the runner is up and would need the Compose paths corrected.

## Open Questions

- Who owns `leoiot-platform/`, and therefore this pipeline (CI, deploy workflow, rulesets, runner)? Until someone does, the maintainers of this repository keep it running, and the README and `AGENTS.md` cannot name a contact for platform questions.
- Should the team adopt a merge queue on `main` later? Decide after a few weeks of real traffic (see D6).
- Is there an org-level runner that should be cleaned up? Needs someone with org-admin rights to look; does not affect this change.
