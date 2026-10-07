---
title: Schnittstellen
description: MQTT-Topics und Payloads, WebSocket der Bridge, InfluxDB-Daten mit Flux-Beispiel, Grafana-Dashboard, Sensorbox und CO₂-Schwellenwerte.
sidebar:
  order: 20
---

Für Sensordaten gibt es keine klassische Web-Schnittstelle (REST-API). Die Daten laufen über MQTT, über den WebSocket der Bridge (das Programm `mqtt-ws-bridge`, die Messwerte aus MQTT an den Browser weitergibt) und über direkte Flux-Abfragen an InfluxDB (siehe [Architektur](../architecture/) für die Begriffe).

## MQTT-Topics

Broker: Mosquitto, Port 1883, Anmeldung erforderlich (`config/mosquitto.conf`).

Ein Topic ist der „Briefkasten“-Name einer MQTT-Nachricht, die Payload ihr Inhalt, QoS die Zustellgarantie (1 = mindestens einmal).

| Topic | Payload | Erzeuger | Beleg |
|---|---|---|---|
| `room-temperature` | JSON `{"room": "<Raum>", "temperature": <Zahl>}` | `fake-sensors` (QoS 1), Kanal `room-temperature-out` im `quarkus-app` | `fake-sensors/index.js`, `application.properties` |
| `nili3/sensor/<raum-kleingeschrieben>_co2/state` | Zahl als Text in ppm, z. B. `612.4` | `fake-sensors` (QoS 1) | `fake-sensors/index.js` |
| `nili3/sensor/nili3_co2/state`, `nili3/sensor/nili3_temperature/state` | Zahl als Text | echte Sensorbox `nili3` (ESPHome); Bridge und Grafana werten diese Topics aus | `mqtt-ws-bridge/index.js`, `grafana/dashboards/main-dashboard.json` |
| `leoenergy/solax_pv/overall_inverter` | JSON-Rohdatensatz der Solax-Cloud (`realtime_data`-Ergebnis), retained (der Broker merkt sich den letzten Wert für neue Empfänger) | `solax-collector` (und externer PV-Broker) | `solax-collector/index.js` |
| `sine` | vom Quarkus-Generator (Quarkus ist ein Java-Framework); Format hier nicht dokumentiert | `quarkus-app` | `application.properties` |
| `co2/threshold/high`, `co2/threshold/middle` | Zahl (CO₂-Schwelle in ppm) | wird von der Sensorbox abonniert | `sensorbox/nili-ldr/nili-ldr.yaml` |

Beispiel: Aus dem Topic `nili3/sensor/105_co2/state` erkennt die Bridge Raum `105`, aus `.../e10_co2/state` Raum `E10`, aus `.../1aula_co2/state` Raum `1Aula`. Die echte Sensorbox `nili3` gehört zu Raum `105`.

Telegraf (`telegraf.conf`) ist das Programm, das MQTT-Nachrichten in die Datenbank überträgt. Es übernimmt:

- `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` als Zahlenwert (`data_format = "value"`, `float`). In den Flux-Abfragen der Frontends erscheinen diese als Measurement `mqtt_consumer` mit Tag `topic` und Feld `value`.
- `room-temperature` als JSON mit Tag `room`, umbenannt in das Measurement `room_temperature` (Feld `temperature`, wie in `frontend/logic.js` abgefragt).

:::note
Die Solax-Daten werden zusätzlich vom `solax-collector` direkt per HTTP in InfluxDB geschrieben (Measurement `solax_stats`, Tag `plant_id`, Felder `daily_yield`, `total_yield`, `consumption`, `daily_charged`, `daily_discharged`, `daily_imported`, `daily_exported`). Der Solax-Datensatz auf MQTT geht nicht über Telegraf.
:::

## WebSocket der Bridge

Ein WebSocket ist eine Dauerverbindung zwischen Browser und Bridge; so erhält der Browser neue Werte sofort, ohne nachzufragen. Ein Snapshot ist der zuletzt bekannte Stand, den der Client beim Abonnieren sofort erhält.

- Server: `mqtt-ws-bridge`, Port 8090 (Variable `WS_PORT`). Direkt erreichbar unter `ws://<Host>:8090`; hinter dem Reverse-Proxy (Nginx, der alle Dienste unter einer Adresse bündelt) unter dem Pfad `/ws` (`deploy/nginx.conf`). Die Frontends wählen lokal `:8090` und sonst `/ws` (`wss:` bei HTTPS).
- Nachrichten sind JSON-Objekte.

Vom Client an den Server:

| Nachricht | Wirkung |
|---|---|
| `{"type":"subscribe","room":"105"}` | Raum abonnieren; Antwort `subscribed` und ein Snapshot der letzten Werte |
| `{"type":"unsubscribe","room":"105"}` | Abo beenden (Antwort `unsubscribed`) |
| `{"type":"unsubscribeAll"}` | alle Abos beenden (Antwort `unsubscribedAll`) |

Vom Server an den Client:

| Nachricht | Inhalt |
|---|---|
| `{"type":"hello","wsPort":8090}` | direkt nach dem Verbinden |
| `{"type":"temp","room":"105","value":21.2,"ts":<ms>}` | Temperatur; bei Snapshot zusätzlich `"snapshot":true` |
| `{"type":"co2","room":"105","value":640,"ts":<ms>}` | CO₂ in ppm; bei Snapshot zusätzlich `"snapshot":true` |
| `{"type":"pv","data":{...}}` | PV-Daten (Solax-Datensatz plus `_ts`); gehen ohne Abo an alle Clients, ein zwischengespeicherter Stand wird beim Verbinden gesendet |

`ts` ist der Zeitstempel (Millisekunden) beim Empfang in der Bridge, nicht beim Sensor.

## InfluxDB

- Organisation `leoiot`, Bucket `server_data` (`docker-compose.yaml`).
- Measurements, die im Code verwendet werden: `mqtt_consumer` (Tag `topic`, Feld `value`), `room_temperature` (Tag `room`, Feld `temperature`), `solax_stats` (siehe oben).
- Die Frontends fragen InfluxDB über den Pfad `/influx` ab (`/api/v2/query`). Flux ist die Abfragesprache von InfluxDB.

Das folgende Beispiel holt den CO₂-Verlauf eines Sensors der letzten 24 Stunden als 10-Minuten-Mittelwerte (Token als Platzhalter):

```bash
curl -s -X POST "http://<HOST>:8086/api/v2/query?org=leoiot" \
  -H "Authorization: Token <TOKEN>" \
  -H "Content-Type: application/vnd.flux" \
  -H "Accept: application/csv" \
  --data 'from(bucket: "server_data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "mqtt_consumer")
  |> filter(fn: (r) => r.topic == "nili3/sensor/nili3_co2/state")
  |> filter(fn: (r) => r._field == "value")
  |> aggregateWindow(every: 10m, fn: mean, createEmpty: false)'
```

## Grafana-Dashboard

Grafana ist ein Programm für Diagramme. Das Dashboard liegt als Datei `grafana/dashboards/main-dashboard.json` im Repository und wird beim Start automatisch geladen (Provisioning über `grafana/provisioning/dashboards`, Ordner `Provisioned`). Es enthält ein Panel mit einer Flux-Abfrage auf `mqtt_consumer` für das Topic `nili3/sensor/nili3_co2/state`. Die Datenquelle `InfluxDB-Flux` steht in `grafana/provisioning/datasources`. Grafana ist über `/grafana/` erreichbar (`GF_SERVER_SERVE_FROM_SUB_PATH`).

## Sensorbox und ESPHome

ESPHome ist eine Software, mit der die Sensorbox per Konfigurationsdatei programmiert wird. Die Kürzel (BME280, MH-Z19 usw.) sind die Typenbezeichnungen der verbauten Sensorchips.

Die Konfigurationen liegen unter `sensorbox/` und senden per MQTT (Broker-Zugang über ESPHome-`!secret`, nicht im Repository):

- `sensorbox/nili-ldr/nili-ldr.yaml` (Gerätename `nili3`): Temperatur, Luftdruck, Luftfeuchte (BME280), Helligkeit (ADC), CO₂ (MH-Z19, Sensor `nili3_CO2`), MH-Z19-Temperatur, Bewegung, WLAN-Signal. Die LED-Anzeige richtet sich nach den per MQTT empfangenen Schwellen `co2/threshold/middle` und `co2/threshold/high`. MQTT-Discovery ist abgeschaltet.
- `sensorbox/s3-mini-oled/s3_mini_oled.yaml` (Gerätename `s3_mini_sensorbox`): SCD41 (CO₂, Temperatur, Luftfeuchte), TSL2591 (Licht), LD2410 (Präsenz), Display, Buzzer, Hintergrundbeleuchtung.
- Weitere Varianten: `sensorbox/blinking-leds/blink.yaml`, `sensorbox/original-config/`.

## CO₂-Schwellenwerte im Code

| Stelle | Werte |
|---|---|
| `dashboard-v2/dashboard.js` (Raumtabelle) | OK bis 800 ppm; „Mittel“ über 800 bis 1000 ppm; „Alarm“ über 1000 ppm. Temperatur außerhalb von 19 bis 24 °C ergibt ebenfalls „Alarm“. |
| `frontend/logic.js` (`getCO2Color`, Heatmap im 3D-Modell) | stufenloser Verlauf: 400 bis 800 ppm dunkelgrün zu hellgrün, 800 bis 1000 ppm gelb zu orange, ab 1000 ppm orange zu rot (voll rot bei 1700 ppm) |
| `dashboard-v2/dashboard.js` (CO₂-Diagramm) | Achsenvorschlag 400 bis 1200 ppm (keine Ampel) |

:::note[Hinweis zu abweichenden Werten]
Im Code und in der Präsentation gelten 800 und 1000 ppm. Die funktionale Spezifikation (`docs/functional-specification.md`, FR-07, AC-04) nennt 600 und 1200 ppm; diese Werte sind nicht umgesetzt.
:::

## Quellen im Repository

- `docker-compose.yaml`, `telegraf.conf`, `config/mosquitto.conf`
- `mqtt-ws-bridge/index.js`
- `fake-sensors/index.js`
- `solax-collector/index.js`
- `backend/sensor-data-generator/src/main/resources/application.properties`
- `grafana/provisioning/`, `grafana/dashboards/main-dashboard.json`
- `deploy/nginx.conf`
- `frontend/logic.js`, `dashboard-v2/dashboard.js`, `leogreenKiosk/kiosk.js`
- `sensorbox/nili-ldr/nili-ldr.yaml`, `sensorbox/s3-mini-oled/s3_mini_oled.yaml`
- `docs/functional-specification.md`
