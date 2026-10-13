# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin`; tasks marked **(repo admin)** change GitHub settings. Everything else is a normal pull request.

## 1. Host hygiene before anything touches vm23

- [ ] 1.1 **(human, vm23)** Change the `solmqadmin` password on vm23; verify the old password from the README is rejected on a fresh SSH login
- [ ] 1.2 Remove the SSH password and the InfluxDB UI password from `README.adoc` and replace them with "ask a maintainer"; verify `grep -n "L4Sun\|leogreen" README.adoc` finds nothing
- [ ] 1.3 **(human, vm23)** Inventory the checkout in `/home/solmqadmin/2526-4ahitm-leoiot-dashboard`: record `git rev-parse HEAD`, `git status --short` and the current branch in the pull request for 5.x; commit or discard local edits deliberately so `git status --short` is empty
- [ ] 1.4 **(human, vm23)** Compare `/etc/nginx/sites-enabled/leoiot` with `deploy/nginx.conf` and re-apply it if routes are missing; verify `nginx -t` passes and note the result

## 2. Path mapping

- [ ] 2.1 Confirm with the three teams which sub-project owns `dashboard-v2`, `mqtt-ws-bridge` and `grafana`; verify the answer is written into the map in 2.2 (design D11 holds the assumed values)
- [ ] 2.2 Create `deploy/components.map` per design D11 covering every top-level component directory and every service in `docker-compose.yaml`; verify each Compose service name in the map exists in `docker compose config --services`
- [ ] 2.3 Write `deploy/affected.sh <base> <head>` that prints affected components and services from the map, treats unmapped and shared paths as "all components" for CI, and supports a sub-project argument for manual scope; verify `deploy/affected.sh HEAD~5 HEAD` runs locally and prints a plausible set
- [ ] 2.4 Add a test script for `affected.sh` with fixed file lists (one sub-project only, docs only, a workflow change, `docker-compose.yaml`, `deploy/nginx.conf`, an unmapped path) and a completeness check that fails when a directory with a `package.json` or a Compose service has no map line; verify the test passes and fails when a map line is deleted

## 3. Pull-request CI

- [ ] 3.1 Generate `package-lock.json` for `kiosk`, `kiosk4` and `leogreenKiosk` with npm 10 (Node 20); verify `npm ci` succeeds in each of the three directories
- [ ] 3.2 Run `npm ci` in every component and `npm run build` in the seven Vite apps locally; fix or record anything that fails so CI starts green; verify each command exits 0
- [ ] 3.3 Run `./mvnw -B verify` in `backend/sensor-data-generator` with Java 21; verify the three test classes run and pass, and that no integration test needs Docker (if one does, restrict the CI command to `test` and note it in the workflow)
- [ ] 3.4 Create `.github/workflows/ci.yml` per design D7 (`changes` job using `deploy/affected.sh`, jobs `docs`, dynamic `node` matrix, `backend`, `compose`, a job running the 2.4 test, gate job `ci-ok` that accepts `skipped` only when `changes` succeeded; `ubuntu-24.04`; `permissions: contents: read`; `pull_request` and `push: main` triggers only; per-PR concurrency with cancel); verify with `actionlint` or `gh workflow view` that it parses
- [ ] 3.5 Open the pull request; because it touches `.github/` it must run every job; verify all jobs and `ci-ok` are green
- [ ] 3.6 Prove scoping: open a throwaway pull request that changes one file under `frontend` only; verify only the `frontend` matrix leg runs, the other jobs are skipped, and `ci-ok` is green and reported
- [ ] 3.7 Prove the gate: on the throwaway branch break the `frontend` build and desync its lockfile; verify the leg fails and `ci-ok` is red; then make `affected.sh` exit non-zero and verify `ci-ok` is red although the other jobs are skipped; close the pull request
- [ ] 3.8 After merge, verify the `push` run on `main` runs every job and reports `ci-ok` green

## 4. Pages workflow hardening

- [ ] 4.1 In `.github/workflows/docs.yaml` set `runs-on: ubuntu-24.04` and move `actions/checkout` and `actions/setup-node` to their current major versions (look them up, do not guess); verify the next Pages run on `main` succeeds without the Node deprecation annotation and the site returns 200 at https://2526-4ahitm-itp.github.io/2526-4ahitm-leoiot-dashboard/

## 5. Runner and deploy workflow

- [ ] 5.1 **(human, vm23)** Remove any old runner directory/service, install the current Actions runner as `solmqadmin`, register it on the repository with labels `self-hosted,vm23`, and install it as a systemd service (`./svc.sh install && ./svc.sh start`); verify `gh api repos/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard/actions/runners` lists it as `online`
- [ ] 5.2 **(human, vm23)** Reboot vm23 (or restart the service if a reboot is not possible now); verify the runner is `online` again without logging in, and that the Compose stack came back
- [ ] 5.3 **(repo admin)** Create the `production` environment with URL `https://vm23.htl-leonding.ac.at` and a deployment branch policy that allows only `release`; verify with `gh api repos/.../environments/production/deployment-branch-policies`
- [ ] 5.4 **(repo admin)** Set Actions → fork pull request workflows to "Require approval for all outside collaborators"; verify in the settings API/page
- [ ] 5.5 Rewrite `.github/workflows/deploy.yml` per design D1, D3, D4: triggers `push: release` and `workflow_dispatch` with inputs `ref` and `scope` (`affected`, `all`, `sensoren`, `pv-dashboard`, `3d-modell`), `runs-on: [self-hosted, vm23]`, `environment: production`, `permissions: contents: read`, concurrency group `deploy-vm23` without cancel, `timeout-minutes: 20`, ancestor check, detached checkout without `--force`, `docker compose up -d --build --remove-orphans`; verify it parses and contains no `pull_request` trigger
- [ ] 5.6 Add selective recreation per design D4a: read the marker file, compute services with `deploy/affected.sh`, `--force-recreate` them (all when the marker is missing or `scope` is `all`), print the list in the job summary, emit the nginx warning when `deploy/nginx.conf` is in the diff; verify by a dry run of the script part on a workstation against two known commits
- [ ] 5.7 Add the smoke test per design D5 (all routes, 5-minute retry) and write the marker file only after it passes; verify by reading the workflow that no path writes the marker before the smoke test
- [ ] 5.8 Add the runner watchdog job per design D8 (GitHub-hosted, cancels and fails the run when the deploy job is still queued after 10 minutes); verify by stopping the runner service, starting a manual run, and seeing it fail in about 10 minutes with the runner message; restart the service afterwards
- [ ] 5.9 Update the README "Deployment" section to describe the release flow, selective restarts, the `scope` input and manual rollback instead of `git pull` on the host; verify the documented commands match the workflow's input names

## 6. First release and deploy behaviour

- [ ] 6.1 Merge the deploy workflow to `main`; verify no deployment run starts (none should, `release` does not exist yet)
- [ ] 6.2 **(attended, with a maintainer watching vm23)** Create `release` from `main` and push it; verify the deploy run is picked up by the `vm23` runner, recreates every service (no marker yet), passes the smoke test, writes the marker, and that `git rev-parse HEAD` on vm23 equals the `release` head
- [ ] 6.3 Prove selective restart: release a change that touches only `frontend`; verify with `docker inspect -f '{{.State.StartedAt}}'` that `frontend` restarted and `kiosk`, `mqtt-ws-bridge` and `influxdb` kept their previous start time
- [ ] 6.4 Prove Node services update: release a visible log-line change in `fake-sensors`; verify `docker compose logs fake-sensors` shows the new line after the deployment
- [ ] 6.5 Prove recovery: make one deployment fail (stop a container's route so the smoke test fails), then deploy a later release; verify the marker was not advanced by the failed run and the later run recreates the services of both releases
- [ ] 6.6 Exercise rollback and scope: start a manual run with the previous `release` commit and verify vm23 moves to it and the smoke test passes; redeploy the head; then run with `scope: pv-dashboard` on the same commit and verify only the PV-Dashboard services restarted
- [ ] 6.7 Verify refusal: start a manual run naming a commit that is only on a feature branch; verify the run fails at the ancestor check and vm23's `HEAD` and the marker are unchanged

## 7. Branch rules

- [ ] 7.1 **(repo admin)** Create the `main` ruleset per design D6 (pull request required, required check `ci-ok`, 0 approvals, no force push, no deletion, empty bypass list); verify a direct `git push origin HEAD:main` from a test commit is rejected
- [ ] 7.2 **(repo admin)** Create the `release` ruleset (same, plus 1 approving review); verify a direct push is rejected and a `main` → `release` pull request shows "review required" and cannot be merged by its author alone
- [ ] 7.3 Export both rulesets as JSON into `.github/rulesets/` so the configuration is reviewable; verify the files match `gh api repos/.../rulesets/<id>`

## 8. Team and agent workflow

- [ ] 8.1 Write `AGENTS.md` per design D10 (branch per task from fresh `main`, worktree per concurrent agent, branch naming, pull request into `main`, never push to `main`/`release`, never approve or merge a promotion, never change rulesets/runner/deploy target unprompted, which directories belong to which sub-project and that shared files such as `docker-compose.yaml` need extra care, how to run each CI step and `deploy/affected.sh` locally); verify every command in it runs as written
- [ ] 8.2 Add `CLAUDE.md` that imports `@AGENTS.md`; verify a fresh Claude Code session in the repo lists the branch rules when asked how to ship a change
- [ ] 8.3 Link `AGENTS.md` from the README and from the docs site's contributing page if one exists; verify the links resolve in the built site
- [ ] 8.4 Land 8.1–8.3 through a pull request from a worktree, as the first change made under the new rules; verify it needed green `ci-ok` to merge

## 9. End-to-end check

- [ ] 9.1 Ship one trivial visible change the whole way: feature branch → pull request → `main` → promotion pull request approved by a second person → automatic deploy; verify the change is visible on https://vm23.htl-leonding.ac.at and the `production` environment shows the new commit
- [ ] 9.2 Confirm with all five team members that a direct push to `main` is rejected for them and that they have run one pull request through the flow

## Workflow follow-up

- Open a separate change for the credentials committed to the repository (InfluxDB admin token, MQTT password, hard-coded tokens in the JS sources) and the `latest` image tags.
- Ask an org admin whether an old org-level runner for vm23 still exists and remove it.
- Consider contract checks for the MQTT topics and InfluxDB fields the three sub-projects share; path-scoped CI cannot see breakage across them.
- Revisit a merge queue on `main` after a few weeks of parallel agent work.
- Archive this change once 9.1 and 9.2 are done.
