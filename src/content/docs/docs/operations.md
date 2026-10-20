---
title: Betrieb
description: Deployment (Veröffentlichung über den Branch release, selektive Updates, Rollback, Runner), Nginx-Routing, Backup und Restore der InfluxDB sowie bekannte Einschränkungen.
sidebar:
  order: 40
next: false
---

Diese Seite beschreibt, wie das System auf die Schul-VM gelangt, wie Anfragen verteilt und wie Daten gesichert werden.

## Deployment

Ein Workflow ist eine automatische Abfolge von Schritten bei GitHub (GitHub Actions). Ein Runner ist der Rechner, auf dem sie laufen; „self-hosted“ heißt: auf der Schul-VM statt bei GitHub. In `.github/workflows/` liegen drei Workflows:

| Workflow | Datei | Runner | Auslöser | Aktion |
|---|---|---|---|---|
| CI | `ci.yml` | `ubuntu-24.04` (GitHub) | Pull Request nach `main` oder `release`, Push auf `main` | prüft die betroffenen Bestandteile (Tests, Build, Compose-Dateien, Images); Sammelstatus `ci-ok` |
| Deploy to vm23 | `deploy.yml` | `self-hosted`, Label `vm23` (Schul-VM) | Push auf den Branch `release`, manueller Start | bringt den veröffentlichten Stand auf die VM (siehe unten) |
| Pages | `docs.yaml` | `ubuntu-24.04` | Push auf `main`, manueller Start (`workflow_dispatch`) | `npm ci`, `npm run build` (Astro, baut auch die reveal.js-Folien aus `src/slides`; Node 22) und veröffentlicht den Ordner `dist` auf den Branch `gh-pages` (JamesIves/github-pages-deploy-action, `clean: true`) |

Der Pages-Workflow darf in den Branch `gh-pages` schreiben; ein neuer Lauf bricht einen noch laufenden ab.

CI prüft einen Bestandteil, wenn sich eine seiner Dateien geändert hat, und zusätzlich jeden Node-Bestandteil desselben Teilprojekts, der ihn in seiner `package.json` als lokale `file:`-Abhängigkeit einbindet (etwa ein gemeinsames Paket zweier Apps); auch deren Images werden gebaut. Ein Image wird mit seinem eigenen Ordner als Kontext gebaut, außer eine Datei `build-context` neben dem `Dockerfile` nennt einen übergeordneten Ordner innerhalb desselben `leoiot-*`-Ordners (etwa `..`); `.github/ci/image-build.sh <Ordner>` baut es genau wie CI.

:::caution[Stand]
Das automatische Deployment wirkt erst, wenn der Runner auf der VM installiert, die GitHub-Umgebung `production` angelegt ist und der Branch `release` existiert. Bis dahin läuft `deploy.yml` nicht, und Änderungen an der Anwendung kommen von Hand auf die VM (Abschnitt „Von Hand aktualisieren“).
:::

### Ablauf einer Veröffentlichung

1. Änderungen kommen per Pull Request nach `main`. Ein Merge nach `main` startet **kein** Deployment.
2. Veröffentlichen heißt: ein Pull Request von `main` nach `release`, den eine zweite Person freigibt, und der mit einem Merge-Commit gemergt wird. Es geht dabei alles, was in `main` gemergt ist, in einem Zug live; unfertige Arbeit bleibt deshalb auf ihrem eigenen Branch.
3. Der Push auf `release` startet `deploy.yml`. Der Runner auf der VM stellt den Checkout `/home/solmqadmin/2526-4ahitm-leoiot-dashboard` auf genau diesen Commit (`git checkout --detach`, ohne `--force`), aktualisiert die betroffenen Einheiten und prüft danach die öffentlichen Adressen.
4. Es läuft immer nur ein Deployment; ein zweiter Push wartet, bis das erste fertig ist.

### Deploy-Einheiten und Reihenfolge

Eine Deploy-Einheit ist ein Ordner im Wurzelverzeichnis mit einer Compose-Datei: `legacy` und jeder `leoiot-*`-Ordner mit `compose.yaml` (heute `legacy` und `leoiot-pv`). Jede Einheit ist ein eigenes Compose-Projekt und wird aus ihrem eigenen Ordner gestartet. Die Reihenfolge ist `leoiot-platform`, dann `legacy`, dann die übrigen `leoiot-*`-Einheiten alphabetisch. Eine neue Einheit wird ohne Änderung am Workflow erkannt, sobald sie eine `compose.yaml` hat. Schlägt eine Einheit fehl, werden die folgenden nicht mehr angefasst.

Pro betroffener Einheit führt das Deployment `docker compose config -q` aus (bricht früh ab, wenn die `.env` der VM fehlt oder unvollständig ist) und danach `docker compose up -d --build --remove-orphans`.

### Was aktualisiert wird

Betroffen ist, was sich seit dem **letzten erfolgreichen Deployment** geändert hat. Dessen Commit steht in der Datei `/home/solmqadmin/.leoiot-deployed-sha` außerhalb des Checkouts; fehlt sie, wird alles aktualisiert. Welche Einheiten und Dienste betroffen sind, berechnet `.github/ci/affected.sh` (dasselbe Skript wie in der CI, Zuordnung der Legacy-Dienste in `.github/ci/legacy-services.map`); das Deployment selbst steckt in `.github/ci/deploy.sh`.

- **`legacy`: pro Dienst.** Die Node-Dienste binden ihren Ordner ein; ein Compose-`up` allein startet sie nicht neu. Deshalb werden genau die Dienste mit geänderten Dateien mit `--force-recreate` neu erstellt (ein `npm install` läuft dabei neu, der Dienst ist einige Minuten nicht erreichbar). `quarkus-app` wird zusätzlich durch `--build` neu gebaut.
- **Neue Einheiten (`leoiot-pv`): pro Image.** Die Images werden neu gebaut, und nur Dienste mit geändertem Image oder geänderter Definition werden neu erstellt.
- **Einheiten ohne Änderung** werden nicht angefasst: Eine reine Legacy-Veröffentlichung baut keine PV-Images, eine reine PV-Veröffentlichung startet keinen Legacy-Container neu.
- **Nginx** wird nicht vom Deployment verwaltet. Ändert sich `legacy/deploy/nginx.conf` (oder später eine `nginx*.conf` in `leoiot-platform/`), oder gibt es noch kein früheres Deployment, steht im Lauf eine Warnung: Die Datei muss von Hand auf der VM übernommen werden (`/etc/nginx/sites-available/leoiot` ist eine Kopie).

### Konfiguration auf der VM

Die `.env`-Dateien der Einheiten (zum Beispiel `leoiot-pv/.env`) liegen nur auf der VM, sind nicht im Repository und werden vom Deployment weder angelegt noch gelesen noch geändert. Das Deployment übergibt nie `--profile`. Optionale Dienste hinter einem Compose-Profil laufen nur, wenn die `.env` der VM das Profil über `COMPOSE_PROFILES` einschaltet. Das gilt besonders für den PV-`collector`: Die SolaX-Cloud erlaubt eine Sitzung pro Konto, er darf nie neben einem anderen Collector mit demselben Konto laufen.

### Prüfung nach dem Deployment

Danach ruft das Deployment jede Adresse aus `.github/ci/smoke-routes` über `https://vm23.htl-leonding.ac.at` ab (Weiterleitungen werden verfolgt, am Ende muss ein 2xx-Status stehen), alle 10 Sekunden bis zu 5 Minuten lang. Der Runner verwendet den öffentlichen Hostnamen, verbindet sich aber mit `127.0.0.1` auf vm23, weil vm23 seine eigene öffentliche Adresse nicht erreichen kann; die Anfragen laufen weiterhin über nginx und dessen TLS-Zertifikat, und `SMOKE_CONNECT_TO` ersetzt die Adresse (leer nutzt DNS). Antwortet eine Adresse nicht, schlägt der Lauf fehl und nennt sie. Erst nach bestandener Prüfung wird der Commit in die Marker-Datei geschrieben; nach einem Fehlschlag holt das nächste Deployment also alles nach, was das fehlgeschlagene aktualisieren sollte. Neue Teilprojekte tragen ihre Adressen in `.github/ci/smoke-routes` ein. Die Prüfung zeigt nur, dass Dienste antworten, nicht dass sie das Richtige anzeigen.

### Manueller Lauf, Rollback und `scope`

Unter Actions → „Deploy to vm23“ → „Run workflow“ (als Branch `release` wählen: die Umgebung `production` erlaubt nur Läufe von `release`) gibt es zwei Eingaben:

| Eingabe | Werte | Wirkung |
|---|---|---|
| `ref` | Commit, Branch oder Tag; Standard `release` | Dieser Commit wird bereitgestellt. Er muss auf `release` liegen, sonst bricht der Lauf ab, bevor etwas auf der VM geändert wird. |
| `scope` | `affected` (Standard), `all` oder ein Einheitenname (`legacy`, `leoiot-pv`, …) | `affected`: nur das Geänderte seit dem letzten Deployment. `all`: alle Einheiten, alle Legacy-Dienste und alle Dienste der neuen Einheiten werden neu erstellt. Einheitenname: dasselbe nur für diese Einheit, unabhängig von den geänderten Dateien. |

**Rollback:** `ref` auf einen früheren Commit von `release` setzen. Der Lauf bringt die VM auf diesen Commit und aktualisiert, was sich zwischen dem aktuellen und diesem Stand unterscheidet; wer sicher gehen will, setzt zusätzlich `scope` auf `all`. Alternativ einen Revert nach `main` mergen und wie gewohnt veröffentlichen. Commits aus der Zeit vor der CI-Struktur (ohne `.github/ci/affected.sh`) lassen sich mit diesem Workflow nicht bereitstellen. Ein Rollback funktioniert nur auf Commits ab `4db0bb9`: Ein Lauf verwendet das `deploy.sh` des Commits, den er bereitstellt, und davor verband sich die Prüfung nach dem Deployment mit der öffentlichen Adresse von vm23, die vm23 selbst nicht erreichen kann; so ein Lauf spielt zwar aus, scheitert dann aber an der Prüfung und schreibt den Marker nicht.

### Wenn der Checkout stehen bleibt

Das Deployment überschreibt nichts, was auf der VM lokal geändert wurde. Beschreibt ein Container eine Datei, die im Repository versioniert ist (typisch `legacy/frontend/package-lock.json`, weil dort `npm install` im eingebundenen Ordner läuft), und ändert die Veröffentlichung diese Datei, bricht der Checkout ab. Die Fehlermeldung nennt die Datei und den Befehl; auf der VM:

```bash
cd /home/solmqadmin/2526-4ahitm-leoiot-dashboard
git checkout -- <datei>
```

Danach den Lauf wiederholen (Actions → „Re-run“ oder ein manueller Lauf).

### Runner

Der Runner läuft auf der VM als Benutzer `solmqadmin`, ist als Repository-Runner mit den Labels `self-hosted` und `vm23` registriert und als systemd-Dienst installiert, startet also nach einem Neustart von selbst. Er führt nur Läufe von `release` aus: Es gibt keinen Workflow mit Pull-Request-Auslöser auf diesem Runner, und die Umgebung `production` erlaubt nur den Branch `release`. Ist er offline, schlägt der Lauf nach etwa 10 Minuten mit der Meldung „vm23 runner did not pick up the job“ fehl (Wächter-Job auf einem GitHub-Runner), statt 24 Stunden zu warten. Dann auf der VM `sudo ./svc.sh status` im Runner-Ordner prüfen.

### Von Hand aktualisieren

Solange Runner und Branch `release` fehlen, bleibt der Handweg: Der alte Stack wird im Ordner `legacy/` des Projektverzeichnisses mit `docker compose up -d --build` aktualisiert, danach müssen geänderte Node-Dienste von Hand neu erstellt werden (`docker compose up -d --force-recreate --no-deps <dienst>`). Der Hauptkiosk ist ein eigenes Compose-Projekt (`leoiot-pv`) und wird im Ordner `leoiot-pv/` mit `docker compose up -d --build` gestartet bzw. aktualisiert (Einrichtung: Seite [Einrichtung](../setup/#hauptkiosk)).

## Nginx-Routing

`legacy/deploy/nginx.conf` definiert einen Server für den Schul-Hostnamen: Anfragen auf Port 80 (unverschlüsselt) werden automatisch auf HTTPS (verschlüsselt, Port 443) umgeleitet. Die Verschlüsselung (TLS) wird in Nginx abgewickelt; die Zertifikate stammen von Let’s Encrypt (`/etc/letsencrypt`). Nginx ist hier der Reverse-Proxy: Er nimmt alle Anfragen an und reicht sie an die Dienste weiter, die auf `127.0.0.1` laufen.

| Pfad | Ziel |
|---|---|
| `/` | `127.0.0.1:8080` (`frontend`, 3D-Explorer) |
| `/dashboard/` | `127.0.0.1:8081/` (`dashboard-v2`, Präfix wird entfernt) |
| `/kiosk/` | `127.0.0.1:8088` (Hauptkiosk aus `leoiot-pv/`) |
| `/kiosk/ws` | `127.0.0.1:8088` (WebSocket zur Bridge, über den nginx des Hauptkiosks) |
| `/leogreen/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/` (auch ohne `/`) | dauerhafte 301-Umleitung auf `/kiosk/`, die Query bleibt erhalten |
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
- Zugangsdaten und Tokens stehen im Klartext in `legacy/docker-compose.yaml`, `legacy/backup/*.sh` und weiteren Dateien (nicht hier wiedergegeben).
- Der wöchentliche Backup-Job (Cron) ist nur auf der VM eingerichtet und nicht im Repository abgelegt.
- Backups liegen nur auf derselben VM; ein externes Ziel ist nicht konfiguriert.
- Der Deploy-Workflow (`deploy.yml`) wirkt erst, wenn der Runner auf der VM installiert, die Umgebung `production` angelegt ist und der Branch `release` existiert; bis dahin wird von Hand aktualisiert. Er nutzt einen festen Pfad auf der VM (`/home/solmqadmin/2526-4ahitm-leoiot-dashboard`).
- Die Nginx-Konfiguration liegt in `legacy/deploy/`, wird aber nicht automatisch auf die VM übertragen (dort `/etc/nginx/sites-available/leoiot`).
- Grafana ist zusätzlich direkt auf Port 3000 erreichbar, nicht nur über Nginx unter `/grafana/`.

## Quellen im Repository

- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/docs.yaml`, `package.json`
- `.github/ci/deploy.sh`, `.github/ci/affected.sh`, `.github/ci/image-build.sh`, `.github/ci/legacy-services.map`, `.github/ci/smoke-routes`
- `legacy/deploy/nginx.conf`
- `leoiot-pv/compose.yaml`
- `legacy/backup/backup.sh`, `legacy/backup/restore.sh`
- `legacy/docker-compose.yaml`
- `legacy/README.adoc`
