# Design

## Context

See `proposal.md` for motivation. The facts that shape the approach:

- **Deploy target.** The app runs on `vm23.htl-leonding.ac.at` as a Docker Compose stack in `/home/solmqadmin/2526-4ahitm-leoiot-dashboard`. nginx on the host (not in Compose, configured by hand from `deploy/nginx.conf`) proxies `/`, `/dashboard/`, `/kiosk/` … `/kiosk4/`, `/leogreen/`, `/grafana/`, `/influx/` and `/ws` to the containers. The host answers on HTTPS today, so it is alive; only the runner is gone.
- **How the stack runs.** Most services are `node:20-alpine` containers that bind-mount the repo and run `npm install && npm run dev` (or `node index.js`). `docker compose up` therefore returns long before the apps answer.
- **What `compose up` actually updates.** Compose recreates a container only when its image or its service definition changed. For the bind-mounted services neither changes on a normal release, so `docker compose up -d --build` rebuilds `quarkus-app` and leaves everything else running. The Vite dev servers happen to pick up new files through file watching; `fake-sensors`, `mqtt-ws-bridge` and `solax-collector` keep running old code, and no service installs new dependencies, until something restarts them. This follows from the compose file and Compose's documented behaviour; it has not been observed on vm23.
- **Three sub-projects.** Sensoren (1 person), PV-Dashboard (2), 3D-Modell (2), per `src/content/docs/docs/project.md`. They share one compose file, one host and one data path (MQTT → Telegraf → InfluxDB).
- **Runner.** The repo has zero registered runners. Whether an org-level runner exists is not visible without org-admin rights. A runner that stays disconnected for 14 days is removed by GitHub, which fits the timeline (last success 2 June, first cancel 15 June) but is not confirmed.
- **Network.** The README says the school firewall only lets port 80/443 through to vm23. Inbound SSH from GitHub's runners is therefore assumed unavailable; this was not tested.
- **Repo is public.** A self-hosted runner on a public repo executes whatever a workflow tells it to, so which events can reach it is a security decision.
- **Monorepo without a workspace.** Root `package.json` builds only the Astro docs. Ten Node components each have their own `package.json`; `kiosk`, `kiosk4` and `leogreenKiosk` have no lockfile. The Quarkus backend targets Java 21 and has three test classes.
- **Team.** Five people, each running Claude agents (the repo also carries `.gemini`, `.opencode` and `.qwen` configs), all with push rights.

## Goals / Non-Goals

**Goals:**

- A merge into `release` reliably ends with vm23 running that commit, or with a red run that says why.
- A broken build cannot reach `main`, whoever or whatever opened the pull request.
- A dead runner is noticed in minutes.
- One sub-project's pull request or release does not wait for, or restart, the other two.
- The whole flow is simple enough to state in a few lines of agent instructions.

**Non-Goals:**

- Changing where or how the app runs (no Kubernetes/LeoCloud move, no production builds, no image registry).
- Bringing nginx under CI control.
- Staging or preview environments.
- Independent release branches or version numbers per sub-project (see D1).
- Contract or integration tests between the sub-projects.
- Rotating the InfluxDB token and MQTT password committed in `docker-compose.yaml` and the JS sources (separate change).
- Linting, type checks or new tests beyond what exists.

## Decisions

### D1. Deploy on push to `release`, promote by pull request from `main`

`deploy.yml` triggers on `push` to `release` and on `workflow_dispatch`. Shipping means opening a pull request `main` → `release` and merging it with a merge commit.

*Why:* with five agents merging into `main` many times a day, deploying each merge would restart the kiosks constantly and make "what is live" a moving target. A promotion pull request gives one visible, reviewable place that lists exactly which commits go out.

*Alternatives:* deploy every push to `main` (today's behaviour — rejected for the reason above); version tags or GitHub Releases as the trigger (works, but tags cannot be gated by review the way a pull request can, and the team asked for a branch); a manual-only dispatch (no audit trail of what was meant to ship).

*Why one `release` branch for three sub-projects:* vm23 has one checkout and one compose file, so "what is live" has to be one commit. A branch per sub-project (`release/pv`, …) would each point at a commit of the whole repo, and the host could only be on one of them; making that work needs three checkouts and a split compose project. Isolation between sub-projects comes from D4a (only affected services restart), not from separate branches. The cost: promoting `main` ships everything that is merged, so `main` must always be shippable and unfinished work stays on its branch.

*Consequence:* `release` accumulates merge commits that `main` does not have. Nothing flows back from `release` to `main`, so this is harmless; hotfixes go to `main` first and are promoted like everything else.

### D2. Keep a self-hosted runner on vm23, registered on the repository

Reinstall the Actions runner on vm23 as user `solmqadmin`, register it on this repository (repo admin is enough; org admin is not available), install it as a systemd service, and give it the extra label `vm23`. The deploy job uses `runs-on: [self-hosted, vm23]`.

*Why:* the runner connects outbound, so it works behind the school firewall, and the existing deploy script only needs local Docker access. A specific label prevents another self-hosted runner from ever picking up the job.

*Alternatives:* SSH from a GitHub-hosted runner with a deploy key (needs inbound SSH, which the firewall is documented to block, and puts a host credential into GitHub secrets); a pull-based timer on the VM (`git fetch` every few minutes — no run history, no status in GitHub); moving to LeoCloud (a different project).

### D3. The runner only ever sees `release`

Four layers, because the repo is public:

1. No workflow that uses the self-hosted runner has a `pull_request` or `pull_request_target` trigger.
2. The deploy job declares `environment: production`, and that environment's deployment branch policy allows only `release`. A workflow edited on another branch to target the runner is refused at the environment gate.
3. The `release` ruleset (D6) means the only way onto `release` is a human-approved pull request.
4. Repository Actions setting "Require approval for all outside collaborators" for fork pull requests.

The deploy workflow requests `permissions: contents: read` only.

### D4. Deploy the triggering commit, never "whatever is newest"

The job runs, in the existing checkout:

```
git fetch --prune origin
git merge-base --is-ancestor "$SHA" origin/release   # refuse commits not on release
git checkout --detach "$SHA"                          # no --force
docker compose up -d --build --remove-orphans           # new, removed and redefined services
docker compose up -d --build --force-recreate $AFFECTED   # see D4a; skipped when empty
```

`$SHA` is `github.sha` for a push and the `ref` input (resolved to a commit) for a manual run.

*Why:* `git pull` deploys whatever the branch points at when the job happens to run and fails on a diverged checkout. A detached checkout of a named commit is reproducible and is also the rollback mechanism. Leaving out `--force` means unexpected local edits on the VM stop the deploy rather than being silently destroyed.

*Alternative:* `git reset --hard` (rejected: would erase hand edits on the host that nobody has inventoried yet).

### D4a. Recreate the services whose paths changed since the last good deployment

`$AFFECTED` comes from the path mapping (D11) applied to `git diff --name-only <last-deployed>..<SHA>`. `<last-deployed>` is read from a marker file outside the checkout (`/home/solmqadmin/.leoiot-deployed-sha`), which the job rewrites only after the smoke test (D5) passed. No marker, or a marker commit that no longer exists, means "all services".

A manual run takes a `scope` input: `affected` (default), `all`, or one sub-project (`sensoren`, `pv-dashboard`, `3d-modell`), which recreates that sub-project's services regardless of the diff.

When the diff contains `deploy/nginx.conf`, the job emits a `::warning::` that the file must be applied on vm23 by hand.

*Why recreate at all:* see Context — without it the Node services never run released code and no service installs new dependencies. Recreating is the simplest thing that makes "deployed" true for a bind-mounted `npm install && …` container.

*Why only affected ones:* a full `--force-recreate` takes every kiosk through a cold `npm install` on each release. Scoping by path means a 3D release leaves the PV kiosks in the hallway alone, which is what makes one release train tolerable for three teams.

*Why diff against the marker and not against the previous push:* `github.event.before` describes what was pushed, not what is running. If a deployment fails, or GitHub drops a queued run (a concurrency group keeps only the newest pending one), the next deployment must still pick up everything that was missed. The marker also makes rollback symmetrical: the diff between two commits is the same set of files in either direction.

*Alternatives:* always recreate everything (correct, but restarts all displays on every release); rely on file watching (wrong for three services and for dependency changes); separate compose projects per sub-project (clean isolation, but restructures how the stack runs, which is a non-goal).

### D5. Smoke test through the public URL, with retries

After `compose up`, the job polls `https://vm23.htl-leonding.ac.at` for `/`, `/dashboard/`, `/kiosk/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/`, `/leogreen/`, `/grafana/` (login redirect followed) and `/influx/health` every 10 seconds for up to 5 minutes, and fails naming any route that never returned a success status. The route list lives in one place in the workflow. All routes are checked on every deployment, whatever was recreated; it is cheap and catches a service that died for unrelated reasons.

*Why:* the containers install dependencies on start, so "compose exited 0" proves nothing. Going through the public hostname also checks nginx, which is the part CI does not manage. Five minutes covers a cold `npm install` in every container.

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

### D7. One CI workflow, scoped by path on pull requests

`.github/workflows/ci.yml`, on `pull_request` (targets `main`, `release`) and `push` to `main`, all on `ubuntu-24.04`:

- `changes`: runs the affected script (D11) on the pull request's diff and outputs the list of affected components plus flags for docs, backend and compose. On `push` to `main`, and whenever a shared path changed, it outputs everything.
- `docs`: `npm ci && npm run build` at the root (Node 22).
- `node` (matrix built from the `changes` output, `fail-fast: false`): `npm ci`, then `npm run build` where a build script exists, otherwise `node --check` on the entry file. Node 20, matching the containers.
- `backend`: Java 21 (Temurin), `./mvnw -B verify` in `backend/sensor-data-generator`.
- `compose`: `docker compose config -q`.
- `ci-ok`: `needs` all of the above, `if: always()`. Fails unless `changes` succeeded and every other job's result is `success` or `skipped`.

`concurrency` is keyed on the pull request and cancels superseded runs. `permissions: contents: read`. The workflow triggers on `pull_request` only, not on branch pushes, so an agent that pushes ten work-in-progress commits before opening a pull request costs nothing.

*Why scope pull requests:* with five agents the number of open pull requests is the multiplier. A 3D pull request that builds seven unrelated apps and runs Maven gives slower feedback and more unrelated red (a flaky registry download in `kiosk4` should not block a `frontend` change).

*Why still run everything on `main`:* it is the safety net for two individually green pull requests that break each other, and it keeps a fresh full signal on the commit that will be promoted.

*Why the workflow itself is never path-filtered:* a required check that does not report leaves the pull request waiting forever. The workflow always starts; only jobs inside it are skipped, and `ci-ok` always reports. `ci-ok` must distinguish "skipped because not affected" from "skipped because `changes` broke", which is why it checks `changes` explicitly.

*Why one gate job:* rulesets require a single stable name (`ci-ok`), and adding a component later does not mean editing repository settings.

*Alternative:* always run everything (simpler, and what the first draft of this design chose; rejected once the three-team structure made feedback time and cross-team noise the main concern). One workflow file per sub-project with `paths:` filters (rejected: three required checks, each of which is missing on most pull requests).

### D8. Runner watchdog

`deploy.yml` gets a second job on a GitHub-hosted runner that polls the run's jobs through the API and, if the deploy job is still `queued` after 10 minutes, cancels the run and fails with "vm23 runner did not pick up the job — check the runner service on vm23". It needs `actions: write` for the cancel.

*Why:* `timeout-minutes` does not count queue time, so nothing else bounds the wait; the 24-hour silent cancel is exactly how the outage went unnoticed for four months. Listing runners directly would need an admin token stored as a secret; watching the job needs only the default token.

### D9. Pages workflow: same behaviour, pinned image

`docs.yaml` keeps publishing on push to `main`. Change `runs-on` to `ubuntu-24.04` (the `ubuntu-latest` label is announced to move to Ubuntu 26 from 2026-10-19) and move `actions/checkout` and `actions/setup-node` to their current major versions, checked at implementation time. Same pin and versions in `ci.yml`.

### D10. Agent instructions in `AGENTS.md`, loaded from `CLAUDE.md`

One `AGENTS.md` at the repo root holds the rules (branch per task from fresh `main`, worktree per concurrent agent, branch names `feat/…`, `fix/…`, `docs/…`, open a pull request, never push to `main`/`release`, never merge a promotion, how to run the CI steps locally). `CLAUDE.md` imports it with `@AGENTS.md`. The README's deployment section links to it and replaces the manual `git pull` instructions.

*Why:* the repo is used with several agent tools; `AGENTS.md` is the name most of them read, and Claude Code reads `CLAUDE.md`.

### D11. One path mapping for CI and deployment

A plain text file, `deploy/components.map`, one line per path prefix:

```
# prefix                         component        service          sub-project
frontend/                        frontend         frontend         3d-modell
kiosk/                           kiosk            kiosk            pv-dashboard
kiosk2/                          kiosk2           kiosk2           pv-dashboard
kiosk3/                          kiosk3           kiosk3           pv-dashboard
kiosk4/                          kiosk4           kiosk4           pv-dashboard
leogreenKiosk/                   leogreenKiosk    leogreen-kiosk   pv-dashboard
solax-collector/                 solax-collector  solax-collector  pv-dashboard
mqtt-ws-bridge/                  mqtt-ws-bridge   mqtt-ws-bridge   pv-dashboard
dashboard-v2/                    dashboard-v2     dashboard-v2     pv-dashboard
fake-sensors/                    fake-sensors     fake-sensors     sensoren
backend/sensor-data-generator/   backend          quarkus-app      sensoren
telegraf.conf                    -                telegraf         sensoren
config/                          -                mosquitto        sensoren
grafana/                         -                grafana          shared
sensorbox/                       -                -                sensoren
src/ asciidocs/ public/ …        docs             -                shared
```

and a shell script, `deploy/affected.sh <base> <head>`, that prints the affected components and services. Paths under `.github/`, the map itself, `docker-compose.yaml` and anything the map does not list are "shared": CI runs everything; deployment adds no forced recreation for them (plain `compose up` already handles a changed service definition).

*Why a file and a script instead of a paths-filter action:* the deploy job runs on vm23 and needs the same answer as CI. One implementation, runnable locally (`deploy/affected.sh origin/main HEAD`), with a test that feeds it file lists.

*Why the unit is the Compose service, not the sub-project:* it is finer and needs no agreement on ownership to work. A change under `dashboard-v2` restarts `dashboard-v2` whoever owns it. The sub-project column only drives the manual `scope` input and documentation.

The sub-project column for `dashboard-v2` (it shows both CO₂ and PV data), `mqtt-ws-bridge` and `grafana` is an assumption — see Open Questions.

## Risks / Trade-offs

- **vm23 SSH password is in the public README** → anyone who can reach the host can log in as the user that will run the runner and owns the Docker stack. Rotate the password and remove it from the README before re-registering the runner (task group 1). Git history keeps the old value, which is why it must be rotated and not only deleted.
- **Unknown state of the checkout on vm23** (hand edits, untracked files, branch) → inventory it before the first deploy; D4 fails safe rather than overwriting.
- **First release carries four months of changes** → do it attended, note the currently running commit first so D4's manual run can return to it, and expect nginx to need `deploy/nginx.conf` re-applied by hand (routes for `kiosk3`, `kiosk4`, `leogreen` may be missing on the host).
- **nginx drift** stays possible because CI does not manage it → the smoke test at least turns a missing route into a red deploy.
- **Org admins and repo admins can bypass rulesets** → acceptable; keep the bypass list empty so bypassing is a deliberate settings change.
- **`ci-ok` must exist before it is required** → the ruleset is created only after `ci.yml` has run once on `main`; otherwise every pull request blocks on a check that never reports.
- **A path the map does not know** → treated as shared, so CI over-runs rather than under-runs; for deployment an unmapped new service directory would not be force-recreated. Mitigation: the script's test fails when a top-level directory with a `package.json` or a Compose service has no map line.
- **Cross-sub-project breakage is invisible to path scoping** → a sensor change to an MQTT topic or InfluxDB field can break the 3D view without touching `frontend`. No test covers this today either; the full run on `main` does not catch it. Accepted, and listed as follow-up.
- **One release train** → a team cannot ship its change without shipping whatever else is on `main`. Mitigated by D4a (others' services only restart if their files changed) and by the rule that `main` is always shippable.
- **Recreating a service means a cold `npm install`** → that service is down for up to a few minutes per release. Unchanged from a manual restart today; removing it means production builds, a non-goal.
- **Marker file lost or edited by hand** → falls back to recreating everything, which is safe.
- **Smoke test checks HTTP status, not correctness** → it catches "service did not start", not "chart is wrong". Accepted for now.
- **`eclipse-mosquitto:latest`, `telegraf:latest`, `grafana:latest`** can change under a redeploy → out of scope, noted for the follow-up change.
- **Runner host compromise equals app compromise** → unchanged from before; D3 narrows who can reach it.

## Migration Plan

Order matters; each step leaves the repo in a working state.

1. Host hygiene: rotate the password, inventory the VM checkout, record the running commit.
2. Land lockfiles, the path map with its script and test, and `ci.yml` through a normal pull request; confirm `ci-ok` reports on `main`.
3. Pin and bump `docs.yaml`.
4. Re-register the runner as a service with the `vm23` label; create the `production` environment restricted to `release`.
5. Land the new `deploy.yml` on `main`. From this merge on, nothing deploys automatically until `release` exists — the same as the last four months.
6. Create `release` from `main`. This push is the first deployment; with no marker file it recreates every service, so attend it.
7. Create the two rulesets and the fork-approval setting.
8. Land `AGENTS.md`, `CLAUDE.md` and the README changes (through a pull request, proving the rules).
9. Tell the team: direct pushes to `main` are off, shipping is a `main` → `release` pull request.

**Rollback.** Workflows and docs: revert the pull request. Rulesets: disable (they are not deleted, so re-enabling is one click). A bad deployment: run `deploy.yml` manually with the previous `release` commit, or merge a revert into `main` and promote it. The old behaviour (deploy on push to `main`) is restorable by reverting `deploy.yml`, but only works while the runner is up.

## Open Questions

- Which sub-project owns `dashboard-v2`, `mqtt-ws-bridge` and `grafana`? The map assigns the first two to PV-Dashboard and `grafana` to shared. A wrong guess only changes what the manual `scope` input restarts and is a one-line fix in `deploy/components.map`.

- Should the team adopt a merge queue on `main` later? Decide after a few weeks of real traffic (see D6).
- Is there an org-level runner that should be cleaned up? Needs someone with org-admin rights to look; does not affect this change.
