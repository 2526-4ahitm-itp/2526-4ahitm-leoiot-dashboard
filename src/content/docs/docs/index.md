---
title: Technik-Doku
description: Einstieg in die technische Dokumentation von LeoIoT, dem Dashboard für PV-Daten und Raumklima der HTL Leonding.
sidebar:
  order: 0
---

LeoIoT ist ein Schulprojekt der 4AHITM an der HTL Leonding. Es visualisiert Daten der PV-Anlage (Solax Cloud) und CO₂- und Temperaturwerte aus Klassenräumen in einem PV-Dashboard, einem Sensor-Dashboard und einem 3D-Schulmodell. Die Daten kommen von Sensorboxen (ESP32) per MQTT und von der Solax-Cloud-API; gespeichert werden sie in InfluxDB. Das System läuft auf der Schul-VM in Docker.

Die Doku ist so gegliedert:

- [Architektur](./architecture/): Kontext, Container und Datenfluss.
- [Schnittstellen](./interfaces/): MQTT, Solax-API und WebSocket.
- [Setup](./setup/): Entwicklungsumgebung einrichten.
- [Betrieb](./operations/): Deployment, Backups und Wartung.
- [Projekt](./project/): Ausgangslage, Ziele, Anforderungen, Team, Meilensteine und Sprint-Reviews.
