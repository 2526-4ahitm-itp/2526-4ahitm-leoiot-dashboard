---
title: Technical documentation
description: Entry point to the technical documentation of LeoIoT, the PV and room climate dashboard of HTL Leonding.
sidebar:
  order: 0
---

LeoIoT is a 5AHITM school project at HTL Leonding. It visualises data from the PV (photovoltaic, solar power) system (Solax Cloud) and CO₂ and temperature values from classrooms in a dashboard (room climate and PV views), a kiosk display and a 3D model of the school. The data comes from sensor boxes (ESP32, a small microcontroller) via MQTT (a lightweight messaging protocol for sensors) and from the Solax Cloud API. It is stored in InfluxDB, a database for time-stamped measurements. The system runs in Docker (software containers) on the school's virtual machine (VM).

The documentation is organised as follows:

- [Architecture](./architecture/): data pipeline, services, ports and frontends.
- [Interfaces](./interfaces/): MQTT, Solax API and WebSocket.
- [Setup](./setup/): setting up the development environment.
- [Operations](./operations/): deployment, backups and maintenance.
- [Project](./project/): background, goals, requirements, team, milestones and sprint reviews.
