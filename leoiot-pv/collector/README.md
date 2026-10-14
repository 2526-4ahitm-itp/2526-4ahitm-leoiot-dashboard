# LeoIoT PV-Collector

Holt jede Minute die Tageswerte der PV-Anlage aus der SolaX-Cloud, schreibt sie als Messung `solax_stats` in die InfluxDB und veröffentlicht die vollständige Cloud-Antwort retained auf dem Thema `leoenergy/solax_pv/overall_inverter`. Format und Felder legt der Datenvertrag (`platform/data-contract`) fest.

Der Dienst läuft weiter, wenn Cloud, Datenbank oder Broker ausfallen: jeder Fehler wird geloggt, der Zyklus entfällt, in der nächsten Minute geht es weiter. Eine abgelehnte Sitzung führt zur neuen Anmeldung.

## Variablen

Alle Einstellungen kommen aus der Umgebung. Fehlt eine Pflichtvariable, beendet sich der Dienst sofort mit Exit-Code 1 und nennt sie.

| Variable | Pflicht | Standard |
| --- | --- | --- |
| `COLLECTOR_SOLAX_CLIENT_ID`, `COLLECTOR_SOLAX_CLIENT_SECRET` | ja | |
| `COLLECTOR_SOLAX_USERNAME`, `COLLECTOR_SOLAX_PASSWORD` | ja | |
| `COLLECTOR_SOLAX_PLANT_ID` | ja | |
| `COLLECTOR_INFLUX_TOKEN` | ja (nur Schreibrecht) | |
| `COLLECTOR_MQTT_USER`, `COLLECTOR_MQTT_PASSWORD` | ja | |
| `COLLECTOR_INFLUX_BUCKET` | nein | `pv_shadow` |
| `COLLECTOR_PUBLISH` | nein | aus; nur `1` oder `true` schaltet ein |
| `COLLECTOR_INFLUX_URL` | nein | `http://influxdb:8086` |
| `COLLECTOR_INFLUX_ORG` | nein | `leoiot` |
| `COLLECTOR_MQTT_URL` | nein | `mqtt://mosquitto:1883` |
| `COLLECTOR_SOLAX_BASE_URL` | nein | Adresse der EU-Cloud von SolaX |
| `COLLECTOR_INTERVAL_MS` | nein | `60000` |
| `COLLECTOR_HEALTH_FILE` | nein | `/tmp/collector-last-delivery` |

Mit den Standardwerten schreibt der Dienst in den Testbucket und veröffentlicht nichts. Für den Betrieb müssen Bucket und Veröffentlichen ausdrücklich gesetzt werden.

## Tests

```
npm ci
npm test
npm run build
```

Die Tests laufen gegen lokale Fake-Server für Cloud und Datenbank, einen Fake-MQTT-Client und eine Fake-Uhr. Sie brauchen kein Netz.

## Container

Im Ordner `leoiot-pv/` `.env.example` nach `.env` kopieren, ausfüllen und `docker compose up -d --build collector` ausführen. Das Image ist mehrstufig, läuft als Benutzer `node` und startet das übersetzte Programm.

## Gesundheit

Nach jeder gespeicherten Lesung schreibt der Dienst den Zeitpunkt (Millisekunden seit Epoche) in die Datei `COLLECTOR_HEALTH_FILE`. Der Healthcheck (`healthcheck.mjs`) meldet ungesund, wenn dieser Zeitpunkt älter als 5 Minuten ist oder die Datei nach der Startphase von zwei Minuten fehlt. Abfrage: `docker compose ps collector`.
