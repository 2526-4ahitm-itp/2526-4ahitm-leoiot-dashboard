# LeoIoT

LeoIoT shows live room climate (CO₂ and temperature), photovoltaic data and a 3D building model for the HTL Leonding. The system is being rebuilt from OpenSpec specs; the previous implementation keeps running in `legacy/` until every route is served by a new one.

## Repository layout

| Folder | Purpose | Team |
|---|---|---|
| [`legacy/`](legacy/) | The previous implementation, still running; frozen (keep-alive fixes only). See [`legacy/README.md`](legacy/README.md) and [`legacy/README.adoc`](legacy/README.adoc). | none (frozen) |
| [`leoiot-platform/`](leoiot-platform/) | Broker, database, reverse proxy, deployment and the shared data contract | to be assigned |
| [`leoiot-sensors/`](leoiot-sensors/) | New sensor ingestion and room-climate views | Sensoren: Elias Pointinger (project lead) |
| [`leoiot-pv/`](leoiot-pv/) | New PV data collection, dashboard and kiosks | PV-Dashboard: Daniel Lettner, Stefan Schachner |
| [`leoiot-3d/`](leoiot-3d/) | New building model and navigation | 3D-Modell: Paul Kreinecker, Jonas Leitner |

The four `leoiot-*` folders are new and contain only a README so far. A sub-project may depend only on the interfaces specified by the platform; it must not use files from `legacy/` or from another sub-project.

## Documentation site

The documentation site lives at the repository root (`src/`, `asciidocs/`, `public/`; built with [Astro](https://astro.build) and Starlight) and is published at <https://2526-4ahitm-itp.github.io/2526-4ahitm-leoiot-dashboard/>. It currently still describes the previous implementation and carries a notice saying so.

```bash
npm ci
npm run build
```

## Specs

Specifications live in `openspec/`, grouped by sub-project (`platform`, `sensors`, `pv`, `3d`). The grouping rules are in [`openspec/specs/README.md`](openspec/specs/README.md). The functional specification the new specs are derived from is [`docs/functional-specification.md`](docs/functional-specification.md).
