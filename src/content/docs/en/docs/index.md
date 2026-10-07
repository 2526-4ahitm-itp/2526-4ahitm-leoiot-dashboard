---
title: Technical documentation
description: Entry point to the technical documentation of LeoIoT, the PV and room climate dashboard of HTL Leonding.
sidebar:
  label: Overview
  order: 0
---

LeoIoT is a school project of class 5AHITM at HTL Leonding (a technical secondary school in Austria). It shows data from the PV (photovoltaic, solar power) system (manufacturer Solax) and CO₂ and temperature values from classrooms in a dashboard, a kiosk display (a full-screen display for screens in the school building) and a 3D model of the school. The data comes from sensor boxes via MQTT and from the Solax Cloud and is stored in InfluxDB; everything runs in Docker on the school’s virtual machine (VM).

As of today, one real sensor box delivers measurements (room 105). All other rooms are fed with simulated test values.

## Where to start

- **Understand the project:** goals, requirements and team are on the [Project](./project/) page.
- **Understand the technology:** the [Architecture](./architecture/) page describes data flow, services and interfaces.
- **Run it yourself:** [Setup](./setup/) explains how to start the whole system locally.

## All pages

- [Project](./project/): background, goals, requirements, team, milestones and sprint reviews.
- [Architecture](./architecture/): data pipeline, services, ports and frontends.
- [Interfaces](./interfaces/): MQTT topics, the bridge WebSocket, InfluxDB queries, Grafana.
- [Setup](./setup/): starting the whole system locally with Docker Compose, required files, ports.
- [Operations](./operations/): deployment, Nginx routing, backup and restore, known limitations.
