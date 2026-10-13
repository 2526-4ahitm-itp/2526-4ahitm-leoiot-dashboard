# Proposal

## Why

The current code base grew without specs or structure and is not a base the team wants to keep building on. The three sub-projects will be re-implemented from OpenSpec specs by coding agents. That needs a repository where the old system keeps running untouched, each new implementation has its own clearly bounded home, and the part all three share — broker, database, reverse proxy and the data contract — has an owner before anyone starts, because that shared middle belonging to nobody is how the old system ended up where it is.

## What Changes

- **BREAKING** Move the entire running application into `legacy/`: the Compose stack, all apps and services, firmware, backup scripts, nginx config and the helper files that belong to them. Paths on vm23 and in local setups change.
- Create four new top-level folders, each with a short README stating its purpose, owning team and status, and no code yet:
  - `leoiot-platform/` — broker, database, reverse proxy, deployment and the shared data contract
  - `leoiot-sensors/` — new sensor ingestion and room-climate views
  - `leoiot-pv/` — new PV data collection, dashboard and kiosks
  - `leoiot-3d/` — new building model and navigation
- Keep the documentation site (Astro, published to GitHub Pages) at the repository root as the documentation of the new system, and mark it as outdated: it currently describes the legacy system and will be updated as the new implementations land.
- Keep one `openspec/` at the root and group specs by sub-project (`platform/`, `sensors/`, `pv/`, `3d/`). Write the grouping rules into `openspec/specs/README.md` and into the OpenSpec project context so every agent sees them when it creates artifacts.
- Move the two existing as-built specs (`dashboard-pv`, `dashboard-sensors`) and their conversion tracker into `legacy/` as reference material. The functional specification (`docs/functional-specification.md`) stays at the root as the source for the new specs.
- Keep legacy deployable from its new location with its existing data: pin the Compose project name before the move, so the stack keeps its data volumes, and update the host-side paths that point into the repository (backup cron job).
- Update `.gitignore` entries that name moved paths, so ignored credential files stay ignored.

Out of scope: writing any of the new implementations, choosing their tech stacks, the data contract itself (first change of the rewrite), the cut-over from legacy to new on vm23, and the CI/CD rework (`fix-cicd-pipeline`, which follows this change and will be adjusted to the new layout).

## Capabilities

### New Capabilities
- `platform/repository-layout`: how the repository is divided into legacy and the new sub-projects, what each part may depend on, how specs are grouped, and where shared contracts live.

### Modified Capabilities

None through spec deltas. `dashboard-pv` and `dashboard-sensors` are skeleton as-built descriptions of the legacy dashboard; they leave `openspec/specs/` as files and become reference material under `legacy/`. Their requirements are not carried into the new spec tree — the new sub-projects derive theirs from the functional specification.

## Impact

- **Every path in the running system changes** (`frontend/` → `legacy/frontend/` and so on). No file content changes except path fix-ups.
- **vm23**: the next manual update must run Compose from `legacy/`; the weekly InfluxDB backup cron job points at a path that moves and stops working until it is edited. Needs shell access as `solmqadmin`.
- **Data safety**: without a pinned project name, running Compose from `legacy/` would create new, empty volumes for InfluxDB and Mosquitto beside the existing ones.
- **Unmerged branches**: six remote branches carry commits that are not on `main` (`Sensor`, `feat/sensor-data`, `openspec`, `pv_dashboard`, `feat/nili-subscribe`, `docs/archtecture`). After the move they no longer merge cleanly; each needs a merge-or-abandon decision first.
- **GitHub Pages**: unaffected in mechanics (the site stays at the root); gains an "outdated" notice.
- **Agents and tooling**: `.claude/`, `.gemini/`, `.opencode/`, `.qwen/` and `.github/` stay at the root. `openspec/config.yaml` gains project context.
- **`fix-cicd-pipeline`**: stays as proposed, but its path mapping and Compose paths must be updated to the new layout before it is applied, and its three capabilities move under the `platform/` group.
