---
title: Setup
description: Voraussetzungen, Start mit Docker Compose, Ports, benötigte Dateien und lokale Entwicklung der LeoIoT-Dienste.
sidebar:
  order: 30
---

Diese Seite beschreibt, wie das Gesamtsystem lokal gestartet wird. Alle Angaben stammen aus `docker-compose.yaml`, `config/` und den `package.json`-Dateien.

## Voraussetzungen

- Docker mit dem Compose-Plugin (der Start erfolgt über `docker compose`).
- Die Node-basierten Dienste laufen im Container (`node:20-alpine`) und führen beim Start selbst `npm install` aus; eine lokale Node-Installation ist für den Compose-Betrieb nicht nötig.
- Der Dienst `quarkus-app` wird aus `backend/sensor-data-generator` per Dockerfile gebaut (`src/main/docker/Dockerfile`).
- Für den Dienst `mosquitto` muss die Datei `config/pwfile` existieren (siehe unten).

## Start

```bash
# im Repository-Root
docker compose up -d
```

Ohne `-d` laufen die Logs im Vordergrund. Logs einzelner Dienste: `docker compose logs -f dashboard-v2`, Stoppen: `docker compose down`.

Compose startet folgende Dienste (alle im Netzwerk `leoiot`):

| Dienst | Image / Quelle | Zweck |
|---|---|---|
| `mosquitto` | `eclipse-mosquitto:latest` | MQTT-Broker |
| `influxdb` | `influxdb:2.7` | Zeitreihendatenbank (Setup-Modus beim ersten Start) |
| `telegraf` | `telegraf:latest` | liest MQTT-Topics und schreibt nach InfluxDB (`telegraf.conf`) |
| `grafana` | `grafana/grafana:latest` | Dashboards (Provisioning aus `grafana/`) |
| `quarkus-app` | Build aus `backend/sensor-data-generator` | Sensordaten-Generator (publiziert u. a. `sine`, `room-temperature`) |
| `frontend` | `node:20-alpine`, `./frontend` | 3D-Gebäudeansicht (Vite-Dev-Server) |
| `dashboard-v2` | `node:20-alpine`, `./dashboard-v2` | Sensor-Dashboard (Vite-Dev-Server) |
| `kiosk`, `kiosk2`, `kiosk3`, `kiosk4` | `node:20-alpine`, jeweils eigenes Verzeichnis | Kiosk-Ansichten (Vite-Dev-Server) |
| `leogreen-kiosk` | `node:20-alpine`, `./leogreenKiosk` | LeoGreen-Kiosk |
| `mqtt-ws-bridge` | `node:20-alpine`, `./mqtt-ws-bridge` | WebSocket-Brücke zu MQTT |
| `solax-collector` | `node:20-alpine`, `./solax-collector` | schreibt Solax-Daten nach InfluxDB |
| `fake-sensors` | `node:20-alpine`, `./fake-sensors` | simulierte Sensoren zum Testen |

## Ports

| Port | Dienst |
|---|---|
| 1883 | Mosquitto (MQTT) |
| 8086 | InfluxDB |
| 3000 | Grafana |
| 8080 | `frontend` (3D-Ansicht) |
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
| `telegraf.conf` | im Repository | MQTT-Zugang (Benutzername/Passwort) und InfluxDB-Token; Werte hier bewusst nicht aufgeführt |
| `MQTT_HOST` | Compose-Umgebung von `quarkus-app`, `fake-sensors`, `mqtt-ws-bridge` | Hostname des Brokers (im Compose-Netz `mosquitto`) |
| `MQTT_PORT`, `UPDATE_INTERVAL` | optional, `fake-sensors` | Broker-Port (Standard 1883), Publish-Intervall in ms (Standard 10000) |
| `WS_PORT` | `mqtt-ws-bridge` | Port der WebSocket-Brücke (in Compose 8090) |
| `PV_MQTT_HOST`, `PV_MQTT_PORT`, `PV_MQTT_USER`, `PV_MQTT_PASS` | `mqtt-ws-bridge` | Zugang zu einem externen MQTT-Broker (Photovoltaik) |
| `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET` | `solax-collector` | InfluxDB-Zugang |
| `DOCKER_INFLUXDB_INIT_*` | `influxdb` | Initiales Setup (Modus, Benutzer, Passwort, Organisation, Bucket, Admin-Token) |

:::danger[Geheimnisse im Repository]
`docker-compose.yaml`, `backup/*.sh`, `telegraf.conf` und die Anwendungskonfiguration des Backends enthalten Zugangsdaten und Tokens im Klartext. Diese Doku nennt sie bewusst nicht. Für einen öffentlichen Betrieb sollten sie ausgelagert und rotiert werden.
:::

## Fehlende `config/pwfile`

Die Broker-Konfiguration verbietet anonyme Verbindungen und verweist auf `/mosquitto/config/pwfile`. Das Verzeichnis `config/` wird per Volume nach `/mosquitto/config` gemountet; die Datei `config/pwfile` steht in `.gitignore` und fehlt daher nach einem frischen Clone. Im Repository liegt nur `config/mosquitto.conf`.

Die Datei wird mit dem Mosquitto-Werkzeug `mosquitto_passwd` erzeugt. Prinzip (Platzhalter, keine realen Werte):

```bash
# Datei neu anlegen und ersten Benutzer eintragen (fragt das Passwort ab)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd -c /mosquitto/config/pwfile <BENUTZER>

# weiteren Benutzer ergänzen (ohne -c, sonst wird die Datei überschrieben)
docker run --rm -it -v "$PWD/config:/mosquitto/config" eclipse-mosquitto:latest \
  mosquitto_passwd /mosquitto/config/pwfile <WEITERER_BENUTZER>
```

Die verwendeten Benutzer/Passwörter müssen zu den Clients passen: Telegraf, `fake-sensors` und das Backend (`quarkus-app`) melden sich mit Benutzername und Passwort am Broker an (Konfiguration in `telegraf.conf`, `fake-sensors/index.js` bzw. der Backend-`application.properties`). Welche Zugangsdaten das sind, steht dort.

Die Benutzer werden mit `mosquitto_passwd` angelegt (so auch im Produktivsystem).

## Fake-Sensoren zum Testen

Der Dienst `fake-sensors` startet mit `docker compose up -d` automatisch. Einzeln:

```bash
docker compose up -d fake-sensors
```

Er veröffentlicht simulierte Temperatur- und CO2-Werte (Intervall standardmäßig 10 s, `UPDATE_INTERVAL`):

| Messwert | Topic | Format |
|---|---|---|
| Temperatur | `room-temperature` | JSON, z. B. `{"room": "105", "temperature": 21.5}` |
| CO2 | `nili3/sensor/{room_id}_co2/state` | einfache Zahl in ppm |

Standalone (gegen einen Broker auf `localhost:1883`): `cd fake-sensors && npm install && npm start`; anderer Broker über `MQTT_HOST`.

:::note
Das README nennt 7 Räume; `index.js` konfiguriert 117 Räume und ist maßgeblich.
:::

## Lokale Entwicklung der Frontends

Alle Frontends nutzen Vite. Skripte laut `package.json`:

| Projekt | `npm run dev` | Port |
|---|---|---|
| `frontend` | `vite` | Standard von Vite; in Compose per `--port 8080` |
| `dashboard-v2` | `vite --port 8081` | 8081 |
| `leogreenKiosk` | `vite --port 8087` | 8087 |

Alle drei kennen außerdem `npm run build` (`vite build`) und `npm run preview`. Im Compose-Betrieb laufen die Dev-Server mit `--host 0.0.0.0`. `frontend` hängt von `three` ab, die übrigen beiden haben nur Vite als Abhängigkeit.

```bash
cd dashboard-v2
npm install
npm run dev
```

Backend lokal (aus der veralteten `backend/guide-sine-generator.adoc`, siehe unten): Mosquitto starten (`mosquitto -v -p 1883`), mit `mosquitto_sub -h localhost -t sine -v` mitlesen und Quarkus mit `mvn quarkus:dev` starten.

## Veraltete Anleitungen und Dateien

- `guide-sine-generator.adoc` ist veraltet: sie beschreibt anonymen Mosquitto-Betrieb, der Compose-Broker verbietet anonyme Verbindungen; ersetzt durch `fake-sensors`.
- `api/requests.http` ist ein veralteter Demo-Rest: das Backend bietet nur `/hello` und einen WebSocket, kein `/api/sensors`.

## Quellen im Repository

- `docker-compose.yaml`
- `config/mosquitto.conf`, `.gitignore`
- `telegraf.conf`
- `fake-sensors/README.md`, `fake-sensors/index.js`
- `backend/guide-sine-generator.adoc`, `backend/sensor-data-generator/src/main/resources/application.properties`
- `frontend/package.json`, `dashboard-v2/package.json`, `leogreenKiosk/package.json`
- `api/requests.http`, `README.adoc`
