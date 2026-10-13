---
title: Operations
description: Deployment (state of the workflows and the manual route), Nginx routing, InfluxDB backup and restore, and known limitations.
sidebar:
  order: 40
next: false
---

This page describes how the system gets onto the school VM, how requests are distributed and how data is backed up.

## Deployment

A workflow is an automatic sequence of steps on GitHub (GitHub Actions). A runner is the computer that executes it; “self-hosted” means on the school VM instead of at GitHub. `.github/workflows/` contains two workflows that are meant to start on every push to `main`. Currently only one of them runs:

| Workflow | File | Runner | Action |
|---|---|---|---|
| Continuous Deployment | `deploy.yml` | `self-hosted` (school VM) | is meant to change into the project directory on the VM, run `git pull` and `docker compose up -d --build`; **currently does not run** (see below) |
| Pages | `docs.yaml` | `ubuntu-latest` | `npm ci`, `npm run build` (Astro, also builds the reveal.js slides from `src/slides`; Node 22) and publishes the `dist` folder to the `gh-pages` branch (JamesIves/github-pages-deploy-action, `clean: true`); can also be started manually (`workflow_dispatch`) |

The Pages workflow may write to the `gh-pages` branch; a new run cancels a run that is still in progress.

`deploy.yml` currently does not run, for two reasons: no self-hosted runner is registered on GitHub, so the runs are cancelled. In addition, the workflow calls `docker compose up -d --build` in the root folder of the checkout, but the Compose file is located under `legacy/`. Therefore only the documentation site is published automatically (`docs.yaml`). Changes to the application are brought onto the VM by hand; this is currently the only way.

To update the old stack manually, run `git pull` and `docker compose up -d --build` in the `legacy/` folder of the project directory (procedure as described in `legacy/README.adoc`). The main kiosk is a separate Compose project (`leoiot-pv`); it is started or updated with `docker compose up -d --build` in the `leoiot-pv/` folder (setup: [Setup](../setup/#main-kiosk) page).

## Nginx routing

`legacy/deploy/nginx.conf` defines one server for the school hostname: requests on port 80 (unencrypted) are automatically redirected to HTTPS (encrypted, port 443). Nginx handles the encryption (TLS); the certificates come from Let’s Encrypt (`/etc/letsencrypt`). Nginx acts as the reverse proxy here: it receives all requests and passes them on to the services running on `127.0.0.1`.

| Path | Target |
|---|---|
| `/` | `127.0.0.1:8080` (`frontend`, 3D explorer) |
| `/dashboard/` | `127.0.0.1:8081/` (`dashboard-v2`, prefix stripped) |
| `/kiosk/` | `127.0.0.1:8088` (main kiosk from `leoiot-pv/`) |
| `/kiosk/ws` | `127.0.0.1:8088` (WebSocket to the bridge, via the main kiosk's own nginx) |
| `/leogreen/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/` (also without `/`) | 302 redirect to `/kiosk/`, the query is kept |
| `/grafana/` | `127.0.0.1:3000` (with `X-Forwarded-Proto`) |
| `/influx/` | `127.0.0.1:8086/` (InfluxDB, prefix stripped) |
| `/ws` | `127.0.0.1:8090` (WebSocket upgrade, `mqtt-ws-bridge`) |
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
- The five superseded kiosk containers (ports 8082 to 8085 and 8087) are temporarily still running, are no longer reachable via the addresses and will be removed.
- Credentials and tokens are stored in plain text in `legacy/docker-compose.yaml`, `legacy/backup/*.sh` and other files (not reproduced here).
- The weekly backup job (cron) is set up only on the VM and is not stored in the repository.
- Backups are stored only on the same VM; no external target is configured.
- The deploy workflow (`deploy.yml`) currently does not run: no self-hosted runner is registered, and it calls Compose in the root folder instead of `legacy/`. It also uses a fixed path on the VM.
- The Nginx configuration lives in `legacy/deploy/` but is not copied to the VM automatically (there: `/etc/nginx/sites-available/leoiot`).
- Grafana is additionally reachable directly on port 3000, not only via Nginx under `/grafana/`.

## Sources in the repository

- `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`, `package.json`
- `legacy/deploy/nginx.conf`
- `leoiot-pv/compose.yaml`
- `legacy/backup/backup.sh`, `legacy/backup/restore.sh`
- `legacy/docker-compose.yaml`
- `legacy/README.adoc`
