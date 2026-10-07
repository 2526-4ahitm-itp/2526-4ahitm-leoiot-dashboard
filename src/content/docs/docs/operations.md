---
title: Betrieb
description: Deployment per GitHub Actions, Nginx-Routing, Backup und Restore der InfluxDB sowie bekannte Einschränkungen.
sidebar:
  order: 40
---

## Deployment

Ein Workflow ist eine automatische Abfolge von Schritten bei GitHub (GitHub Actions). Ein Runner ist der Rechner, auf dem sie laufen; „self-hosted“ heißt: auf der Schul-VM statt bei GitHub. Bei jedem Push auf `main` laufen zwei Workflows in `.github/workflows/`:

| Workflow | Datei | Runner | Aktion |
|---|---|---|---|
| Continuous Deployment | `deploy.yml` | `self-hosted` (Schul-VM) | wechselt in das Projektverzeichnis auf der VM, führt `git pull` aus und startet `docker compose up -d --build` |
| Pages | `docs.yaml` | `ubuntu-latest` | `npm ci`, `npm run build` (Astro), baut zusätzlich die reveal.js-Folien aus `asciidocs/slides` (Asciidoctor in Docker) und veröffentlicht den Ordner `dist` auf den Branch `gh-pages` (JamesIves/github-pages-deploy-action, `clean: true`); auch manuell startbar (`workflow_dispatch`) |

Der Pages-Workflow hat die Berechtigung `contents: write` und eine `concurrency`-Gruppe `pages` mit `cancel-in-progress`.

Manuell wird die VM laut `README.adoc` mit `git pull` und `docker compose up -d --build` im Projektverzeichnis aktualisiert.

## Nginx-Routing

`deploy/nginx.conf` definiert einen Server für den Schul-Hostnamen: Anfragen auf Port 80 (unverschlüsselt) werden automatisch auf HTTPS (verschlüsselt, Port 443) umgeleitet. Die Verschlüsselung (TLS) wird in Nginx abgewickelt; die Zertifikate stammen von Let's Encrypt (`/etc/letsencrypt`). Nginx ist hier der Reverse-Proxy: Er nimmt alle Anfragen an und reicht sie an die Dienste weiter, die auf `127.0.0.1` laufen.

| Pfad | Ziel |
|---|---|
| `/` | `127.0.0.1:8080` (`frontend`, 3D-Explorer) |
| `/dashboard/` | `127.0.0.1:8081/` (`dashboard-v2`, Präfix wird entfernt) |
| `/kiosk/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/` | Ports 8082, 8083, 8084, 8085 |
| `/leogreen/` | `127.0.0.1:8087` (`leogreen-kiosk`) |
| `/grafana/` | `127.0.0.1:3000` (mit `X-Forwarded-Proto`) |
| `/influx/` | `127.0.0.1:8086/` (InfluxDB, Präfix wird entfernt) |
| `/ws` | `127.0.0.1:8090` (WebSocket-Upgrade, `mqtt-ws-bridge`) |
| `/solax/` | externe Solax-Cloud-API (`openapi-eu.solaxcloud.com`), Header `Access-Control-Allow-Origin: *` wird gesetzt |

Pfade ohne Schrägstrich am Ende (`/kiosk`, `/kiosk2`, `/kiosk3`, `/kiosk4`, `/leogreen`, `/dashboard`) werden per 301 auf die Variante mit `/` umgeleitet. Grafana ist passend dazu mit `GF_SERVER_ROOT_URL` und `GF_SERVER_SERVE_FROM_SUB_PATH=true` konfiguriert.

## Backup und Restore

Die Datenbank InfluxDB wird mit dem Kommandozeilen-Werkzeug `influx backup` gesichert (Backup = Sicherungskopie). Die Backups liegen im Container-Volume `influxdb_backups` (`/backups`) und zusätzlich auf dem Host.

### Backup (`backup/backup.sh`)

1. Zielverzeichnis `$HOME/influxdb-backups` anlegen.
2. `docker exec influxdb influx backup` nach `/backups/<JJJJ-MM-TT>` im Container (Authentifizierung per Token, im Skript hinterlegt).
3. `docker cp` des Backups nach `$HOME/influxdb-backups/<JJJJ-MM-TT>`.
4. Bereinigung: Es werden die neuesten `KEEP_WEEKS=8` Verzeichnisse behalten (Sortierung nach Änderungszeit), ältere werden gelöscht.

Zeitplan laut `README.adoc`: wöchentlich per Cron, sonntags 02:00, Ausgabe in eine Logdatei im Home-Verzeichnis. Der Cron-Eintrag muss einmalig manuell auf der VM angelegt werden; im Repository ist er nicht automatisiert.

### Restore (`backup/restore.sh`)

```bash
bash backup/restore.sh <JJJJ-MM-TT>
```

Ohne Argument listet das Skript die vorhandenen Backups. Mit Datum prüft es, ob das Verzeichnis existiert, kopiert es nach `/backups/restore-<Datum>` in den Container und führt `influx restore --full` aus.

:::caution
`--full` ersetzt laut InfluxDB-Dokumentation den gesamten Datenbestand inklusive Metadaten. Vor einem Restore den Zustand prüfen.
:::

## Bekannte Einschränkungen

- Die Compose-Dienste für Frontends starten Vite-Dev-Server (`npm run dev`) und führen bei jedem Start `npm install` aus; es gibt keinen Produktions-Build im Compose-Betrieb.
- Zugangsdaten und Tokens stehen im Klartext in `docker-compose.yaml`, `backup/*.sh` und weiteren Dateien (nicht hier wiedergegeben).
- Der Backup-Cron-Job ist nicht versioniert; sein Status auf der VM ist nicht dokumentiert.
- Backups liegen nur auf derselben VM; ein externes Ziel ist nicht konfiguriert.
- Der Deploy-Workflow nutzt einen festen Pfad auf der VM und einen self-hosted Runner; er ist ohne diese VM nicht reproduzierbar.
- Die Nginx-Konfiguration liegt in `deploy/`, wird aber nicht automatisch auf die VM übertragen (dort `/etc/nginx/sites-available/leoiot`); Grafana ist direkt auf Port 3000 und über Nginx unter `/grafana/` erreichbar.

## Quellen im Repository

- `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`
- `deploy/nginx.conf`
- `backup/backup.sh`, `backup/restore.sh`
- `docker-compose.yaml`
- `README.adoc`
