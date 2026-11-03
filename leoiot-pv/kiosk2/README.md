# Zweiter PV-Kiosk „Unser Sonnenjahr“

Vollbild-Film unter `/kiosk2/`, ohne Ton und ohne Bedienung, etwa 100 Sekunden in einer Schleife. Jeder Tag der letzten 365 Tage ist ein Bergrücken: links Morgen, rechts Abend, die Höhe ist die PV-Leistung. Spec: `openspec/changes/pv-sonnenjahr-kiosk/`.

## Voraussetzungen

Node 22, dann `npm ci`.

## Mit echten Messwerten ohne Datenbank

```
KIOSK2_FIXTURE=1 npm run dev
```

Danach `http://localhost:8093/kiosk2/?now=2026-11-03T13:30:00%2B01:00` öffnen. Die Antworten kommen aus `tests/fixtures/year.csv` (ein echtes Jahr, nur Zeit und Wert); `now` stellt die Uhr auf das Ende dieser Daten. `KIOSK2_FIXTURE=empty` liefert eine leere Antwort, `KIOSK2_FIXTURE=error` eine Datenquelle, die nicht antwortet.

Für Prüfbilder: `?t=29` zeichnet nur das Bild bei Sekunde 29 und hält an, `?audit=1` stellt den Ablauf ohne Bild bereit.

## Gegen einen lokalen Stack

Ohne `KIOSK2_FIXTURE` reicht der Server `/kiosk2/api/query` an die InfluxDB (`http://localhost:8086`) und `/kiosk2/ws` an die Bridge (`ws://localhost:8090`) weiter. Den Lese-Token liest er aus `.env.local` (nicht versioniert, eine Zeile `KIOSK2_INFLUX_TOKEN=`). Andere Ziele: `KIOSK2_INFLUX_URL`, `KIOSK2_WS_URL`.

## Tests und Build

```
npm test
npm run build
```

## Aufbau

- `src/core/`: reine Funktionen. `yearData.ts` macht aus den Ständen der Tagesproduktion die Landschaft, `facts.ts` rechnet besten Tag, Meilensteine, Zähler und CO₂, `film.ts` legt den Ablauf fest und liefert für jeden Zeitpunkt, was zu sehen ist, `moments.ts` die Texte, `sun.ts` Sonnenauf- und -untergang für Leonding.
- `src/data/`: Abfragen und Datenspeicher (Jahr beim Start, heute alle fünf Minuten, Gesamtertrag jede Minute, Live-Leistung).
- `src/scene/`: Three.js-Bild mit den Shadern des Lichts „Morgenglut“.
- `src/ui/`: Texte über dem Bild, Anpassung an langsame Geräte, nächtliches Neuladen um 03:30.
- `nginx/`, `Dockerfile`: Container auf Port 8093, der Token bleibt im Container.
