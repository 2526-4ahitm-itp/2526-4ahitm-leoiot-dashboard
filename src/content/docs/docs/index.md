---
title: Technische Dokumentation
description: Einstieg in die technische Dokumentation von LeoIoT, dem Dashboard für PV-Daten und Raumklima der HTL Leonding.
sidebar:
  order: 0
---

LeoIoT ist ein Schulprojekt der 5AHITM an der HTL Leonding. Es visualisiert Daten der PV-Anlage (Photovoltaik, Solarstromanlage; Solax Cloud) und CO₂- und Temperaturwerte aus Klassenräumen in einem Dashboard (Raumklima- und PV-Ansicht), einer Kiosk-Anzeige und einem 3D-Modell der Schule. Die Daten kommen von Sensorboxen (ESP32, ein kleiner Mikrocontroller) über MQTT (ein einfaches Nachrichtenprotokoll für Sensoren) und aus der Solax-Cloud-API. Gespeichert werden sie in InfluxDB, einer Datenbank für Messwerte mit Zeitstempel. Das System läuft in Docker (Software-Containern) auf der virtuellen Maschine (VM) der Schule.

Die Dokumentation ist wie folgt gegliedert:

- [Architektur](./architecture/): Datenpipeline, Dienste, Ports und Frontends.
- [Schnittstellen](./interfaces/): MQTT, Solax-API und WebSocket.
- [Einrichtung](./setup/): Entwicklungsumgebung einrichten.
- [Betrieb](./operations/): Deployment, Backups und Wartung.
- [Projekt](./project/): Ausgangslage, Ziele, Anforderungen, Team, Meilensteine und Sprint-Reviews.
