---
title: Projekt
description: Ausgangslage, Ziele, Lösung, Anforderungen, Team, Meilensteine und Sprint-Reviews von LeoIoT.
sidebar:
  order: 50
---

## Ausgangslage und Problem

Die HTL Leonding will eine nachhaltige Schule werden. Die PV-Anlage erzeugt Strom für die Schule, die Daten liegen aber nur im Hersteller-Portal (Solax Cloud) und sind für Schüler:innen und Lehrkräfte nicht sichtbar. In den Klassen sind bis zu 30 Personen pro Raum; bei geschlossenen Fenstern steigt der CO₂-Gehalt stark an, was zu Müdigkeit und Konzentrationsschwäche führt. Niemand sieht, wann gelüftet werden muss.

Das Problem im Einzelnen:

- Daten zu Energie und Raumluft sind verstreut oder nicht vorhanden.
- Es gibt keine zentrale, verständliche Übersicht für den Schulalltag.
- Schulwarte sehen die Raumtemperatur nicht, offen gelassene Fenster bleiben unbemerkt.
- Ausfälle von Sensoren bleiben unbemerkt.

## Ziele

- Raumklima und Energiedaten der Schule transparent machen.
- Raumbezogene Werte im Dashboard und im 3D-Modell anzeigen.
- Tagesbezogene Historie anzeigen.
- Bewusstsein für Luftqualität und Energieverbrauch fördern.

Nicht Teil des Projekts: automatisches Öffnen/Schließen von Fenstern oder Türen und andere Gebäudesteuerung.

## Lösung

- **PV-Dashboard:** Erzeugung, Netzbezug, Batterie-Ladung und -Entladung; Tagesansicht mit Datumswahl; Kiosk-Modus für Bildschirme im Schulhaus.
- **Sensor-Dashboard:** CO₂ und Temperatur pro Raum; CO₂-Ampel (grün unter 800 ppm, gelb 800–1000 ppm, rot über 1000 ppm); Zeit der letzten Messung je Sensor.
- **3D-Schulmodell:** Raum anklicken zeigt die aktuellen Werte; Live-Updates per WebSocket; Navigation zu Räumen und zum Turnsaal.

Alles läuft im Browser, ohne Login, auf Deutsch und Englisch. Gehostet wird auf der Schul-VM, deployt wird automatisch über GitHub Actions.

## Anforderungen

Aus der Funktionalen Spezifikation (Muss-Anforderungen):

- CO₂ und Temperatur pro Raum im Dashboard anzeigen, mit Raumauswahl (FR-01, FR-04).
- CO₂ und Temperatur beim Klick auf einen Raum im 3D-Modell anzeigen (FR-02).
- PV-/Energiedaten anzeigen: Erzeugung, Netzbezug, Batterie-Ausgang und -Eingang (FR-03).
- Live-Updates per WebSocket (FR-05).
- Sensorübersicht mit allen Sensoren (FR-06).
- Warnsymbol, wenn ein Sensor 5 Minuten lang keine Daten geliefert hat (FR-08).
- Meldung "No data for room" bei ungültigem Raum (FR-14).

Sollte/Könnte: konfigurierbares Aktualisierungsintervall mit 10 Sekunden als Standard (FR-09), Historie für wählbare Tage und Zeiträume (FR-10), gut sichtbare Navigation (FR-11), Status "aktiv/inaktiv" (FR-12), zusätzliche Warnungen etwa bei Raumtemperatur unter 10 °C (FR-13).

Nichtfunktional: keine Authentifizierung, Betrieb in der Schulumgebung, mehrere moderne Browser, lokale Zeitzone der Schule, Ausfall eines Sensors darf die anderen nicht beeinträchtigen.

Aus dem Projektantrag (Messkriterien): Dashboard im Schulnetz per Browser erreichbar; PV-Daten (kWh, eingespartes CO₂) werden periodisch aktualisiert; Raumklimadaten werden angezeigt; Warnschwelle bei CO₂ über 1000 ppm ist sichtbar. Als Technologien nennt der Antrag MQTT, InfluxDB und Grafana. Auftraggeber ist Professor Thomas Stütz; geplant war ein dokumentiertes, wartbares Dashboard bis Ende Juni 2026.

:::caution[Offen]
Die CO₂-Schwellen unterscheiden sich: Die Slides nennen 800/1000 ppm, die Funktionale Spezifikation und die OpenSpec-Spezifikation 600/1200 ppm (laut OpenSpec verwendet der Code 800/1000). Hier gelten die Slides. Die Spezifikation nennt außerdem Desktop als Erstversion; der aktuelle Stand enthält eine mobile Ansicht.
:::

## Team

| Bereich | Personen |
| --- | --- |
| Sensoren | Elias Pointinger (Projektleiter) |
| PV-Dashboard | Daniel Lettner, Stefan Schachner |
| 3D-Modell | Paul Kreinecker, Jonas Leitner |

## Aktueller Stand

Stand der Slides vom 5. Oktober 2026:

- PV-Dashboard mit Tagesansicht und Kiosk-Modi
- Raumklima mit CO₂-Ampel
- 3D-Modell mit Live-CO₂ und Raumnavigation
- Mobile Ansicht, Deutsch/Englisch
- Deployment auf der Schul-VM mit HTTPS
- Continuous Deployment und Datenbank-Backups

## Meilensteine

Als nächste Meilensteine nennen die Slides:

1. 3D-Modell verbessern
2. Weitere Klassenräume anbinden
3. Warnung bei kritischen Werten

:::caution[Offen]
Für die Meilensteine nennen die Quellen keine Termine.
:::

## Sprint-Reviews

Dokumentiert ist bisher das Review vom 28.04.2026. Kritik und Wünsche:

- **Sensor-Dashboard:** Skala, Achsenbeschriftung, Uhrzeitachse für einen Tag (00:00–23:59), Kiosk-System, Tage mit Pfeilen links/rechts überspringen.
- **PV-Dashboard:** Skala, Batteriestand, Einheiten (kWh, kW), Beschriftung "Lifetime Total", aktuelle Solarleistung, Aufschlüsselung von Erzeugung, Verbrauch und Batterie, Sprachumschalter Deutsch/Englisch.
- **3D-Modell:** Navigation mit Punkten (z. B. vor Türen, bei Treppen und Abzweigungen), kürzester Weg mit Dijkstra-Algorithmus, Navigation zum Turnsaal.
- **Sonstiges:** User Stories sauber schreiben (Akzeptanzkriterien, Tasks).

To-do bis zum nächsten Review: Kiosk-Modus, PV-Anzeigen, Navigation korrigieren, Skalen und Einheiten, Pfeile zum Überspringen von Tagen, DB-Backup.

## Quellen im Repository

- `asciidocs/slides/leoiot.adoc`
- `asciidocs/docs/Projektantrag.adoc`
- `docs/functional-specification.md`
- `openspec/specs/dashboard-sensors/spec.md`, `openspec/specs/dashboard-pv/spec.md`
- `asciidocs/docs/sprint-reviews/review-28-04-2026.md`
- `CHANGELOG.md`
