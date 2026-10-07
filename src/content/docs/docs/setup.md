---
title: Einrichtung
description: Voraussetzungen, Start mit Docker Compose, Ports, benötigte Dateien und lokale Entwicklung der LeoIoT-Dienste.
sidebar:
  order: 30
---

Diese Seite beschreibt, wie das Gesamtsystem lokal gestartet wird. Docker Compose (Werkzeug zum gemeinsamen Starten mehrerer Container) startet alle Dienste mit einem Befehl.

## Voraussetzungen

- Docker mit dem Compose-Plugin (der Start erfolgt über `docker compose`).
- Die Node-Dienste (JavaScript-Programme) laufen im Container (`node:20-alpine`) und installieren ihre Bibliotheken beim Start selbst (`npm install`). Node muss daher nicht auf dem eigenen Rechner installiert sein.
- Der Dienst `quarkus-app` wird aus `backend/sensor-data-generator` per Dockerfile gebaut (`src/main/docker/Dockerfile`).
- Für den Dienst `mosquitto` muss die Datei `config/pwfile` existieren (siehe unten).

## Start

```bash
# im Repository-Root (Hauptordner des Projekts)
docker compose up -d
```

Ohne `-d` laufen die Logs im Vordergrund. Logs einzelner Dienste: `docker compose logs -f dashboard-v2`, Stoppen: `docker compose down`.

Compose startet folgende Dienste (alle im Netzwerk `leoiot`):

| Dienst | Image / Quelle | Zweck |
|---|---|---|
| `mosquitto` | `eclipse-mosquitto:latest` | MQTT-Broker (Nachrichten-Vermittler) |
| `influxdb` | `influxdb:2.7` | Zeitreihendatenbank (Setup-Modus beim ersten Start) |
| `telegraf` | `telegraf:latest` | liest MQTT-Topics und schreibt nach InfluxDB (`telegraf.conf`) |
| `grafana` | `grafana/grafana:latest` | Dashboards (Provisioning aus `grafana/`) |
| `quarkus-app` | Build aus `backend/sensor-data-generator` | Sensordaten-Generator (publiziert u. a. `sine`, `room-temperature`) |
| `frontend` | `node:20-alpine`, `./frontend` | 3D-Explorer (Vite-Dev-Server) |
| `dashboard-v2` | `node:20-alpine`, `./dashboard-v2` | Dashboard (Raumklima und PV, Vite-Dev-Server) |
| `kiosk`, `kiosk2`, `kiosk3`, `kiosk4` | `node:20-alpine`, jeweils eigenes Verzeichnis | Kiosk-Anzeigen (Vite-Dev-Server) |
| `leogreen-kiosk` | `node:20-alpine`, `./leogreenKiosk` | LeoGreen-Kiosk |
| `mqtt-ws-bridge` | `node:20-alpine`, `./mqtt-ws-bridge` | Bridge: gibt MQTT-Messwerte per WebSocket an den Browser weiter |
| `solax-collector` | `node:20-alpine`, `./solax-collector` | holt Solax-Daten, schreibt sie nach InfluxDB und veröffentlicht sie per MQTT |
| `fake-sensors` | `node:20-alpine`, `./fake-sensors` | simulierte Sensoren zum Testen |

## Ports

| Port | Dienst |
|---|---|
| 1883 | Mosquitto (MQTT) |
| 8086 | InfluxDB |
| 3000 | Grafana |
| 8080 | `frontend` (3D-Explorer) |
| 8081 | `dashboard-v2` |
| 8082 / 8083 / 8084 / 8085 | `kiosk` / `kiosk2` / `kiosk3` / `kiosk4` |
| 8087 | `leogreen-kiosk` |
| 8090 | `mqtt-ws-bridge` (WebSocket) |

`quarkus-app`, `telegraf`, `fake-sensors` und `solax-collector` veröffentlichen keine Ports.

## Benötigte Dateien und Variablen

| Name | Wo | Bedeutung |
|---|---|---|
| `config/mosquitto.conf` | im Repository | Listener 1883, `allow_anonymous false`, `password_file /mosquitto/config/pwfile` |
| `config/pwfile` | **nicht** im Repository (`.gitignore`) | Passwortdatei des Brokers |
| `telegraf.conf` | im Repository | MQTT-Zugang (Benutzername/Passwort) und InfluxDB-Token; die Werte werden aus Sicherheitsgründen nicht genannt |
| `MQTT_HOST` | Compose-Umgebung von `quarkus-app`, `fake-sensors`, `mqtt-ws-bridge` | Hostname des Brokers (im Compose-Netz `mosquitto`) |
| `MQTT_PORT`, `UPDATE_INTERVAL` | optional, `fake-sensors` | Broker-Port (Standard 1883), Publish-Intervall in ms (Standard 10000) |
| `WS_PORT` | `mqtt-ws-bridge` | Port der WebSocket-Bridge (in Compose 8090) |
| `PV_MQTT_HOST`, `PV_MQTT_PORT`, `PV_MQTT_USER`, `PV_MQTT_PASS` | `mqtt-ws-bridge` | Zugang zu einem externen MQTT-Broker (Photovoltaik) |
| `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET` | `solax-collector` | InfluxDB-Zugang |
| `DOCKER_INFLUXDB_INIT_*` | `influxdb` | Initiales Setup (Modus, Benutzer, Passwort, Organisation, Bucket, Admin-Token) |

:::caution[Zugangsdaten]
Zu Zugangsdaten und Tokens im Repository siehe [Betrieb](../operations/), Abschnitt „Bekannte Einschränkungen“.
:::

## Fehlende `config/pwfile`

Mosquitto lässt nur angemeldete Benutzer zu. Dafür braucht es eine Passwortdatei (`config/pwfile`, im Container `/mosquitto/config/pwfile`). Sie steht aus Sicherheitsgründen in `.gitignore` und fehlt daher nach einem frischen Clone (Download des Projekts); im Repository liegt nur `config/mosquitto.conf`. Das Verzeichnis `config/` wird als Volume (gemeinsamer Ordner mit dem Container) eingebunden.

Die Datei wird mit dem Mosquitto-Werkzeug `mosquitto_passwd` erzeugt. Prinzip (Platzhalter, keine realen Werte):

```bash
# Datei anlegen, ersten Benutzer eintragen (Passwortabfrage)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd -c /mosquitto/config/pwfile <BENUTZER>

# weiteren Benutzer ergänzen (ohne -c, sonst wird die Datei überschrieben)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd /mosquitto/config/pwfile <WEITERER_BENUTZER>
```

Die verwendeten Benutzer/Passwörter müssen zu den Clients passen: Telegraf, `fake-sensors` und das Backend (`quarkus-app`) melden sich mit Benutzername und Passwort am Broker an (Konfiguration in `telegraf.conf`, `fake-sensors/index.js` bzw. der Backend-`application.properties`).

## Fake-Sensoren zum Testen

Der Dienst `fake-sensors` startet mit `docker compose up -d` automatisch. Einzeln:

```bash
docker compose up -d fake-sensors
```

Er veröffentlicht simulierte Temperatur- und CO₂-Werte für 117 Räume (Konfiguration `roomsConfig` in `fake-sensors/index.js`; Intervall standardmäßig 10 s, `UPDATE_INTERVAL`):

| Messwert | Topic | Format |
|---|---|---|
| Temperatur | `room-temperature` | JSON, z. B. `{"room": "105", "temperature": 21.5}` |
| CO₂ | `nili3/sensor/{room_id}_co2/state` | einfache Zahl in ppm |

Standalone (gegen einen Broker auf `localhost:1883`): `cd fake-sensors && npm install && npm start`; anderer Broker über `MQTT_HOST`.

## Lokale Entwicklung der Frontends

Alle sieben Frontends nutzen Vite (Entwicklungsserver und Build-Werkzeug für Web-Oberflächen). Skripte laut `package.json`:

| Projekt | `npm run dev` | Port |
|---|---|---|
| `frontend` | `vite` | Standard von Vite; in Compose per `--port 8080` |
| `dashboard-v2` | `vite --port 8081` | 8081 |
| `kiosk` | `vite --port 8082` | 8082 |
| `kiosk2` | `vite --port 8083` | 8083 |
| `kiosk3` | `vite --port 8084` | 8084 |
| `kiosk4` | `vite --port 8085` | 8085 |
| `leogreenKiosk` | `vite --port 8087` | 8087 |

Alle sieben kennen außerdem `npm run build` (`vite build`) und `npm run preview`; im Compose-Betrieb wird der Build nicht verwendet, dort laufen die Dev-Server mit `--host 0.0.0.0`. `frontend` hängt von `three` ab, die übrigen haben nur Vite als Abhängigkeit.

```bash
cd dashboard-v2
npm install
npm run dev
```

## Quellen im Repository

- `docker-compose.yaml`
- `config/mosquitto.conf`, `.gitignore`
- `telegraf.conf`
- `fake-sensors/index.js`
- `backend/sensor-data-generator/src/main/resources/application.properties`
- `frontend/package.json`, `dashboard-v2/package.json`, `leogreenKiosk/package.json`
