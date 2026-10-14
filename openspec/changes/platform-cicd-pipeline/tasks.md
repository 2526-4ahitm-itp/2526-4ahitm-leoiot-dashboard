# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin`; tasks marked **(repo admin)** change GitHub settings. Everything else is a normal pull request.

## 1. Host hygiene before anything touches vm23

- [ ] 1.1 **(human, vm23)** Change the `solmqadmin` password on vm23; verify the old password from `legacy/README.adoc` is rejected on a fresh SSH login
- [x] 1.2 Remove the SSH password and the web UI admin password (Grafana, InfluxDB) from `legacy/README.adoc` and replace them with "ask a maintainer"; removing a secret is an allowed change to frozen `legacy/`. Do not write the removed values anywhere, including the pull request. Verify that in the "Console Access (SSH)" section the only line mentioning a password says "ask a maintainer", and that no line of the Configuration table still has an `Admin /` entry
- [ ] 1.3 **(human, vm23)** Inventory the checkout in `/home/solmqadmin/2526-4ahitm-leoiot-dashboard`: record `git rev-parse HEAD`, `git status --short` and the current branch in the pull request for 5.x; commit or discard local edits deliberately so `git status --short` is empty; verify the three outputs are recorded
- [ ] 1.4 **(human, vm23)** Compare `/etc/nginx/sites-available/leoiot` with the `legacy/deploy/nginx.conf` of the commit recorded in 1.3 (the one currently running), and record the differences; do not apply the `main` version: it contains the PV kiosk cut-over (port 8088 and the redirects from `/kiosk2/`, `/kiosk3/`, `/kiosk4/`, `/leogreen/`), which may only be applied once `leoiot-pv` runs on vm23, coordinated with the PV team, and is not part of this change; verify `nginx -t` passes and note the diff result
- [ ] 1.5 **(human, vm23)** List the running Compose projects (`docker compose ls`) and check that `leoiot-pv/.env` exists with `KIOSK_INFLUX_TOKEN` set, that no `.env` is tracked by Git (`git ls-files '*.env'` prints nothing), and whether `COMPOSE_PROFILES` is set in any `.env`; verify `cd leoiot-pv && docker compose config -q` succeeds and that the `collector` service is not running

## 2. CI scripts and configuration

- [x] 2.1 Create `.github/ci/legacy-services.map` per design D11, one line per legacy path plus `-  influxdb`, and `.github/ci/smoke-routes` with the nine initial routes; verify every service in `docker compose -f legacy/docker-compose.yaml config --services` appears in the map and every map line names an existing service
- [x] 2.2 Write `.github/ci/affected.sh <base> <head>` that applies the discovery rules of design D11: components by `package.json`/`pom.xml`, Compose files and their units, Dockerfile directories below `leoiot-*`, the docs and no-check paths, the legacy service map, and "everything" for `.github/` and unknown paths; it also prints whether the nginx warning applies and supports a unit argument for manual scope; verify `.github/ci/affected.sh HEAD~5 HEAD` runs locally and prints a plausible set
- [x] 2.3 Write `.github/ci/affected.test.sh` with fixed file lists (one change under `leoiot-pv/kiosk` only, one under `legacy/frontend` only, docs only, `openspec/` only, a workflow change, `legacy/docker-compose.yaml`, `legacy/deploy/nginx.conf`, an unmapped path) and the completeness check of design D11 (every legacy Compose service in the map, every map service existing, every `legacy/*` directory with a `package.json` mapped); verify the test passes and fails when a map line is deleted

## 3. Pull-request CI

- [x] 3.1 Run the Node checks locally in every component the script finds: `npm ci` where a lockfile exists, `npm install --no-package-lock` for `legacy/kiosk`, `legacy/kiosk4` and `legacy/leogreenKiosk`, then `npm test` and `npm run build` where those scripts exist (Node 22 for `leoiot-*` and the docs, Node 20 for `legacy/*`); fix or record anything that fails so CI starts green; verify each command exits 0 and `git status --short` shows no new lockfile
- [ ] 3.2 Run `./mvnw -B verify` in `legacy/backend/sensor-data-generator` with Java 21; verify the three test classes run and pass, and that no integration test needs Docker (if one does, restrict the CI command to `test` and note it in the workflow)
- [ ] 3.3 Run `docker compose -f <file> config -q` for `legacy/docker-compose.yaml` and for `leoiot-pv/compose.yaml` with `--env-file leoiot-pv/.env.example`, and `docker build` for `leoiot-pv/kiosk` and `leoiot-pv/collector`; verify each exits 0
- [x] 3.4 Create `.github/workflows/ci.yml` per design D7 (`changes` job using `.github/ci/affected.sh`, jobs `docs`, dynamic `node` matrix, `maven`, `compose`, `images`, `ci-scripts`, gate job `ci-ok` that accepts `skipped` only when `changes` succeeded; `ubuntu-24.04`; `permissions: contents: read`; `pull_request` and `push: main` triggers only; per-PR concurrency with cancel); verify with `actionlint` or `gh workflow view` that it parses
- [ ] 3.5 Open the pull request; because it touches `.github/` it must run every job; verify all jobs and `ci-ok` are green
- [ ] 3.6 Prove scoping: open a throwaway pull request that changes one file under `leoiot-pv/kiosk` only; verify only the `leoiot-pv/kiosk` checks (Node and image build) run, the other jobs are skipped, and `ci-ok` is green and reported
- [ ] 3.7 Prove the gate: on the throwaway branch break the `leoiot-pv/kiosk` build and desync its lockfile; verify the leg fails and `ci-ok` is red; then make `affected.sh` exit non-zero and verify `ci-ok` is red although the other jobs are skipped; close the pull request
- [ ] 3.8 After merge, verify the `push` run on `main` runs every job and reports `ci-ok` green

## 4. Pages workflow hardening

- [ ] 4.1 In `.github/workflows/docs.yaml` set `runs-on: ubuntu-24.04` and move `actions/checkout` and `actions/setup-node` to their current major versions (look them up, do not guess); verify the next Pages run on `main` succeeds without the Node deprecation annotation and the site returns 200 at https://2526-4ahitm-itp.github.io/2526-4ahitm-leoiot-dashboard/

## 5. Runner and deploy workflow

- [ ] 5.1 **(human, vm23)** Remove any old runner directory/service, install the current Actions runner as `solmqadmin`, register it on the repository with labels `self-hosted,vm23`, and install it as a systemd service (`./svc.sh install && ./svc.sh start`); verify `gh api repos/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard/actions/runners` lists it as `online`
- [ ] 5.2 **(human, vm23)** Reboot vm23 (or restart the service if a reboot is not possible now); verify the runner is `online` again without logging in, and that both Compose projects (`2526-4ahitm-leoiot-dashboard` and `leoiot-pv`) came back
- [ ] 5.3 **(repo admin)** Create the `production` environment with URL `https://vm23.htl-leonding.ac.at` and a deployment branch policy that allows only `release`; verify with `gh api repos/.../environments/production/deployment-branch-policies`
- [ ] 5.4 **(repo admin)** Set Actions → fork pull request workflows to "Require approval for all outside collaborators"; verify in the settings API/page
- [ ] 5.5 Rewrite `.github/workflows/deploy.yml` per design D1, D3, D4: triggers `push: release` and `workflow_dispatch` with inputs `ref` and `scope` (`affected`, `all`, or a unit name such as `legacy` or `leoiot-pv`), `runs-on: [self-hosted, vm23]`, `environment: production`, `permissions: contents: read`, concurrency group `deploy-vm23` without cancel, `timeout-minutes: 20`, ancestor check, detached checkout without `--force` whose failure message names the file and the `git checkout -- <file>` fix, and per affected unit in the order `leoiot-platform`, `legacy`, the rest: `docker compose config -q` then `docker compose up -d --build --remove-orphans` run from the unit's folder; verify it parses and contains no `pull_request` trigger
- [ ] 5.6 Add the update granularity of design D4a: read the marker file, compute units and legacy services with `.github/ci/affected.sh`, `--force-recreate` the legacy services (all of them when the marker is missing or `scope` is `all` or `legacy`), add `--force-recreate` for a unit named by `scope`, never pass `--profile` and never write or read any `.env`, print the units and services in the job summary, emit the nginx warning when `legacy/deploy/nginx.conf` or a `leoiot-platform/**/nginx*.conf` is in the diff (or there is no marker); verify by a dry run of the script part on a workstation against two known commits
- [ ] 5.7 Add the smoke test per design D5 (every route in `.github/ci/smoke-routes`, redirects followed, final 2xx required, 5-minute retry) and write the marker file only after it passes; verify by reading the workflow that no path writes the marker before the smoke test
- [ ] 5.8 Add the runner watchdog job per design D8 (GitHub-hosted, cancels and fails the run when the deploy job is still queued after 10 minutes); verify by stopping the runner service, starting a manual run, and seeing it fail in about 10 minutes with the runner message; restart the service afterwards
- [ ] 5.9 Add a "Deployment" section to the README and update the Deployment section of `src/content/docs/docs/operations.md` to describe the release flow, deploy units and their order, the legacy per-service and new-unit per-image updates, `COMPOSE_PROFILES` and `.env` handling on the host, the `scope` input, manual rollback and the `git checkout -- <file>` fix for a conflicting tracked file; replace the `git pull` steps in `legacy/README.adoc` with a pointer to it; verify the documented commands match the workflow's input names and the docs site builds

## 6. First release and deploy behaviour

- [ ] 6.1 Merge the deploy workflow to `main`; verify no deployment run starts (none should, `release` does not exist yet)
- [ ] 6.2 **(attended, with a maintainer watching vm23)** Create `release` from `main` and push it; verify the deploy run is picked up by the `vm23` runner, updates both units (`legacy` first, with every service recreated because there is no marker yet), passes the smoke test, writes the marker, that `git rev-parse HEAD` on vm23 equals the `release` head, and that the `leoiot-pv` `collector` is not running
- [ ] 6.3 Prove selective restart in legacy: release a change that touches only `legacy/frontend`; verify with `docker inspect -f '{{.State.StartedAt}}'` that `frontend` restarted and `kiosk`, `mqtt-ws-bridge`, `influxdb` and the `leoiot-pv` containers kept their previous start time
- [ ] 6.4 Prove unit scoping for a new unit: release a change that touches only `leoiot-pv/kiosk`; verify the PV `kiosk` container was recreated from a new image (image ID changed) and every legacy container kept its previous start time
- [ ] 6.5 Prove Node services update: release a visible log-line change in `legacy/fake-sensors`; verify `docker compose logs fake-sensors` (run in `legacy/`) shows the new line after the deployment
- [ ] 6.6 Prove recovery: make one deployment fail (stop a container's route so the smoke test fails), then deploy a later release; verify the marker was not advanced by the failed run and the later run updates the units and services of both releases
- [ ] 6.7 Exercise rollback and scope: start a manual run with the previous `release` commit and verify vm23 moves to it and the smoke test passes; redeploy the head; then run with `scope: leoiot-pv` on the same commit and verify only the `leoiot-pv` services were recreated and every legacy container kept its start time
- [ ] 6.8 Verify refusal: start a manual run naming a commit that is only on a feature branch; verify the run fails at the ancestor check and vm23's `HEAD` and the marker are unchanged

## 7. Branch rules

- [ ] 7.1 Tell the whole team (all teams and the maintainers) when the `main` ruleset goes live and that it blocks direct pushes, which people use today; verify every member has acknowledged it and nobody has unmerged work that depends on pushing to `main`
- [ ] 7.2 **(repo admin)** Create the `main` ruleset per design D6 (pull request required, required check `ci-ok`, 0 approvals, no force push, no deletion, empty bypass list); verify a direct `git push origin HEAD:main` from a test commit is rejected
- [ ] 7.3 **(repo admin)** Create the `release` ruleset (same, plus 1 approving review); verify a direct push is rejected and a `main` → `release` pull request shows "review required" and cannot be merged by its author alone
- [ ] 7.4 Export both rulesets as JSON into `.github/rulesets/` so the configuration is reviewable; verify the files match `gh api repos/.../rulesets/<id>`

## 8. Team and agent workflow

- [ ] 8.1 Write `AGENTS.md` per design D10: branch per task from fresh `main`, worktree per concurrent agent, branch naming, pull request into `main`, never push to `main`/`release`, never approve or merge a promotion, never change rulesets/runner/deploy target unprompted; the layout (which folder belongs to which team, `legacy/` frozen, each sub-project's code stays in its own folder), spec grouping with a pointer to `openspec/specs/README.md`, contract first (shared interfaces go into `openspec/specs/platform/` through a platform change before code relies on them); that shared files such as Compose files and `.github/` need extra care; how to run each CI step and `.github/ci/affected.sh` locally; verify every command in it runs as written
- [ ] 8.2 Add `CLAUDE.md` that imports `@AGENTS.md`; verify a fresh Claude Code session in the repo lists the branch rules when asked how to ship a change
- [ ] 8.3 Link `AGENTS.md` from the README and from the docs site's contributing page if one exists; verify the links resolve in the built site
- [ ] 8.4 Land 8.1–8.3 through a pull request from a worktree, as the first change made under the new rules; verify it needed green `ci-ok` to merge

## 9. End-to-end check

- [ ] 9.1 Ship one trivial visible change the whole way: feature branch → pull request → `main` → promotion pull request approved by a second person → automatic deploy; verify the change is visible on https://vm23.htl-leonding.ac.at and the `production` environment shows the new commit
- [ ] 9.2 Confirm with all five team members that a direct push to `main` is rejected for them and that they have run one pull request through the flow

## Workflow follow-up

- Open a separate change for the credentials committed to the repository (InfluxDB admin token, MQTT password, hard-coded tokens in the JS sources) and the `latest` image tags.
- Ask an org admin whether an old org-level runner for vm23 still exists and remove it.
- Consider contract checks for the MQTT topics and InfluxDB fields the sub-projects share; path-scoped CI cannot see breakage across them.
- Revisit a merge queue on `main` after a few weeks of parallel agent work.
- Add a README and `AGENTS.md` pointer to the platform owner once `leoiot-platform` has one.
- Archive this change once 9.1 and 9.2 are done.
