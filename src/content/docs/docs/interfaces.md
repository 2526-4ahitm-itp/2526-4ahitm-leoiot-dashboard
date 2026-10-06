---
title: Schnittstellen
description: MQTT-Topics und Payloads, WebSocket der Bridge, InfluxDB-Daten mit Flux-Beispiel, Grafana-Dashboard, Sensorbox und CO₂-Schwellenwerte.
sidebar:
  order: 20
---

Es gibt keine REST-API für Sensordaten. Daten laufen über MQTT, den WebSocket der Bridge und direkte Flux-Abfragen an InfluxDB.

## MQTT-Topics

Broker: Mosquitto, Port 1883, Anmeldung erforderlich (`config/mosquitto.conf`).

| Topic | Payload | Erzeuger | Beleg |
|---|---|---|---|
| `room-temperature` | JSON `{"room": "<Raum>", "temperature": <Zahl>}` | `fake-sensors` (QoS 1), Kanal `room-temperature-out` im `quarkus-app` | `fake-sensors/index.js`, `application.properties` |
| `nili3/sensor/<raum-kleingeschrieben>_co2/state` | Klartext-Zahl in ppm, z. B. `612.4` | `fake-sensors` (QoS 1) | `fake-sensors/index.js` |
| `nili3/sensor/nili3_co2/state`, `nili3/sensor/nili3_temperature/state` | Klartext-Zahl | echte Sensorbox `nili3` (ESPHome); Bridge und Grafana werten diese Topics aus | `mqtt-ws-bridge/index.js`, `grafana/dashboards/main-dashboard.json` |
| `leoenergy/solax_pv/overall_inverter` | JSON-Rohdatensatz der Solax-Cloud (`realtime_data`-Ergebnis), retained | `solax-collector` (und externer PV-Broker) | `solax-collector/index.js` |
| `sine` | vom Quarkus-Generator (Format nicht geprüft) | `quarkus-app` | `application.properties` |
| `co2/threshold/high`, `co2/threshold/middle` | Zahl (CO₂-Schwelle in ppm) | wird von der Sensorbox abonniert | `sensorbox/nili-ldr/nili-ldr.yaml` |

Beispiel-Raumzuordnung der Bridge: `nili3/sensor/105_co2/state` ergibt Raum `105`, `.../e10_co2/state` ergibt `E10`, `.../1aula_co2/state` ergibt `1Aula`; der Sensor `nili3` wird Raum `105` zugeordnet.

Telegraf (`telegraf.conf`) übernimmt:

- `nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#` als Zahlenwert (`data_format = "value"`, `float`). In den Flux-Abfragen der Frontends erscheinen diese als Measurement `mqtt_consumer` mit Tag `topic` und Feld `value`.
- `room-temperature` als JSON mit Tag `room`, umbenannt in das Measurement `room_temperature` (Feld `temperature`, wie in `frontend/logic.js` abgefragt).

:::note
Die Solax-Daten werden zusätzlich vom `solax-collector` direkt per HTTP in InfluxDB geschrieben (Measurement `solax_stats`, Tag `plant_id`, Felder `daily_yield`, `total_yield`, `consumption`, `daily_charged`, `daily_discharged`, `daily_imported`, `daily_exported`). Der Solax-Datensatz auf MQTT geht nicht über Telegraf.
:::

## WebSocket der Bridge

- Server: `mqtt-ws-bridge`, Port 8090 (Variable `WS_PORT`). Direkt erreichbar unter `ws://<Host>:8090`; hinter dem Reverse-Proxy unter dem Pfad `/ws` (`deploy/nginx.conf`). Die Frontends wählen lokal `:8090` und sonst `/ws` (`wss:` bei HTTPS).
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
- Die Frontends sprechen InfluxDB über den Pfad `/influx` an (`fetch` auf `/api/v2/query`, Content-Type `application/vnd.flux`).

Beispiel-Abfrage (CO₂-Verlauf eines Sensors; Token als Platzhalter):

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

`grafana/dashboards/main-dashboard.json` wird über `grafana/provisioning/dashboards` geladen (Ordner `Provisioned`). Es enthält ein Panel mit einer Flux-Abfrage auf `mqtt_consumer` für das Topic `nili3/sensor/nili3_co2/state`. Die Datenquelle `InfluxDB-Flux` steht in `grafana/provisioning/datasources`. Grafana ist über `/grafana/` erreichbar (`GF_SERVER_SERVE_FROM_SUB_PATH`).

## Sensorbox und ESPHome

Die Konfigurationen liegen unter `sensorbox/` und senden per MQTT (Broker-Zugang über ESPHome-`!secret`, nicht im Repository):

- `sensorbox/nili-ldr/nili-ldr.yaml` (Gerätename `nili3`): Temperatur, Luftdruck, Luftfeuchte (BME280), Helligkeit (ADC), CO₂ (MH-Z19, Sensor `nili3_CO2`), MH-Z19-Temperatur, Bewegung, WLAN-Signal. Die LED-Anzeige richtet sich nach den per MQTT empfangenen Schwellen `co2/threshold/middle` und `co2/threshold/high`. MQTT-Discovery ist abgeschaltet.
- `sensorbox/s3-mini-oled/s3_mini_oled.yaml` (Gerätename `s3_mini_sensorbox`): SCD41 (CO₂, Temperatur, Luftfeuchte), TSL2591 (Licht), LD2410 (Präsenz), Display, Buzzer, Hintergrundbeleuchtung.
- Weitere Varianten: `sensorbox/blinking-leds/blink.yaml`, `sensorbox/original-config/`.

:::caution[Offen]
Das exakte Topic-Schema der ESPHome-Geräte (Standard-Topic-Präfix) ist in den YAML-Dateien nicht ausdrücklich gesetzt. Dass `nili3/sensor/nili3_co2/state` von der Box stammt, folgt aus den Topics in Bridge und Grafana sowie dem Gerätenamen `nili3`. Die Werte der Schwellen `co2/threshold/*` sind im Repository nicht festgelegt.
:::

## CO₂-Schwellenwerte im Code

| Stelle | Werte |
|---|---|
| `dashboard-v2/dashboard.js` (Raumtabelle) | OK bis 800 ppm; "Mittel" über 800 bis 1000 ppm; "Alarm" über 1000 ppm. Temperatur außerhalb 19 bis 24 °C ergibt ebenfalls "Alarm". |
| `frontend/logic.js` (`getCO2Color`, 3D-Heatmap) | stufenloser Verlauf: 400 bis 800 ppm dunkelgrün zu hellgrün, 800 bis 1000 ppm gelb zu orange, ab 1000 ppm orange zu rot (voll rot bei 1700 ppm) |
| `dashboard-v2/dashboard.js` (CO₂-Diagramm) | Achsenvorschlag 400 bis 1200 ppm (keine Ampel) |

:::caution[Abweichung von der Spezifikation]
`docs/functional-specification.md` (FR-07, AC-04) fordert: grün unter 600 ppm, gelb von 600 bis 1200 ppm, rot über 1200 ppm. Der Code verwendet andere Werte (800 und 1000 ppm; in der 3D-Ansicht ein stufenloser Farbverlauf). Welche Werte gelten sollen, ist zu klären.
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
