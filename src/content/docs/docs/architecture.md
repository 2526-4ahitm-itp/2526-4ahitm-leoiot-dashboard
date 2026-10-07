---
title: Architektur
description: Überblick über die Datenpipeline von den Sensoren bis zu den Dashboards, mit Diensten, Ports und Rollen der Komponenten.
sidebar:
  order: 10
---

LeoIoT sammelt Raumklima-Daten (Temperatur, CO₂) sowie Photovoltaik-Daten (Solax) und zeigt sie in mehreren Oberflächen an. Alle Dienste werden über `docker-compose.yaml` gestartet und teilen sich das Docker-Netzwerk `leoiot`.

## Pipeline im Überblick

1. **Quellen** veröffentlichen Messwerte per MQTT an Mosquitto: die echten Sensorboxen (ESPHome), der Simulator `fake-sensors`, der Java-Generator `quarkus-app` und der `solax-collector` (PV-Daten).
2. **Telegraf** abonniert bestimmte Topics bei Mosquitto und schreibt sie in den InfluxDB-Bucket `server_data`.
3. Der `solax-collector` schreibt die PV-Kennzahlen zusätzlich direkt per HTTP in InfluxDB (Measurement `solax_stats`).
4. **Grafana** und die Web-Frontends lesen die Verlaufsdaten aus InfluxDB (Flux-Abfragen).
5. **Live-Weg:** Die `mqtt-ws-bridge` abonniert dieselben Messwerte bei Mosquitto und leitet sie über einen WebSocket an die Browser weiter. Die PV-Live-Daten kommen zusätzlich von einem externen Broker (siehe unten).

![Architektur: Datenfluss von den Sensoren bis zu den Dashboards](../../../assets/diagrams/architecture.svg)

:::note
Der Reverse-Proxy `deploy/nginx.conf` veröffentlicht die Dienste unter einer gemeinsamen Domain: `/grafana/`, `/influx/`, `/ws` (WebSocket zur Bridge), `/dashboard/`, `/kiosk/`, `/kiosk2/` bis `/kiosk4/`, `/leogreen/`, `/solax/` (Proxy zur Solax-Cloud-API) und `/` (3D-Explorer, Port 8080).
:::

## Dienste

Ports laut `docker-compose.yaml` (nach außen veröffentlichte Ports).

| Dienst | Port | Zweck |
|---|---|---|
| `mosquitto` | 1883 | MQTT-Broker (Eclipse Mosquitto), Zugriff nur mit Login (`allow_anonymous false`) |
| `influxdb` | 8086 | Zeitreihendatenbank InfluxDB 2.7, Organisation `leoiot`, Bucket `server_data` |
| `telegraf` | - | Überträgt MQTT-Nachrichten nach InfluxDB (kein veröffentlichter Port) |
| `grafana` | 3000 | Dashboards, Datenquelle und Dashboard werden aus `grafana/` provisioniert |
| `frontend` | 8080 | 3D-Explorer (Vite-Dev-Server) |
| `dashboard-v2` | 8081 | Dashboard v2 (Vite-Dev-Server) |
| `kiosk` | 8082 | Kiosk-Variante (PV-Anzeige) |
| `kiosk2` | 8083 | Kiosk-Variante (PV-Anzeige) |
| `kiosk3` | 8084 | Kiosk-Variante (PV-Anzeige) |
| `kiosk4` | 8085 | Kiosk-Variante (PV-Anzeige) |
| `leogreen-kiosk` | 8087 | LeoGreen-Kiosk (PV-Anzeige mit Live-Daten über die Bridge) |
| `mqtt-ws-bridge` | 8090 | WebSocket-Server, der MQTT-Livewerte an Browser weitergibt |
| `fake-sensors` | - | Simulator für Raumtemperatur und CO₂ |
| `quarkus-app` | - | Java-Generator (Quarkus), veröffentlicht per MQTT |
| `solax-collector` | - | Holt PV-Daten aus der Solax-Cloud, schreibt nach InfluxDB und MQTT |

## Rolle der Komponenten

- **Mosquitto**: zentraler Broker. `config/mosquitto.conf` lauscht auf Port 1883 an allen Interfaces und verbietet anonyme Verbindungen.
- **Telegraf**: zwei MQTT-Consumer in `telegraf.conf`. Der erste liest die Topics `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` als Zahlenwert (`data_format = "value"`, Typ `float`). Der zweite liest `room-temperature` als JSON und legt den Wert unter dem Measurement `room_temperature` mit dem Tag `room` ab. Ausgabe: InfluxDB-Bucket `server_data`.
- **InfluxDB**: speichert alle Messwerte. Beim Start wird die Organisation `leoiot` und der Bucket `server_data` angelegt (`DOCKER_INFLUXDB_INIT_*`).
- **Grafana**: Datenquelle `InfluxDB-Flux` (Flux, Standard-Bucket `server_data`) und das Dashboard `grafana/dashboards/main-dashboard.json` werden beim Start geladen.
- **mqtt-ws-bridge** (`mqtt-ws-bridge/index.js`): verbindet sich mit Mosquitto, hält pro Raum den letzten Temperatur- und CO₂-Wert und schickt Änderungen an Browser, die den jeweiligen Raum abonniert haben. PV-Daten gehen an alle verbundenen Clients. Zusätzlich verbindet sich die Bridge per TLS mit einem externen PV-Broker (Host, Port, Benutzer und Passwort über `PV_MQTT_*`).
- **solax-collector** (`solax-collector/index.js`): fragt jede Minute die Solax-Cloud ab, schreibt die Kennzahlen als Measurement `solax_stats` in InfluxDB und veröffentlicht den Rohdatensatz auf `leoenergy/solax_pv/overall_inverter` (retained). Daneben existiert `solax-collector/backfill.js`, der in `docker-compose.yaml` nicht gestartet wird.
- **fake-sensors** (`fake-sensors/index.js`): simuliert über 100 Räume (Konfiguration `roomsConfig`) mit Tagesgang und Belegung und veröffentlicht standardmäßig alle 10 Sekunden (`UPDATE_INTERVAL`).
- **quarkus-app** (`backend/sensor-data-generator`): Quarkus-Anwendung, deren `application.properties` die MQTT-Kanäle `sine` und `room-temperature` auf Mosquitto konfiguriert.
- **Frontends**: siehe nächster Abschnitt.

## Frontends und welche aktuell sind

| Frontend | Verzeichnis | Datenquellen im Code |
|---|---|---|
| 3D-Explorer | `frontend/` (`logic.js`) | Three.js-Gebäudemodell; Raumwerte aus InfluxDB (`room_temperature`, `mqtt_consumer`) und live per WebSocket |
| Dashboard v2 | `dashboard-v2/` (`dashboard.js`) | InfluxDB über `/influx`, Live-Werte per WebSocket `/ws`, PV-Daten, Chart.js-Diagramme, Sprachumschaltung DE/EN |
| Kiosk (LeoGreen) | `leogreenKiosk/` (`kiosk.js`) | PV-Anzeige: Measurement `solax_stats` aus InfluxDB plus Live-PV per WebSocket |
| Kiosk-Varianten | `kiosk/`, `kiosk2/`, `kiosk3/`, `kiosk4/` | PV-Anzeige (`solax_stats`); nur `kiosk/` nutzt zusätzlich den WebSocket |

Was sich aus dem Code ableiten lässt: Der 3D-Explorer (`frontend`) und das Dashboard v2 sind die Raumklima-Oberflächen. Das Dashboard v2 enthält zusätzlich eine PV-Ansicht und eine Raumtabelle mit Status. Der LeoGreen-Kiosk ist die Variante, die in `docker-compose.yaml` ausdrücklich von der Bridge abhängt.

Produktiv gezeigt wird der LeoGreen-Kiosk; `kiosk` bis `kiosk4` sind Varianten bzw. veraltet.

:::note[Betrieb]
Die Frontends laufen im Betrieb als Vite-Dev-Server (`npm run dev`) in `node:20-alpine`-Containern; einen separaten Produktions-Build gibt es nicht. Bei jedem Push auf `main` startet `.github/workflows/deploy.yml` auf der Schul-VM `git pull` und `docker compose up -d --build`.
:::

:::caution[Sicherheit]
Im Repository stehen an mehreren Stellen Zugangsdaten und ein InfluxDB-Token als Standardwerte im Quellcode (zum Beispiel in `docker-compose.yaml`, `mqtt-ws-bridge/index.js`, `solax-collector/index.js` und in den Frontends). Diese Werte werden hier bewusst nicht wiedergegeben; sie sollten in Umgebungsvariablen bzw. Secrets ausgelagert und rotiert werden.
:::

## Quellen im Repository

- `docker-compose.yaml`
- `telegraf.conf`
- `config/mosquitto.conf`
- `mqtt-ws-bridge/index.js`
- `solax-collector/index.js`
- `fake-sensors/index.js`, `fake-sensors/README.md`
- `backend/sensor-data-generator/src/main/resources/application.properties`
- `grafana/provisioning/`, `grafana/dashboards/main-dashboard.json`
- `deploy/nginx.conf`
- `frontend/logic.js`, `dashboard-v2/dashboard.js`, `leogreenKiosk/kiosk.js`, `kiosk/kiosk.js`, `kiosk2/kiosk2.js`, `kiosk3/kiosk3.js`, `kiosk4/kiosk4.js`
