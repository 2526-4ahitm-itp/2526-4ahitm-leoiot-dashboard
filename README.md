# LeoIoT

LeoIoT shows live room climate (CO₂ and temperature), photovoltaic data and a 3D building model for the HTL Leonding. The system is being rebuilt from OpenSpec specs; the previous implementation keeps running in `legacy/` until every route is served by a new one. `/kiosk/` is already served by `leoiot-pv/`, and the former kiosk addresses (`/leogreen/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/`) redirect there.

## Repository layout

| Folder | Purpose | Team |
|---|---|---|
| [`legacy/`](legacy/) | The previous implementation, still running; frozen (keep-alive fixes only). See [`legacy/README.md`](legacy/README.md) and [`legacy/README.adoc`](legacy/README.adoc). | none (frozen) |
| [`leoiot-platform/`](leoiot-platform/) | Broker, database, reverse proxy, deployment and the shared data contract | to be assigned |
| [`leoiot-sensors/`](leoiot-sensors/) | New sensor ingestion and room-climate views | Sensoren: Elias Pointinger (project lead) |
| [`leoiot-pv/`](leoiot-pv/) | New PV data collection, dashboard and kiosks | PV-Dashboard: Daniel Lettner, Stefan Schachner |
| [`leoiot-3d/`](leoiot-3d/) | New building model and navigation | 3D-Modell: Paul Kreinecker, Jonas Leitner |

The four `leoiot-*` folders are new. Three of them contain only a README so far; `leoiot-pv/` already contains the main kiosk. A sub-project may depend only on the interfaces specified by the platform; it must not use files from `legacy/` or from another sub-project.

## Documentation site

The documentation site lives at the repository root (`src/`, `asciidocs/`, `public/`; built with [Astro](https://astro.build) and Starlight) and is published at <https://2526-4ahitm-itp.github.io/2526-4ahitm-leoiot-dashboard/>. It currently still describes the previous implementation and carries a notice saying so.

```bash
npm ci
npm run build
```

## Deployment

The application runs on <https://vm23.htl-leonding.ac.at>. A merge into `main` does not deploy. A pull request from `main` into the `release` branch, merged with a merge commit once `ci-ok` is green, does: the push to `release` starts the deploy workflow (`.github/workflows/deploy.yml`) on the runner on the school VM, which checks out exactly that commit, updates only the changed deploy units and legacy services, smoke-tests the public routes and then records the commit. A manual run of the workflow (inputs `ref` and `scope`) deploys an earlier commit of `release` or a single unit. The full description, including rollback and what to do when the checkout on the VM stops on a rewritten file (`git checkout -- <file>`), is on the Operations page of the documentation site: [`src/content/docs/en/docs/operations.md`](src/content/docs/en/docs/operations.md) (German: [`operations.md`](src/content/docs/docs/operations.md)).

This takes effect once the runner is installed on the VM and the `release` branch exists; until then the VM is updated by hand.

## Specs

Specifications live in `openspec/`, grouped by sub-project (`platform`, `sensors`, `pv`, `3d`). The grouping rules are in [`openspec/specs/README.md`](openspec/specs/README.md). The functional specification the new specs are derived from is [`docs/functional-specification.md`](docs/functional-specification.md).

## Contributing

Branch, pull request, release, layout and spec rules for people and coding agents are in [`AGENTS.md`](AGENTS.md) (Claude Code loads it through [`CLAUDE.md`](CLAUDE.md)). In short: every task gets its own branch from `main` and a pull request with a green `ci-ok`; nobody pushes to `main` or `release` directly; shipping is a pull request from `main` to `release`.
