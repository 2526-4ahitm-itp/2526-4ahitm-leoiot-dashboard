---
title: Betrieb
description: Deployment (Stand der Workflows und manueller Weg), Nginx-Routing, Backup und Restore der InfluxDB sowie bekannte Einschränkungen.
sidebar:
  order: 40
next: false
---

Diese Seite beschreibt, wie das System auf die Schul-VM gelangt, wie Anfragen verteilt und wie Daten gesichert werden.

## Deployment

Ein Workflow ist eine automatische Abfolge von Schritten bei GitHub (GitHub Actions). Ein Runner ist der Rechner, auf dem sie laufen; „self-hosted“ heißt: auf der Schul-VM statt bei GitHub. In `.github/workflows/` liegen zwei Workflows, die bei jedem Push auf `main` starten sollen. Davon läuft derzeit nur einer:

| Workflow | Datei | Runner | Aktion |
|---|---|---|---|
| Continuous Deployment | `deploy.yml` | `self-hosted` (Schul-VM) | soll in das Projektverzeichnis auf der VM wechseln, `git pull` ausführen und `docker compose up -d --build` starten; **läuft derzeit nicht** (siehe unten) |
| Pages | `docs.yaml` | `ubuntu-latest` | `npm ci`, `npm run build` (Astro, baut auch die reveal.js-Folien aus `src/slides`; Node 22) und veröffentlicht den Ordner `dist` auf den Branch `gh-pages` (JamesIves/github-pages-deploy-action, `clean: true`); auch manuell startbar (`workflow_dispatch`) |

Der Pages-Workflow darf in den Branch `gh-pages` schreiben; ein neuer Lauf bricht einen noch laufenden ab.

`deploy.yml` läuft derzeit nicht, aus zwei Gründen: Auf GitHub ist kein self-hosted Runner registriert, die Läufe werden daher abgebrochen. Außerdem ruft der Workflow `docker compose up -d --build` im Wurzelordner des Checkouts auf, die Compose-Datei liegt aber unter `legacy/`. Automatisch veröffentlicht wird deshalb nur die Doku-Seite (`docs.yaml`). Änderungen an der Anwendung kommen von Hand auf die VM; das ist derzeit der einzige Weg.

Manuell wird der alte Stack (Vorgehen laut `legacy/README.adoc`) mit `git pull` und `docker compose up -d --build` im Ordner `legacy/` des Projektverzeichnisses aktualisiert. Der Hauptkiosk ist ein eigenes Compose-Projekt (`leoiot-pv`) und wird im Ordner `leoiot-pv/` mit `docker compose up -d --build` gestartet bzw. aktualisiert (Einrichtung: Seite [Einrichtung](../setup/#hauptkiosk)).

## Nginx-Routing

`legacy/deploy/nginx.conf` definiert einen Server für den Schul-Hostnamen: Anfragen auf Port 80 (unverschlüsselt) werden automatisch auf HTTPS (verschlüsselt, Port 443) umgeleitet. Die Verschlüsselung (TLS) wird in Nginx abgewickelt; die Zertifikate stammen von Let’s Encrypt (`/etc/letsencrypt`). Nginx ist hier der Reverse-Proxy: Er nimmt alle Anfragen an und reicht sie an die Dienste weiter, die auf `127.0.0.1` laufen.

| Pfad | Ziel |
|---|---|
| `/` | `127.0.0.1:8080` (`frontend`, 3D-Explorer) |
| `/dashboard/` | `127.0.0.1:8081/` (`dashboard-v2`, Präfix wird entfernt) |
| `/kiosk/` | `127.0.0.1:8088` (Hauptkiosk aus `leoiot-pv/`) |
| `/kiosk/ws` | `127.0.0.1:8088` (WebSocket zur Bridge, über den nginx des Hauptkiosks) |
| `/leogreen/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/` (auch ohne `/`) | 302-Umleitung auf `/kiosk/`, die Query bleibt erhalten |
| `/grafana/` | `127.0.0.1:3000` (mit `X-Forwarded-Proto`) |
| `/influx/` | `127.0.0.1:8086/` (InfluxDB, Präfix wird entfernt) |
| `/ws` | `127.0.0.1:8090` (WebSocket-Upgrade, `mqtt-ws-bridge`) |
| `/solax/` | externe Solax-Cloud-API (`openapi-eu.solaxcloud.com`), Header `Access-Control-Allow-Origin: *` wird gesetzt |

Nur die Pfade `/kiosk` und `/dashboard` ohne Schrägstrich am Ende werden per 301 auf die Variante mit `/` umgeleitet. Grafana ist passend dazu mit `GF_SERVER_ROOT_URL` und `GF_SERVER_SERVE_FROM_SUB_PATH=true` konfiguriert.

## Backup und Restore

Die Datenbank InfluxDB wird mit dem Kommandozeilen-Werkzeug `influx backup` gesichert (Backup = Sicherungskopie). Die Backups liegen im Container-Volume `influxdb_backups` (`/backups`) und zusätzlich auf dem Host.

### Backup (`legacy/backup/backup.sh`)

1. Zielverzeichnis `$HOME/influxdb-backups` anlegen.
2. Backup mit `docker exec influxdb influx backup` nach `/backups/<JJJJ-MM-TT>` im Container erstellen (Authentifizierung per Token, im Skript hinterlegt).
3. Backup mit `docker cp` nach `$HOME/influxdb-backups/<JJJJ-MM-TT>` kopieren.
4. Alte Backups bereinigen: die neuesten 8 Verzeichnisse (`KEEP_WEEKS=8`, Sortierung nach Änderungszeit) behalten, ältere löschen.

Zeitplan laut `legacy/README.adoc`: wöchentlich per Cron, sonntags 02:00, Ausgabe in eine Logdatei im Home-Verzeichnis. Der Cron-Eintrag (zeitgesteuerter Job unter Linux) muss einmalig manuell auf der VM angelegt werden; im Repository ist er nicht automatisiert.

### Restore (`legacy/backup/restore.sh`)

```bash
bash legacy/backup/restore.sh <JJJJ-MM-TT>
```

Ohne Argument listet das Skript die vorhandenen Backups. Mit Datum prüft es, ob das Verzeichnis existiert, kopiert es nach `/backups/restore-<Datum>` in den Container und führt `influx restore --full` aus.

:::caution
`--full` ersetzt laut InfluxDB-Dokumentation den gesamten Datenbestand inklusive Metadaten. Vor einem Restore den Zustand prüfen.
:::

## Bekannte Einschränkungen

- Die Compose-Dienste für Frontends im alten Stack (`legacy/`) starten Vite-Dev-Server (`npm run dev`) und führen bei jedem Start `npm install` aus; dort gibt es keinen Produktions-Build. Der Hauptkiosk läuft dagegen als gebautes Image mit nginx.
- Die fünf abgelösten Kiosk-Container (Ports 8082 bis 8085 und 8087) laufen vorübergehend noch, sind über die Adressen nicht mehr erreichbar und werden entfernt.
- Zugangsdaten und Tokens stehen im Klartext in `legacy/docker-compose.yaml`, `legacy/backup/*.sh` und weiteren Dateien (nicht hier wiedergegeben).
- Der wöchentliche Backup-Job (Cron) ist nur auf der VM eingerichtet und nicht im Repository abgelegt.
- Backups liegen nur auf derselben VM; ein externes Ziel ist nicht konfiguriert.
- Der Deploy-Workflow (`deploy.yml`) läuft derzeit nicht: Es ist kein self-hosted Runner registriert, und er ruft Compose im Wurzelordner statt in `legacy/` auf. Er nutzt zudem einen festen Pfad auf der VM.
- Die Nginx-Konfiguration liegt in `legacy/deploy/`, wird aber nicht automatisch auf die VM übertragen (dort `/etc/nginx/sites-available/leoiot`).
- Grafana ist zusätzlich direkt auf Port 3000 erreichbar, nicht nur über Nginx unter `/grafana/`.

## Quellen im Repository

- `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`, `package.json`
- `legacy/deploy/nginx.conf`
- `leoiot-pv/compose.yaml`
- `legacy/backup/backup.sh`, `legacy/backup/restore.sh`
- `legacy/docker-compose.yaml`
- `legacy/README.adoc`
