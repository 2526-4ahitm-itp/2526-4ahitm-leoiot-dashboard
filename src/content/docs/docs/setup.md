---
title: Einrichtung
description: Voraussetzungen, Start der Plattform-Einheit in leoiot-platform/, des alten Stacks in legacy/ und des Hauptkiosks in leoiot-pv/ mit Docker Compose, Ports, benötigte Dateien und lokale Entwicklung.
sidebar:
  order: 30
---

Diese Seite beschreibt, wie die Plattform-Einheit in `leoiot-platform/` (Broker und gemeinsames Netz), der alte Stack in `legacy/` und zusätzlich der Hauptkiosk in `leoiot-pv/` lokal gestartet werden. Docker Compose (Werkzeug zum gemeinsamen Starten mehrerer Container) startet die Dienste eines Stacks mit einem Befehl.

## Voraussetzungen

- Docker mit dem Compose-Plugin (der Start erfolgt über `docker compose`).
- Die Node-Dienste (JavaScript-Programme) laufen im Container (`node:20-alpine`) und installieren ihre Bibliotheken beim Start selbst (`npm install`). Node muss daher nicht auf dem eigenen Rechner installiert sein.
- Der Dienst `quarkus-app` wird aus `legacy/backend/sensor-data-generator` per Dockerfile gebaut (`src/main/docker/Dockerfile`).
- Für den Dienst `mosquitto` (in `leoiot-platform/`) müssen die Dateien `leoiot-platform/broker/pwfile` und `leoiot-platform/broker/acl` existieren (siehe unten).

## Start

```bash
# zuerst im Ordner leoiot-platform/: Broker und gemeinsames Netz
docker compose up -d

# dann im Ordner legacy/ des Repositorys
docker compose up -d
```

Ohne `-d` laufen die Logs im Vordergrund. Logs einzelner Dienste: `docker compose logs -f dashboard-v2`, Stoppen: `docker compose down`.

Die Plattform-Einheit (`leoiot-platform/compose.yaml`) startet den Broker `mosquitto` (`eclipse-mosquitto:2.0.22`) und legt das gemeinsame Netz `2526-4ahitm-leoiot-dashboard_leoiot` an. In `legacy/` startet Compose folgende Dienste (alle in diesem Netz, dem der alte Stack als externem Netz beitritt):

| Dienst | Image / Quelle | Zweck |
|---|---|---|
| `influxdb` | `influxdb:2.7` | Zeitreihendatenbank (Setup-Modus beim ersten Start) |
| `telegraf` | `telegraf:latest` | liest MQTT-Topics und schreibt nach InfluxDB (`legacy/telegraf.conf`) |
| `grafana` | `grafana/grafana:latest` | Dashboards (Provisioning aus `legacy/grafana/`) |
| `quarkus-app` | Build aus `legacy/backend/sensor-data-generator` | Sensordaten-Generator (publiziert u. a. `sine`, `room-temperature`) |
| `frontend` | `node:20-alpine`, `./frontend` | 3D-Explorer (Vite-Dev-Server) |
| `dashboard-v2` | `node:20-alpine`, `./dashboard-v2` | Dashboard (Raumklima und PV, Vite-Dev-Server) |
| `mqtt-ws-bridge` | `node:20-alpine`, `./mqtt-ws-bridge` | Bridge: gibt MQTT-Messwerte per WebSocket an den Browser weiter |
| `fake-sensors` | `node:20-alpine`, `./fake-sensors` | simulierte Sensoren zum Testen |

## Ports

| Port | Dienst |
|---|---|
| 1883 | Mosquitto (MQTT, `leoiot-platform/`) |
| 9001 | Mosquitto (MQTT über WebSocket, nur auf `127.0.0.1`; von außen über Nginx unter `/mqtt`) |
| 8086 | InfluxDB |
| 3000 | Grafana |
| 8080 | `frontend` (3D-Explorer) |
| 8081 | `dashboard-v2` |
| 8088 | Hauptkiosk (`leoiot-pv/`, nur auf `127.0.0.1`) |
| 8090 | `mqtt-ws-bridge` (WebSocket) |

`quarkus-app`, `telegraf` und `fake-sensors` veröffentlichen keine Ports.

## Hauptkiosk

Der Hauptkiosk liegt in `leoiot-pv/kiosk/` und läuft als eigenes Compose-Projekt `leoiot-pv` (`leoiot-pv/compose.yaml`). Er hängt am gemeinsamen Netz (`2526-4ahitm-leoiot-dashboard_leoiot`), das die Plattform-Einheit anlegt; die Plattform-Einheit muss deshalb laufen.

```bash
# im Ordner leoiot-pv/ des Repositorys
cp .env.example .env
# in .env den reinen Lese-Token für InfluxDB eintragen (KIOSK_INFLUX_TOKEN)
docker compose up -d --build
```

Danach ist der Kiosk unter `http://localhost:8088/kiosk/` erreichbar. Der Lese-Token bleibt im nginx des Kiosks; der Browser bekommt ihn nicht.

Für die Entwicklung (Node 20 oder neuer):

```bash
cd leoiot-pv/kiosk
npm ci
npm run dev
```

Die Tests laufen mit `npm test`. Wie der Kiosk ohne Datenquelle mit Beispieldaten (Mock-Modus, `KIOSK_MOCK`) gestartet wird, steht in `leoiot-pv/kiosk/README.md`.

## Benötigte Dateien und Variablen

| Name | Wo | Bedeutung |
|---|---|---|
| `leoiot-platform/broker/mosquitto.conf` | im Repository | Listener 1883 nur mit Zugang (`pwfile`, `acl`); Listener 9001 (WebSocket) anonym und nur lesend auf `leoiot/room-climate/#` (`acl-websocket`) |
| `leoiot-platform/broker/pwfile` | **nicht** im Repository (`.gitignore`) | Passwortdatei des Brokers |
| `leoiot-platform/broker/acl` | **nicht** im Repository (`.gitignore`) | Zugriffsregeln der Zugänge; Aufbau in `acl.example` |
| `legacy/telegraf.conf` | im Repository | MQTT-Zugang (Benutzername/Passwort) und InfluxDB-Token; die Werte werden aus Sicherheitsgründen nicht genannt |
| `MQTT_HOST` | Compose-Umgebung von `quarkus-app`, `fake-sensors`, `mqtt-ws-bridge` | Hostname des Brokers (im Compose-Netz `mosquitto`) |
| `MQTT_PORT`, `UPDATE_INTERVAL` | optional, `fake-sensors` | Broker-Port (Standard 1883), Publish-Intervall in ms (Standard 10000) |
| `WS_PORT` | `mqtt-ws-bridge` | Port der WebSocket-Bridge (in Compose 8090) |
| `PV_MQTT_HOST`, `PV_MQTT_PORT`, `PV_MQTT_USER`, `PV_MQTT_PASS` | `mqtt-ws-bridge` | Zugang zu einem externen MQTT-Broker (Photovoltaik) |
| `COLLECTOR_SOLAX_CLIENT_ID`, `COLLECTOR_SOLAX_CLIENT_SECRET`, `COLLECTOR_SOLAX_USERNAME`, `COLLECTOR_SOLAX_PASSWORD`, `COLLECTOR_SOLAX_PLANT_ID`, `COLLECTOR_INFLUX_TOKEN`, `COLLECTOR_MQTT_USER`, `COLLECTOR_MQTT_PASSWORD` | `leoiot-pv/.env`, Dienst `collector` (nur mit Profil `collector`) | Pflicht: Solax-Zugang, InfluxDB-Schreibtoken, MQTT-Zugang; optional unter anderem `COLLECTOR_INFLUX_BUCKET`, `COLLECTOR_PUBLISH`; Details in `leoiot-pv/collector/README.md` |
| `DOCKER_INFLUXDB_INIT_*` | `influxdb` | Initiales Setup (Modus, Benutzer, Passwort, Organisation, Bucket, Admin-Token) |

:::caution[Zugangsdaten]
Zu Zugangsdaten und Tokens im Repository siehe [Betrieb](../operations/), Abschnitt „Bekannte Einschränkungen“.
:::

## Fehlende `leoiot-platform/broker/pwfile` oder `acl`

Auf Port 1883 lässt Mosquitto nur angemeldete Benutzer zu. Dafür braucht es eine Passwortdatei (`leoiot-platform/broker/pwfile`, im Container `/mosquitto/config/pwfile`) und die Zugriffsregeln der Zugänge (`leoiot-platform/broker/acl`). Beide stehen aus Sicherheitsgründen in `.gitignore` und fehlen daher nach einem frischen Clone (Download des Projekts); im Repository liegen `mosquitto.conf`, `acl-websocket` und das Beispiel `acl.example`. Das Verzeichnis `leoiot-platform/broker/` wird nur lesend als Volume (gemeinsamer Ordner mit dem Container) eingebunden, deshalb müssen beide Dateien für alle lesbar sein (`chmod 644`).

Die Datei wird mit dem Mosquitto-Werkzeug `mosquitto_passwd` erzeugt. Prinzip (Platzhalter, keine realen Werte):

```bash
# im Ordner leoiot-platform/: Datei anlegen, ersten Benutzer eintragen (Passwortabfrage)
docker run --rm -it -v "$PWD/broker:/mosquitto/config" eclipse-mosquitto:2.0.22 \
  mosquitto_passwd -c /mosquitto/config/pwfile <BENUTZER>

# im Ordner leoiot-platform/: weiteren Benutzer ergänzen (ohne -c, sonst wird die Datei überschrieben)
docker run --rm -it -v "$PWD/broker:/mosquitto/config" eclipse-mosquitto:2.0.22 \
  mosquitto_passwd /mosquitto/config/pwfile <WEITERER_BENUTZER>
```

Die verwendeten Benutzer/Passwörter müssen zu den Clients passen: Telegraf, `fake-sensors` und das Backend (`quarkus-app`) melden sich mit Benutzername und Passwort am Broker an (Konfiguration in `legacy/telegraf.conf`, `legacy/fake-sensors/index.js` bzw. der Backend-`application.properties`). Danach `broker/acl.example` nach `broker/acl` kopieren und jedem Zugang einen Block geben; ein Zugang ohne Block kann sich verbinden, aber weder senden noch abonnieren. Mehr in `leoiot-platform/README.md`.

## Fake-Sensoren zum Testen

Der Dienst `fake-sensors` startet mit `docker compose up -d` automatisch. Einzeln (im Ordner `legacy/`):

```bash
docker compose up -d fake-sensors
```

Er veröffentlicht simulierte Temperatur- und CO₂-Werte für 117 Räume (Konfiguration `roomsConfig` in `legacy/fake-sensors/index.js`; Intervall standardmäßig 10 s, `UPDATE_INTERVAL`):

| Messwert | Topic | Format |
|---|---|---|
| Temperatur | `room-temperature` | JSON, z. B. `{"room": "105", "temperature": 21.5}` |
| CO₂ | `nili3/sensor/{room_id}_co2/state` | einfache Zahl in ppm |

Standalone (gegen einen Broker auf `localhost:1883`): `cd legacy/fake-sensors && npm install && npm start`; anderer Broker über `MQTT_HOST`.

## Lokale Entwicklung der Frontends

Beide Frontends im Ordner `legacy/` nutzen Vite (Entwicklungsserver und Build-Werkzeug für Web-Oberflächen). Skripte laut `package.json`; der Hauptkiosk steht im Abschnitt [Hauptkiosk](#hauptkiosk):

| Projekt | `npm run dev` | Port |
|---|---|---|
| `legacy/frontend` | `vite` | Standard von Vite; in Compose per `--port 8080` |
| `legacy/dashboard-v2` | `vite --port 8081` | 8081 |

Beide kennen außerdem `npm run build` (`vite build`) und `npm run preview`; im Compose-Betrieb wird der Build nicht verwendet, dort laufen die Dev-Server mit `--host 0.0.0.0`. `frontend` hängt von `three` ab, `dashboard-v2` hat nur Vite als Abhängigkeit.

```bash
cd legacy/dashboard-v2
npm install
npm run dev
```

## Quellen im Repository

- `legacy/docker-compose.yaml`
- `leoiot-platform/compose.yaml`, `leoiot-platform/broker/` (`mosquitto.conf`, `acl-websocket`, `acl.example`, `.gitignore`), `leoiot-platform/README.md`
- `legacy/telegraf.conf`
- `legacy/fake-sensors/index.js`
- `legacy/backend/sensor-data-generator/src/main/resources/application.properties`
- `legacy/frontend/package.json`, `legacy/dashboard-v2/package.json`
- `leoiot-pv/compose.yaml`, `leoiot-pv/.env.example`, `leoiot-pv/kiosk/package.json`, `leoiot-pv/kiosk/README.md`
