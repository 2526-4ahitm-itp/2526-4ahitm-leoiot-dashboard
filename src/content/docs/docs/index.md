---
title: Technische Dokumentation
description: Einstieg in die technische Dokumentation von LeoIoT, dem Dashboard für PV-Daten und Raumklima der HTL Leonding.
sidebar:
  label: Überblick
  order: 0
---

LeoIoT ist ein Schulprojekt der Klasse 5AHITM an der HTL Leonding (Höhere Technische Lehranstalt). Es zeigt Daten der PV-Anlage (Photovoltaik, Solarstromanlage; Hersteller Solax) sowie CO₂- und Temperaturwerte aus Klassenräumen in einem Dashboard, einer Kiosk-Anzeige (Vollbild-Anzeige für Bildschirme im Schulhaus) und einem 3D-Modell der Schule. Die Daten kommen von Sensorboxen über MQTT und aus der Solax-Cloud und werden in InfluxDB gespeichert; alles läuft in Docker auf der virtuellen Maschine (VM) der Schule.

Stand heute liefert eine echte Sensorbox Messwerte (Raum 105). Die übrigen Räume werden von einem Simulator mit Testwerten versorgt.

## Wo soll ich anfangen?

- **Das Projekt verstehen:** Ziele, Anforderungen und Team stehen auf der Seite [Projekt](./project/).
- **Die Technik verstehen:** Datenfluss, Dienste und Oberflächen beschreibt die [Architektur](./architecture/).
- **Selbst starten:** Das Gesamtsystem lokal in Betrieb nehmen erklärt die [Einrichtung](./setup/).

## Alle Seiten

- [Projekt](./project/): Ausgangslage, Ziele, Anforderungen, Team, Meilensteine und Sprint-Reviews.
- [Architektur](./architecture/): Datenpipeline, Dienste, Ports und Frontends.
- [Schnittstellen](./interfaces/): MQTT-Topics, WebSocket der Bridge, InfluxDB-Abfragen, Grafana.
- [Einrichtung](./setup/): Gesamtsystem lokal mit Docker Compose starten, benötigte Dateien, Ports.
- [Betrieb](./operations/): Deployment, Nginx-Routing, Backup und Restore, bekannte Einschränkungen.
