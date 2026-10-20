# LeoIoT Hauptkiosk

Vollbild-Anzeige der Energiedaten der Schule unter `/kiosk/`. Sie ist für einen großen Bildschirm gedacht.

## Voraussetzungen

Node 20 oder neuer, dann `npm install`.

## Starten mit Beispieldaten

```
KIOSK_MOCK=1 npm run dev
```

Danach `http://localhost:8088/kiosk/` öffnen. Varianten:

| Aufruf | Wirkung |
| --- | --- |
| `KIOSK_MOCK=1` | Beispieltag mit Live-Werten |
| `KIOSK_MOCK=1 KIOSK_MOCK_LIVE=0` | Beispieltag ohne Live-Werte |
| `KIOSK_MOCK=empty` | leere Antwort |
| `KIOSK_MOCK=error` | Datenquelle antwortet mit Fehler |
| `KIOSK_MOCK=stale` | jüngster Messwert ist 20 Minuten alt |

Beispieldaten gibt es nur im Entwicklungs-Server. Der gebaute Kiosk enthält sie nicht.

## Starten gegen einen lokalen Stack

Ohne `KIOSK_MOCK` reicht der Server `/kiosk/api/query` an die InfluxDB (`http://localhost:8086`) und `/kiosk/ws` an die Bridge (`ws://localhost:8090`) weiter. Den Token liest er aus der Datei `.env.local` (nicht versioniert). Sie enthält eine Zeile `KIOSK_INFLUX_TOKEN=` und dahinter den eigenen Lese-Token. Optional lassen sich die Ziele mit `KIOSK_INFLUX_URL` und `KIOSK_WS_URL` ändern.

## Starten im Container

Im Ordner `leoiot-pv/` `.env.example` nach `.env` kopieren, den Lese-Token eintragen und `docker compose up -d --build kiosk` ausführen. Das Image baut den Kiosk und liefert ihn mit nginx auf Port 8088 aus (`Dockerfile`, `nginx/kiosk.conf.template`). Der nginx reicht `POST /kiosk/api/query` an die InfluxDB weiter und setzt dabei den Token aus `KIOSK_INFLUX_TOKEN`; `/kiosk/ws` reicht er an die Bridge weiter. Der Browser bekommt den Token nie zu sehen.

Der Kiosk versucht den Live-Kanal zuerst unter `/kiosk/ws` und danach unter `/ws`, falls der vorgelagerte nginx des Hosts unter `/kiosk/` keine WebSockets weiterreicht.

## Tests und Build

- `npm test` führt die Tests aus.
- `npm run build` baut den Kiosk nach `dist/`.
- `npm run preview` zeigt den gebauten Stand. Auch hier wirkt `KIOSK_MOCK`.

## Aufbau

- `../shared/` (Paket `@leoiot-pv/shared`): reine Funktionen für Zeit, Energie, Format, InfluxDB und den Live-Kanal, gemeinsam mit dem Dashboard
- `src/data/`: Abruf, Zustand, Sicht
- `src/ui/`: Header, Theme, Farben, Feld-Zustände, nächtliches Neuladen
- `src/panels/`: die vier Felder, je ein Modell (reine Funktion) und die Darstellung
- `src/styles/`: Stile
- `dev/`: Mock-Modus
- `tests/`: Tests; die Beispielantworten der Datenbank liegen in `../shared/tests/fixtures/`

## Theme

`?theme=dark` oder `?theme=light` an die Adresse anhängen. Die Adresse hat Vorrang vor der gespeicherten Wahl des Schalters, Standard ist hell. Der Schalter Sonne/Mond erscheint nur, wenn die Maus bewegt wird oder der Tastaturfokus auf ihm liegt, und verschwindet fünf Sekunden nach der letzten Mausbewegung. Am TV ohne Maus wird das Theme über die Adresse gewählt.
