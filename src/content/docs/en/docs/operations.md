---
title: Operations
description: Deployment via GitHub Actions, Nginx routing, InfluxDB backup and restore, and known limitations.
sidebar:
  order: 40
---

## Deployment

A workflow is an automatic sequence of steps on GitHub (GitHub Actions). A runner is the computer that executes it; “self-hosted” means on the school VM instead of at GitHub. On every push to `main`, two workflows in `.github/workflows/` run:

| Workflow | File | Runner | Action |
|---|---|---|---|
| Continuous Deployment | `deploy.yml` | `self-hosted` (school VM) | changes into the project directory on the VM, runs `git pull` and `docker compose up -d --build` |
| Pages | `docs.yaml` | `ubuntu-latest` | `npm ci`, `npm run build` (Astro), additionally builds the reveal.js slides from `asciidocs/slides` (Asciidoctor in Docker) and publishes the `dist` folder to the `gh-pages` branch (JamesIves/github-pages-deploy-action, `clean: true`); can also be started manually (`workflow_dispatch`) |

The Pages workflow has `contents: write` permission and a `concurrency` group `pages` with `cancel-in-progress`.

To update the VM manually, run `git pull` and `docker compose up -d --build` in the project directory (see `README.adoc`).

## Nginx routing

`deploy/nginx.conf` defines one server for the school hostname: requests on port 80 (unencrypted) are automatically redirected to HTTPS (encrypted, port 443). Nginx handles the encryption (TLS); the certificates come from Let's Encrypt (`/etc/letsencrypt`). Nginx acts as the reverse proxy here: it receives all requests and passes them on to the services running on `127.0.0.1`.

| Path | Target |
|---|---|
| `/` | `127.0.0.1:8080` (`frontend`, 3D explorer) |
| `/dashboard/` | `127.0.0.1:8081/` (`dashboard-v2`, prefix stripped) |
| `/kiosk/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/` | ports 8082, 8083, 8084, 8085 |
| `/leogreen/` | `127.0.0.1:8087` (`leogreen-kiosk`) |
| `/grafana/` | `127.0.0.1:3000` (with `X-Forwarded-Proto`) |
| `/influx/` | `127.0.0.1:8086/` (InfluxDB, prefix stripped) |
| `/ws` | `127.0.0.1:8090` (WebSocket upgrade, `mqtt-ws-bridge`) |
| `/solax/` | external Solax cloud API (`openapi-eu.solaxcloud.com`), header `Access-Control-Allow-Origin: *` is set |

Paths without a trailing slash (`/kiosk`, `/kiosk2`, `/kiosk3`, `/kiosk4`, `/leogreen`, `/dashboard`) are redirected with a 301 to the variant with `/`. Grafana is configured to match with `GF_SERVER_ROOT_URL` and `GF_SERVER_SERVE_FROM_SUB_PATH=true`.

## Backup and restore

The InfluxDB database is backed up with the command-line tool `influx backup` (a backup is a safety copy). Backups are stored in the container volume `influxdb_backups` (`/backups`) and additionally on the host.

### Backup (`backup/backup.sh`)

1. Create the target directory `$HOME/influxdb-backups`.
2. `docker exec influxdb influx backup` to `/backups/<YYYY-MM-DD>` in the container (authenticated with a token stored in the script).
3. `docker cp` of the backup to `$HOME/influxdb-backups/<YYYY-MM-DD>`.
4. Cleanup: the newest `KEEP_WEEKS=8` directories are kept (sorted by modification time), older ones are deleted.

Schedule according to `README.adoc`: weekly via cron, Sundays at 02:00, output to a log file in the home directory. The cron entry must be created once by hand on the VM; it is not automated in the repository.

### Restore (`backup/restore.sh`)

```bash
bash backup/restore.sh <YYYY-MM-DD>
```

Without an argument the script lists the available backups. With a date it checks that the directory exists, copies it to `/backups/restore-<date>` in the container and runs `influx restore --full`.

:::caution
According to the InfluxDB documentation, `--full` replaces the entire data set including metadata. Check the state before restoring.
:::

## Known limitations

- The Compose frontend services start Vite dev servers (`npm run dev`) and run `npm install` on every start; there is no production build in Compose operation.
- Credentials and tokens are stored in plain text in `docker-compose.yaml`, `backup/*.sh` and other files (not reproduced here).
- The backup cron job is not versioned; its status on the VM is not documented.
- Backups are stored only on the same VM; no external target is configured.
- The deploy workflow uses a fixed path on the VM and a self-hosted runner; it cannot be reproduced without that VM.
- The Nginx configuration lives in `deploy/` but is not copied to the VM automatically (there: `/etc/nginx/sites-available/leoiot`); Grafana is reachable directly on port 3000 and via Nginx under `/grafana/`.

## Sources in the repository

- `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`
- `deploy/nginx.conf`
- `backup/backup.sh`, `backup/restore.sh`
- `docker-compose.yaml`
- `README.adoc`
