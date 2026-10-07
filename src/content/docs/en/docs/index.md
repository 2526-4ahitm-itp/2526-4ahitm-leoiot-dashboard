---
title: Technical docs
description: Entry point to the technical documentation of LeoIoT, the PV and room climate dashboard of HTL Leonding.
sidebar:
  order: 0
---

LeoIoT is a 5AHITM school project at HTL Leonding. It visualizes data from the PV system (Solax Cloud) and CO₂ and temperature values from classrooms in a PV dashboard, a sensor dashboard and a 3D school model. The data comes from sensor boxes (ESP32) via MQTT and from the Solax Cloud API; it is stored in InfluxDB. The system runs on the school VM in Docker.

The documentation is organised as follows:

- [Architecture](./architecture/): context, containers and data flow.
- [Interfaces](./interfaces/): MQTT, Solax API and WebSocket.
- [Setup](./setup/): setting up the development environment.
- [Operations](./operations/): deployment, backups and maintenance.
- [Project](./project/): background, goals, requirements, team, milestones and sprint reviews.
