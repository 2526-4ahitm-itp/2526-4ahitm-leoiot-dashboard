---
title: Operations
description: Deployment (release via the release branch, selective updates, rollback, runner), Nginx routing, InfluxDB backup and restore, and known limitations.
sidebar:
  order: 40
next: false
---

This page describes how the system gets onto the school VM, how requests are distributed and how data is backed up.

## Deployment

A workflow is an automatic sequence of steps on GitHub (GitHub Actions). A runner is the computer that executes it; “self-hosted” means on the school VM instead of at GitHub. `.github/workflows/` contains three workflows:

| Workflow | File | Runner | Trigger | Action |
|---|---|---|---|---|
| CI | `ci.yml` | `ubuntu-24.04` (GitHub) | pull request into `main` or `release`, push to `main` | checks the affected components (tests, build, Compose files, images); aggregate status `ci-ok` |
| Deploy to vm23 | `deploy.yml` | `self-hosted`, label `vm23` (school VM) | push to the `release` branch, manual start | brings the released state onto the VM (see below) |
| Pages | `docs.yaml` | `ubuntu-24.04` | push to `main`, manual start (`workflow_dispatch`) | `npm ci`, `npm run build` (Astro, also builds the reveal.js slides from `src/slides`; Node 22) and publishes the `dist` folder to the `gh-pages` branch (JamesIves/github-pages-deploy-action, `clean: true`) |

The Pages workflow may write to the `gh-pages` branch; a new run cancels a run that is still in progress.

CI checks a component when one of its files changed, and also every Node component of the same sub-project that uses it as a local `file:` dependency in its `package.json` (for example a shared package of two apps); their images are built as well. An image is built with its own folder as the context, unless a file `build-context` next to the `Dockerfile` names an ancestor folder within the same `leoiot-*` folder (for example `..`); `.github/ci/image-build.sh <dir>` builds it exactly as CI does.

:::caution[Status]
The automatic deployment takes effect only once the runner is installed on the VM, the GitHub environment `production` exists and the `release` branch exists. Until then `deploy.yml` does not run, and changes to the application are brought onto the VM by hand (section “Updating by hand”).
:::

### How a release works

1. Changes arrive by pull request into `main`. A merge into `main` does **not** start a deployment.
2. Releasing means a pull request from `main` into `release`, merged with a merge commit once `ci-ok` is green. It needs no approval: its author may merge it. Everything merged into `main` goes live in one step, so unfinished work stays on its own branch.
3. The push to `release` starts `deploy.yml`. The runner on the VM puts the checkout `/home/solmqadmin/2526-4ahitm-leoiot-dashboard` on exactly that commit (`git checkout --detach`, without `--force`), updates the affected units and then checks the public addresses.
4. Only one deployment runs at a time; a second push waits until the first is finished.

### Deploy units and their order

A deploy unit is a top-level folder with a Compose file: `legacy` and every `leoiot-*` folder with a `compose.yaml` (today `legacy` and `leoiot-pv`). Each unit is its own Compose project and is started from its own folder. The order is `leoiot-platform`, then `legacy`, then the other `leoiot-*` units alphabetically. A new unit is picked up without any change to the workflow as soon as it has a `compose.yaml`. If a unit fails, the following ones are not touched.

For each affected unit the deployment runs `docker compose config -q` (fails early when the VM's `.env` is missing or incomplete) and then `docker compose up -d --build --remove-orphans`.

### What gets updated

What counts is what changed since the **last successful deployment**. Its commit is stored in the file `/home/solmqadmin/.leoiot-deployed-sha` outside the checkout; when the file is missing, everything is updated. `.github/ci/affected.sh` works out the affected units and services (the same script as in CI; the mapping of the legacy services is in `.github/ci/legacy-services.map`); the deployment itself is `.github/ci/deploy.sh`.

- **`legacy`: per service.** The Node services bind-mount their folder, so a Compose `up` alone does not restart them. Exactly the services with changed files are therefore recreated with `--force-recreate` (`npm install` runs again, and the service is unreachable for a few minutes). `quarkus-app` is additionally rebuilt by `--build`.
- **New units (`leoiot-pv`): per image.** The images are rebuilt, and only services whose image or definition changed are recreated.
- **Units without changes** are not touched: a legacy-only release does not build PV images, and a PV-only release does not restart a legacy container.
- **Nginx** is not managed by the deployment. If an `nginx*.conf` in `leoiot-platform/` (today `leoiot-platform/proxy/nginx.conf`) changes, or there is no earlier deployment, the run prints a warning: the file has to be applied on the VM by hand (`/etc/nginx/sites-available/leoiot` is a copy).

### Configuration on the VM

The `.env` files of the units (for example `leoiot-pv/.env`) exist only on the VM, are not in the repository and are neither created, read nor changed by the deployment. The deployment never passes `--profile`. Optional services behind a Compose profile run only if the VM's `.env` switches the profile on via `COMPOSE_PROFILES`. This matters most for the PV `collector`: the SolaX cloud allows one session per account, so it must never run next to another collector using the same account.

### Check after the deployment

Afterwards the deployment requests every route in `.github/ci/smoke-routes` through `https://vm23.htl-leonding.ac.at` (redirects are followed, the final status must be 2xx), every 10 seconds for up to 5 minutes. The runner uses the public hostname but connects to `127.0.0.1` on vm23, because vm23 cannot reach its own public address; the requests still go through nginx and its TLS certificate, and `SMOKE_CONNECT_TO` overrides the address (empty uses DNS). If a route does not answer, the run fails and names it. Only after the check passed is the commit written to the marker file; after a failure the next deployment therefore also makes up what the failed one was meant to update. New sub-projects add their routes to `.github/ci/smoke-routes`. The check only shows that services answer, not that they show the right thing.

### Manual run, rollback and `scope`

Under Actions → “Deploy to vm23” → “Run workflow” (choose the `release` branch: the `production` environment only allows runs from `release`) there are two inputs:

| Input | Values | Effect |
|---|---|---|
| `ref` | commit, branch or tag; default `release` | This commit is deployed. It must be on `release`, otherwise the run stops before anything on the VM changes. |
| `scope` | `affected` (default), `all` or a unit name (`legacy`, `leoiot-pv`, …) | `affected`: only what changed since the last deployment. `all`: all units, all legacy services and all services of the new units are recreated. Unit name: the same for that unit alone, whatever files changed. |

**Rollback:** set `ref` to an earlier commit of `release`. The run puts the VM on that commit and updates what differs between the current and that state; to be safe, also set `scope` to `all`. Alternatively merge a revert into `main` and release it as usual. Commits from before the CI layout (without `.github/ci/affected.sh`) cannot be deployed with this workflow. A rollback only works to commits from `4db0bb9` on: a run uses the `deploy.sh` of the commit it deploys, and before that commit the smoke test connected to vm23's public address, which vm23 cannot reach from itself; such a run rolls out but then fails at the smoke test and does not write the marker.

### When the checkout stops

The deployment never overwrites anything that was changed locally on the VM. If a container rewrites a file that is tracked in the repository (typically `legacy/frontend/package-lock.json`, because `npm install` runs in the bind-mounted folder) and a release changes that file, the checkout stops. The error message names the file and the command; on the VM:

```bash
cd /home/solmqadmin/2526-4ahitm-leoiot-dashboard
git checkout -- <file>
```

Then run the deployment again (Actions → “Re-run” or a manual run).

### Runner

The runner runs on the VM as user `solmqadmin`, is registered as a repository runner with the labels `self-hosted` and `vm23` and installed as a systemd service, so it starts by itself after a reboot. It only executes runs of `release`: no workflow with a pull-request trigger uses this runner, and the `production` environment only allows the `release` branch. If it is offline, the run fails after about 10 minutes with the message “vm23 runner did not pick up the job” (a watchdog job on a GitHub runner) instead of waiting 24 hours. In that case check `sudo ./svc.sh status` in the runner folder on the VM.

### Updating by hand

As long as the runner and the `release` branch are missing, the manual route remains: update the old stack with `docker compose up -d --build` in the `legacy/` folder of the project directory, then recreate changed Node services by hand (`docker compose up -d --force-recreate --no-deps <service>`). The main kiosk is a separate Compose project (`leoiot-pv`); it is started or updated with `docker compose up -d --build` in the `leoiot-pv/` folder (setup: [Setup](../setup/#main-kiosk) page).

## Nginx routing

`leoiot-platform/proxy/nginx.conf` defines one server for the school hostname: requests on port 80 (unencrypted) are automatically redirected to HTTPS (encrypted, port 443). Nginx handles the encryption (TLS); the certificates come from Let’s Encrypt (`/etc/letsencrypt`). Nginx acts as the reverse proxy here: it receives all requests and passes them on to the services running on `127.0.0.1`.

| Path | Target |
|---|---|
| `/` | `127.0.0.1:8080` (`frontend`, 3D explorer) |
| `/dashboard/` | `127.0.0.1:8081/` (`dashboard-v2`, prefix stripped) |
| `/kiosk/` | `127.0.0.1:8088` (main kiosk from `leoiot-pv/`) |
| `/kiosk/ws` | `127.0.0.1:8088` (WebSocket to the bridge, via the main kiosk's own nginx) |
| `/leogreen/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/` (also without `/`) | permanent 301 redirect to `/kiosk/`, the query is kept |
| `/grafana/` | `127.0.0.1:3000` (with `X-Forwarded-Proto`) |
| `/influx/` | `127.0.0.1:8086/` (InfluxDB, prefix stripped) |
| `/ws` | `127.0.0.1:8090` (WebSocket upgrade, `mqtt-ws-bridge`) |
| `/mqtt` | `127.0.0.1:9001` (MQTT over WebSocket, broker of `leoiot-platform/`; anonymous, read-only on the room-climate topics; at most 20 connections per client address) |
| `/solax/` | external Solax cloud API (`openapi-eu.solaxcloud.com`), header `Access-Control-Allow-Origin: *` is set |

Only the paths `/kiosk` and `/dashboard` without a trailing slash are redirected with a 301 to the variant with `/`. Grafana is configured to match with `GF_SERVER_ROOT_URL` and `GF_SERVER_SERVE_FROM_SUB_PATH=true`.

## Backup and restore

The InfluxDB database is backed up with the command-line tool `influx backup` (a backup is a safety copy). Backups are stored in the container volume `influxdb_backups` (`/backups`) and additionally on the host.

### Backup (`legacy/backup/backup.sh`)

1. Create the target directory `$HOME/influxdb-backups`.
2. Create the backup with `docker exec influxdb influx backup` into `/backups/<YYYY-MM-DD>` in the container (authenticated with a token stored in the script).
3. Copy the backup with `docker cp` to `$HOME/influxdb-backups/<YYYY-MM-DD>`.
4. Clean up old backups: keep the newest 8 directories (`KEEP_WEEKS=8`, sorted by modification time), delete older ones.

Schedule according to `legacy/README.adoc`: weekly via cron, Sundays at 02:00, output to a log file in the home directory. The cron entry (a scheduled job on Linux) must be created once by hand on the VM; it is not automated in the repository.

### Restore (`legacy/backup/restore.sh`)

```bash
bash legacy/backup/restore.sh <YYYY-MM-DD>
```

Without an argument the script lists the available backups. With a date it checks that the directory exists, copies it to `/backups/restore-<date>` in the container and runs `influx restore --full`.

:::caution
According to the InfluxDB documentation, `--full` replaces the entire data set including metadata. Check the state before restoring.
:::

## Known limitations

- The Compose frontend services of the old stack (`legacy/`) start Vite dev servers (`npm run dev`) and run `npm install` on every start; there is no production build there. The main kiosk, in contrast, runs as a built image with nginx.
- Credentials and tokens are stored in plain text in `legacy/docker-compose.yaml`, `legacy/backup/*.sh` and other files (not reproduced here).
- The weekly backup job (cron) is set up only on the VM and is not stored in the repository.
- Backups are stored only on the same VM; no external target is configured.
- The deploy workflow (`deploy.yml`) takes effect only once the runner is installed on the VM, the `production` environment exists and the `release` branch exists; until then updates are made by hand. It uses a fixed path on the VM (`/home/solmqadmin/2526-4ahitm-leoiot-dashboard`).
- The Nginx configuration lives in `leoiot-platform/proxy/` but is not copied to the VM automatically (there: `/etc/nginx/sites-available/leoiot`).
- Grafana is additionally reachable directly on port 3000, not only via Nginx under `/grafana/`.

## Sources in the repository

- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`, `package.json`
- `.github/ci/deploy.sh`, `.github/ci/affected.sh`, `.github/ci/image-build.sh`, `.github/ci/legacy-services.map`, `.github/ci/smoke-routes`
- `leoiot-platform/proxy/nginx.conf`
- `leoiot-pv/compose.yaml`
- `legacy/backup/backup.sh`, `legacy/backup/restore.sh`
- `legacy/docker-compose.yaml`
- `legacy/README.adoc`
