---
title: Betrieb
description: Deployment per GitHub Actions, Nginx-Routing, Backup und Restore der InfluxDB sowie bekannte Einschränkungen.
sidebar:
  order: 40
next: false
---

Diese Seite beschreibt, wie das System auf die Schul-VM gelangt, wie Anfragen verteilt und wie Daten gesichert werden.

## Deployment

Ein Workflow ist eine automatische Abfolge von Schritten bei GitHub (GitHub Actions). Ein Runner ist der Rechner, auf dem sie laufen; „self-hosted“ heißt: auf der Schul-VM statt bei GitHub. Bei jedem Push auf `main` laufen zwei Workflows in `.github/workflows/`:

| Workflow | Datei | Runner | Aktion |
|---|---|---|---|
| Continuous Deployment | `deploy.yml` | `self-hosted` (Schul-VM) | wechselt in das Projektverzeichnis auf der VM, führt `git pull` aus und startet `docker compose up -d --build` |
| Pages | `docs.yaml` | `ubuntu-latest` | `npm ci`, `npm run build` (Astro, baut auch die reveal.js-Folien aus `src/slides`; Node 22) und veröffentlicht den Ordner `dist` auf den Branch `gh-pages` (JamesIves/github-pages-deploy-action, `clean: true`); auch manuell startbar (`workflow_dispatch`) |

Der Pages-Workflow darf in den Branch `gh-pages` schreiben; ein neuer Lauf bricht einen noch laufenden ab.

Manuell wird die VM (Vorgehen laut `README.adoc`) mit `git pull` und `docker compose up -d --build` im Projektverzeichnis aktualisiert.

## Nginx-Routing

`deploy/nginx.conf` definiert einen Server für den Schul-Hostnamen: Anfragen auf Port 80 (unverschlüsselt) werden automatisch auf HTTPS (verschlüsselt, Port 443) umgeleitet. Die Verschlüsselung (TLS) wird in Nginx abgewickelt; die Zertifikate stammen von Let’s Encrypt (`/etc/letsencrypt`). Nginx ist hier der Reverse-Proxy: Er nimmt alle Anfragen an und reicht sie an die Dienste weiter, die auf `127.0.0.1` laufen.

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
2. Backup mit `docker exec influxdb influx backup` nach `/backups/<JJJJ-MM-TT>` im Container erstellen (Authentifizierung per Token, im Skript hinterlegt).
3. Backup mit `docker cp` nach `$HOME/influxdb-backups/<JJJJ-MM-TT>` kopieren.
4. Alte Backups bereinigen: die neuesten 8 Verzeichnisse (`KEEP_WEEKS=8`, Sortierung nach Änderungszeit) behalten, ältere löschen.

Zeitplan laut `README.adoc`: wöchentlich per Cron, sonntags 02:00, Ausgabe in eine Logdatei im Home-Verzeichnis. Der Cron-Eintrag (zeitgesteuerter Job unter Linux) muss einmalig manuell auf der VM angelegt werden; im Repository ist er nicht automatisiert.

### Restore (`backup/restore.sh`)

```bash
bash backup/restore.sh <JJJJ-MM-TT>
```

Ohne Argument listet das Skript die vorhandenen Backups. Mit Datum prüft es, ob das Verzeichnis existiert, kopiert es nach `/backups/restore-<Datum>` in den Container und führt `influx restore --full` aus.

:::caution
`--full` ersetzt laut InfluxDB-Dokumentation den gesamten Datenbestand inklusive Metadaten. Vor einem Restore den Zustand prüfen.
:::

## Bekannte Einschränkungen

- Die Compose-Dienste für Frontends starten Vite-Dev-Server (`npm run dev`) und führen bei jedem Start `npm install` aus; im Compose-Betrieb gibt es keinen Produktions-Build.
- Zugangsdaten und Tokens stehen im Klartext in `docker-compose.yaml`, `backup/*.sh` und weiteren Dateien (nicht hier wiedergegeben).
- Der wöchentliche Backup-Job (Cron) ist nur auf der VM eingerichtet und nicht im Repository abgelegt.
- Backups liegen nur auf derselben VM; ein externes Ziel ist nicht konfiguriert.
- Der Deploy-Workflow nutzt einen festen Pfad auf der VM und einen self-hosted Runner; er ist ohne diese VM nicht reproduzierbar.
- Die Nginx-Konfiguration liegt in `deploy/`, wird aber nicht automatisch auf die VM übertragen (dort `/etc/nginx/sites-available/leoiot`).
- Grafana ist zusätzlich direkt auf Port 3000 erreichbar, nicht nur über Nginx unter `/grafana/`.

## Quellen im Repository

- `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`, `package.json`
- `deploy/nginx.conf`
- `backup/backup.sh`, `backup/restore.sh`
- `docker-compose.yaml`
- `README.adoc`
