---
title: Architektur
description: Überblick über die Datenpipeline von den Sensoren bis zu den Dashboards, mit Diensten, Ports und Rollen der Komponenten.
sidebar:
  order: 10
---

LeoIoT sammelt Raumklimadaten (Temperatur, CO₂) sowie Photovoltaik-Daten (Solax) und zeigt sie in mehreren Oberflächen an. Die Dienste des alten Stacks werden über `legacy/docker-compose.yaml` gestartet und laufen als Docker-Container (abgeschottete Programmpakete) im gemeinsamen Netzwerk `leoiot`. Der Hauptkiosk ist ein eigenes Compose-Projekt namens `leoiot-pv` (`leoiot-pv/compose.yaml`), das am Netz des alten Stacks hängt. Kurz zu den Begriffen: Solax ist der Hersteller des PV-Wechselrichters, ein Kiosk ist eine Vollbild-Anzeige ohne Bedienung.

## Pipeline im Überblick

1. **Quellen** senden Messwerte per MQTT an Mosquitto, den MQTT-Vermittler (Broker): die echten Sensorboxen (programmiert mit ESPHome), der Simulator `fake-sensors`, der Java-Generator `quarkus-app` und der `solax-collector` (PV-Daten).
2. **Telegraf** (ein Übertragungswerkzeug) hört bei Mosquitto auf bestimmte Themen (Topics) und speichert die Werte im InfluxDB-Bereich (Bucket) `server_data`.
3. Der `solax-collector` schreibt die PV-Kennzahlen zusätzlich direkt per HTTP in InfluxDB (Measurement `solax_stats`).
4. **Grafana** und die Web-Frontends lesen die Verlaufsdaten aus InfluxDB (mit Flux, der Abfragesprache von InfluxDB).
5. **Live-Weg:** Die `mqtt-ws-bridge` (eine Brücke zwischen MQTT und dem Browser) empfängt dieselben Messwerte von Mosquitto und schickt sie über einen WebSocket (eine dauerhaft offene Verbindung zum Browser) sofort weiter. Die PV-Live-Daten kommen zusätzlich von einem externen PV-Broker (siehe `mqtt-ws-bridge` unter „Rolle der Komponenten“).

![Architektur: Datenfluss von den Sensoren bis zu den Dashboards](../../../assets/diagrams/architecture.svg)

Das Diagramm zeigt den Hauptkiosk aus `leoiot-pv/` noch nicht.

:::note[Öffentliche Pfade]
Ein Reverse-Proxy (Nginx; ein Verteiler, der Anfragen an den richtigen Dienst leitet) macht alle Oberflächen unter einer gemeinsamen Domain erreichbar (Konfiguration: `legacy/deploy/nginx.conf`). Die Pfade stehen im Abschnitt [Nginx-Routing](../operations/#nginx-routing) der Seite Betrieb.
:::

## Dienste

Ports laut `legacy/docker-compose.yaml` (nach außen veröffentlichte Ports) und, für den Hauptkiosk, laut `leoiot-pv/compose.yaml`.

| Dienst | Port | Zweck |
|---|---|---|
| `mosquitto` | 1883 | MQTT-Broker (Eclipse Mosquitto), Zugriff nur mit Login (`allow_anonymous false`) |
| `influxdb` | 8086 | Zeitreihendatenbank InfluxDB 2.7, Organisation `leoiot`, Bucket `server_data` |
| `telegraf` | – | Überträgt MQTT-Nachrichten nach InfluxDB (kein veröffentlichter Port) |
| `grafana` | 3000 | Dashboards, Datenquelle und Dashboard werden aus `legacy/grafana/` provisioniert |
| `frontend` | 8080 | 3D-Explorer (Vite-Dev-Server) |
| `dashboard-v2` | 8081 | Dashboard v2 (Vite-Dev-Server) |
| `kiosk` | 8082 | abgelöst: frühere Kiosk-Variante (PV-Anzeige); Container läuft vorübergehend noch |
| `kiosk2` | 8083 | abgelöst: frühere Kiosk-Variante (PV-Anzeige); Container läuft vorübergehend noch |
| `kiosk3` | 8084 | abgelöst: frühere Kiosk-Variante (PV-Anzeige); Container läuft vorübergehend noch |
| `kiosk4` | 8085 | abgelöst: frühere Kiosk-Variante (PV-Anzeige); Container läuft vorübergehend noch |
| `leogreen-kiosk` | 8087 | abgelöst: früherer LeoGreen-Kiosk; Container läuft vorübergehend noch |
| `kiosk` (Projekt `leoiot-pv`) | 8088 | Hauptkiosk (PV-Anzeige) unter `/kiosk/`, nginx-Image, hört nur auf `127.0.0.1` |
| `mqtt-ws-bridge` | 8090 | Brücke zwischen MQTT und Browser (WebSocket-Server); gibt Live-Messwerte weiter |
| `fake-sensors` | – | Simulator für Raumtemperatur und CO₂ |
| `quarkus-app` | – | Java-Generator (Quarkus), veröffentlicht per MQTT |
| `solax-collector` | – | Holt PV-Daten aus der Solax-Cloud, schreibt nach InfluxDB und MQTT |

## Rolle der Komponenten

- **Mosquitto**: der zentrale MQTT-Broker, also die Vermittlungsstelle: Sensoren senden Nachrichten hin, andere Dienste holen sie ab. `legacy/config/mosquitto.conf` nimmt Verbindungen auf Port 1883 aus dem ganzen Netz an und verbietet anonyme Verbindungen.
- **Telegraf**: zwei MQTT-Consumer in `legacy/telegraf.conf`. Der erste liest die Topics `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` als Zahlenwert (`data_format = "value"`, Typ `float`). Der zweite liest `room-temperature` als JSON und legt den Wert unter dem Measurement `room_temperature` mit dem Tag `room` ab. Ausgabe: InfluxDB-Bucket `server_data`.
- **InfluxDB**: speichert alle Messwerte. Beim Start wird die Organisation `leoiot` und der Bucket `server_data` angelegt (`DOCKER_INFLUXDB_INIT_*`).
- **Grafana**: Datenquelle `InfluxDB-Flux` (Flux, Standard-Bucket `server_data`) und das Dashboard `legacy/grafana/dashboards/main-dashboard.json` werden beim Start geladen.
- **mqtt-ws-bridge** (`legacy/mqtt-ws-bridge/index.js`): verbindet sich mit Mosquitto, hält pro Raum den letzten Temperatur- und CO₂-Wert und schickt Änderungen an Browser, die den jeweiligen Raum abonniert haben. PV-Daten gehen an alle verbundenen Clients. Zusätzlich verbindet sich die Bridge per TLS mit einem externen PV-Broker (Host, Port, Benutzer und Passwort über `PV_MQTT_*`).
- **solax-collector** (`legacy/solax-collector/index.js`): fragt jede Minute die Solax-Cloud ab, schreibt die Kennzahlen als Measurement `solax_stats` in InfluxDB und veröffentlicht den Rohdatensatz auf dem Topic `leoenergy/solax_pv/overall_inverter` (retained, d. h. der Broker merkt sich den letzten Wert für neue Empfänger). Daneben existiert `legacy/solax-collector/backfill.js`, der in `legacy/docker-compose.yaml` nicht gestartet wird.
- **fake-sensors** (`legacy/fake-sensors/index.js`): simuliert 117 Räume (Konfiguration `roomsConfig`) mit Tagesgang und Belegung und veröffentlicht standardmäßig alle 10 Sekunden (`UPDATE_INTERVAL`).
- **quarkus-app** (`legacy/backend/sensor-data-generator`): Quarkus-Anwendung, deren `application.properties` die MQTT-Kanäle `sine` und `room-temperature` auf Mosquitto konfiguriert.
- **Frontends**: siehe nächster Abschnitt.

## Frontends und ihr Status

| Frontend | Verzeichnis | Datenquellen im Code |
|---|---|---|
| 3D-Explorer | `legacy/frontend/` (`logic.js`) | Three.js-Gebäudemodell; Raumwerte aus InfluxDB (`room_temperature`, `mqtt_consumer`) und live per WebSocket |
| Dashboard v2 | `legacy/dashboard-v2/` (`dashboard.js`) | InfluxDB über `/influx`, Live-Werte per WebSocket `/ws`, PV-Daten (Measurement `solax_stats` und direkter Abruf der Solax-Cloud über `/solax/`), Chart.js-Diagramme, Sprachumschaltung DE/EN |
| Hauptkiosk | `leoiot-pv/kiosk/` (Vite, TypeScript, Vitest) | PV-Anzeige unter `/kiosk/`: Abfragen per `POST /kiosk/api/query` an InfluxDB (der nginx des Kiosks setzt einen reinen Lese-Token, der Browser bekommt keinen) und Live-Werte per WebSocket `/kiosk/ws`, danach `/ws` |
| LeoGreen-Kiosk (abgelöst) | `legacy/leogreenKiosk/` (`kiosk.js`) | PV-Anzeige: Measurement `solax_stats` aus InfluxDB plus Live-PV per WebSocket |
| Kiosk-Varianten (abgelöst) | `legacy/kiosk/`, `legacy/kiosk2/`, `legacy/kiosk3/`, `legacy/kiosk4/` | PV-Anzeige (`solax_stats`); nur `legacy/kiosk/` nutzt zusätzlich den WebSocket |

Der 3D-Explorer (`frontend`) und das Dashboard v2 zeigen das Raumklima. Das Dashboard v2 enthält zusätzlich die PV-Ansicht und eine Raumtabelle mit Status. Produktiv gezeigt wird der Hauptkiosk aus `leoiot-pv/kiosk/` unter `/kiosk/`; er hängt am Netz des alten Stacks, der deshalb laufen muss. Die früheren Adressen `/leogreen/`, `/kiosk2/`, `/kiosk3/` und `/kiosk4/` leiten dorthin um. Die fünf früheren Kiosks (`kiosk` bis `kiosk4` und `leogreenKiosk`) sind abgelöst (Kiosk = Vollbild-Anzeige ohne Bedienung).

:::note[Betrieb]
Die Frontends des alten Stacks laufen als Vite-Dev-Server (`npm run dev`) in `node:20-alpine`-Containern; der Hauptkiosk läuft als gebautes Image. Deployment und weitere Einschränkungen stehen auf der Seite [Betrieb](../operations/).
:::

:::caution[Sicherheit]
Im Repository stehen an mehreren Stellen Zugangsdaten und ein InfluxDB-Token als Standardwerte im Quellcode (zum Beispiel in `legacy/docker-compose.yaml`, `legacy/mqtt-ws-bridge/index.js`, `legacy/solax-collector/index.js` und in den Frontends). Diese Werte werden hier bewusst nicht wiedergegeben; sie sollten aus dem Quellcode entfernt (z. B. in Umgebungsvariablen oder geheime Speicher) und durch neue Werte ersetzt werden. Weitere Hinweise: Seite [Betrieb](../operations/#bekannte-einschränkungen).
:::

## Quellen im Repository

- `legacy/docker-compose.yaml`
- `legacy/telegraf.conf`
- `legacy/config/mosquitto.conf`
- `legacy/mqtt-ws-bridge/index.js`
- `legacy/solax-collector/index.js`
- `legacy/fake-sensors/index.js`
- `legacy/backend/sensor-data-generator/src/main/resources/application.properties`
- `legacy/grafana/provisioning/`, `legacy/grafana/dashboards/main-dashboard.json`
- `legacy/deploy/nginx.conf`
- `leoiot-pv/kiosk/`, `leoiot-pv/compose.yaml`, `leoiot-pv/.env.example`
- `legacy/frontend/logic.js`, `legacy/dashboard-v2/dashboard.js`, `legacy/leogreenKiosk/kiosk.js`, `legacy/kiosk/kiosk.js`, `legacy/kiosk2/kiosk2.js`, `legacy/kiosk3/kiosk3.js`, `legacy/kiosk4/kiosk4.js`
