# Design

## Context

See `proposal.md` for motivation. Facts that shape the approach:

- **What runs today.** One Compose stack at the repository root (`docker-compose.yaml`), most services bind-mounting their source directory with relative paths (`./frontend`, `./config`, `./telegraf.conf`, `./grafana/…`). On vm23 it lives in `/home/solmqadmin/2526-4ahitm-leoiot-dashboard`. nginx on the host is configured by hand from `deploy/nginx.conf`.
- **Compose project name.** The compose file does not set one, so Compose derives it from the directory it runs in, and prefixes named volumes with it (`<project>_influxdb_data`, `<project>_mosquitto_data`, `<project>_influxdb_backups`). The actual name on vm23 has not been checked; from the directory it should be `2526-4ahitm-leoiot-dashboard`.
- **Host references into the repo.** The README documents a weekly cron job calling `/home/solmqadmin/2526-4ahitm-leoiot-dashboard/backup/backup.sh`. Whether it is installed was not checked.
- **Deployment is manual right now.** The self-hosted runner is gone (see `platform-cicd-pipeline`), so nothing changes on vm23 until someone pulls there.
- **Docs site.** Root `package.json`, `astro.config.mjs`, `src/`, `public/` build the site; `.github/workflows/docs.yaml` publishes it on every push to `main`. `asciidocs/` (project application, minutes, system spec, slides source) is linked from the site's pages.
- **Ignored credential files.** `.gitignore` names `config/pwfile`, `sensorbox/nili-ldr/secrets.yaml`, `sensorbox/s3-mini-oled/secrets.yaml` and `sensorbox/nili-ldr/.esphome/` by path.
- **Open work.** No open pull requests. Six remote branches have commits not on `main`; `origin/openspec` (4 commits) was last touched on 2026-10-06, the others between January and April.
- **Existing specs.** `openspec/specs/` holds two skeleton as-built specs and a conversion tracker for the legacy dashboard. `platform-cicd-pipeline` is the only open change.

## Goals / Non-Goals

**Goals:**

- The move is a pure relocation: reviewable as renames, history follows the files.
- Legacy keeps running on vm23 with its data, from its new path.
- An agent starting in any of the new folders can tell from the repository alone what belongs there, what it may depend on and where its specs go.

**Non-Goals:**

- Any tech-stack, framework or build decision for the new sub-projects.
- The content of the data contract.
- Shared build tooling across sub-projects (workspace, common lint config).
- Cleaning up or fixing legacy code, including its committed credentials.

## Decisions

### D1. What moves and what stays

| Stays at the root | Why |
|---|---|
| `.github/` | GitHub only reads workflows and templates there |
| `.claude/`, `.gemini/`, `.opencode/`, `.qwen/` | agent configuration and the OpenSpec skills apply to the whole repo |
| `openspec/` | single spec tree (D5) |
| `package.json`, `package-lock.json`, `astro.config.mjs`, `src/`, `public/`, `asciidocs/`, `local-convert.sh`, `publish.sh` | the documentation site and its sources |
| `docs/functional-specification.md` | the target the new specs are derived from |
| `LICENSE`, `.gitignore`, new `README.md` | repository-wide |

| Moves into `legacy/` | |
|---|---|
| `docker-compose.yaml`, `telegraf.conf`, `config/`, `grafana/`, `deploy/`, `backup/` | the stack and its host configuration |
| `frontend/`, `dashboard-v2/`, `kiosk/`, `kiosk2/`, `kiosk3/`, `kiosk4/`, `leogreenKiosk/` | web apps |
| `fake-sensors/`, `mqtt-ws-bridge/`, `solax-collector/`, `backend/` | services |
| `sensorbox/` | firmware and ESPHome configs of the current sensors |
| `vite.config.ts`, `parse.js`, `parse_gltf.py`, `api/` | helpers that only make sense with the apps above |
| `README.adoc`, `CHANGELOG.md`, `contextKiosk.md`, `continuations/`, `scratch/`, `.claude/memory/project_overview.md` | descriptions of, and notes about, the legacy system |
| `openspec/specs/dashboard-pv`, `dashboard-sensors`, `specs/README.md` → `legacy/as-built-specs/` | as-built reference (D6) |

`img/` is decided during implementation: it stays if the site build or `asciidocs/` references it, otherwise it moves.

Everything keeps its relative position inside `legacy/`, so the compose file's relative mounts and `vite.config.ts`'s `./frontend` keep working without edits.

*Alternative:* move only the apps and leave the stack files at the root (rejected: the root would stay a half-application and "is this legacy?" would need judgment for every file). A separate repository for legacy (rejected: the team asked for folders, and one repo keeps history and the route-by-route cut-over in one place).

### D2. Two commits: pin first, then a pure move

1. A small pull request that only adds a top-level `name:` to `docker-compose.yaml`, set to the project name vm23 actually uses (D3). It is deployed and verified on vm23 before the move, while the file is still at the root. This is a no-op by construction.
2. The move as one commit made only with `git mv`, no content edits. `git diff -M --stat` must show renames with 100 % similarity.
3. Fix-ups (`.gitignore`, links, READMEs, notices) as following commits in the same pull request.

*Why:* a pure-rename commit can be reviewed by checking that it is one, and `git log --follow` and `git blame` keep working. Pinning first means the risky step (D3) is tested in isolation and is already live when paths change.

### D3. Pin the Compose project name to keep the data volumes

`name: <current project name>` in the compose file, where the value is read from the host with `docker compose ls` and `docker volume ls`, not assumed.

*Why:* after the move Compose would derive the project name `legacy`, create `legacy_influxdb_data` and friends, and InfluxDB would run its first-time setup on an empty volume. Nothing is deleted, but the dashboards show no history and new data is written to the wrong volume until someone notices.

*Alternatives:* declare the volumes `external` with their full current names (works, more edits, and breaks fresh local setups); pass `-p` on the command line (relies on every person and script remembering it).

### D4. Host follow-up is part of the change

Three things on vm23 depend on repository paths and are covered by tasks, not left to chance:

- run Compose from `legacy/` from now on;
- edit the backup cron line to `…/legacy/backup/backup.sh`;
- remove the old top-level app directories that remain as untracked leftovers (`node_modules` created by the containers), after the stack runs from `legacy/`.

`/etc/nginx/sites-enabled/leoiot` is a copy and proxies to ports, so it is unaffected.

### D5. One spec tree, grouped by sub-project

```
openspec/
├── config.yaml            project context incl. the grouping rules below
├── specs/
│   ├── README.md          the grouping rules, for people
│   ├── platform/          leoiot-platform  — and everything shared
│   │   ├── repository-layout/
│   │   ├── data-contract/           (first change of the rewrite)
│   │   └── ci-verification/ …       (from platform-cicd-pipeline)
│   ├── sensors/           leoiot-sensors
│   ├── pv/                leoiot-pv
│   └── model3d/           leoiot-3d
└── changes/
    ├── platform-…/
    ├── sensors-…/
    ├── pv-…/
    └── model3d-…/
```

The rules, written into both `specs/README.md` and the `context:` of `openspec/config.yaml`:

1. **Path = group / capability.** Every capability lives at `openspec/specs/<group>/<capability>/spec.md`. The group is the sub-project that implements it: `platform` → `leoiot-platform/`, `sensors` → `leoiot-sensors/`, `pv` → `leoiot-pv/`, `model3d` → `leoiot-3d/`.
2. **One home per capability.** A capability belongs to exactly one group. If two sub-projects rely on a behaviour, it is not duplicated — it belongs in `platform`.
3. **`platform` owns everything shared.** Broker, database, reverse proxy, deployment, CI, repository rules, and above all the data contract: topics, payloads, measurements, fields, retention. Sub-project specs refer to the contract ("publishes readings as specified in `platform/data-contract`") and never restate topic names or field lists.
4. **Contract first.** A sub-project may not rely on an interface that is not in the platform spec yet. The interface change is proposed and merged first.
5. **Changes are named after their group.** `pv-daily-yield-kiosk`, `sensors-stale-warning`, `platform-data-contract`. A change normally touches specs of one group only. A change that needs another group's spec, or the contract, is a `platform-…` change or is split.
6. **Legacy has no specs here.** `legacy/as-built-specs/` is reference material, not part of the spec tree, and has no change process.

*Why one tree instead of one `openspec/` per folder:* the contract is the thing most likely to go wrong in a three-way parallel rewrite, and a single tree keeps it in the same listing, the same validation and the same review flow as the specs that depend on it. Per-folder trees would give each team a private change list, but a contract change would then live in a different OpenSpec root from the specs it affects, and nothing would connect them.

*Why groups in the path instead of a naming prefix:* OpenSpec supports nested capability paths; folders make ownership visible in every diff and let review rules and CI scoping key on a path prefix.

*Why put the rules in `config.yaml`:* its `context` is handed to the agent on every `openspec instructions` call, so the grouping is applied when artifacts are created instead of being discovered in review.

*Trade-off:* five people's agents share one `changes/` directory. Group-prefixed change names keep them apart; two changes can still edit the same spec file, which is the conflict that should be visible.

### D6. As-built specs become legacy reference

`dashboard-pv`, `dashboard-sensors` and the tracker `README.md` move to `legacy/as-built-specs/` with `git mv`. The folder has no `config.yaml`, so OpenSpec does not treat it as a second planning root. The tracker's backlog of contradictions between code and functional specification (CO₂ thresholds, stale-sensor warning, refresh intervals) stays readable there as input for the new specs.

### D7. New folders contain a README and nothing else

Git does not track empty directories, and an agent landing in an empty folder has nothing to orient by. Each README states: purpose, owning team, status ("not started"), which spec group it implements, the dependency rule (platform contract only; nothing from `legacy/` or sibling folders), and the legacy components it will replace:

| Folder | Team | Replaces from `legacy/` |
|---|---|---|
| `leoiot-platform/` | to be assigned (see Open Questions) | `docker-compose.yaml`, `config/`, `telegraf.conf`, `grafana/`, `deploy/nginx.conf`, `backup/`, `mqtt-ws-bridge/` |
| `leoiot-sensors/` | Sensoren | `sensorbox/`, `fake-sensors/`, `backend/sensor-data-generator/`, sensor views of `dashboard-v2/` |
| `leoiot-pv/` | PV-Dashboard | `solax-collector/`, `kiosk*/`, `leogreenKiosk/`, PV views of `dashboard-v2/` |
| `leoiot-3d/` | 3D-Modell | `frontend/` |

No scaffolding, no `package.json`, no stack choice: those are the first decisions of each sub-project's own changes.

### D8. Documentation site: stays, with a notice

One site-wide banner (Starlight supports a banner per page and through a component override) in both locales: the documentation describes the previous implementation and is being rewritten alongside the new one. The pages that link to moved files (`project.md`, `interfaces.md` in both locales reference repository paths) get their links updated to the `legacy/` paths. Content is otherwise untouched.

### D9. Unmerged branches are decided before the move

For each of the six branches the owner chooses: merge now, or abandon (the branch stays on the remote; it just will not merge cleanly later). `origin/openspec` is the only recent one and probably carries spec work that belongs either in `legacy/as-built-specs/` or in the new tree.

*Why before:* after a repository-wide rename every one of them conflicts on every file it touched, and resolving that by hand is where work gets lost.

### D10. Order relative to `platform-cicd-pipeline`

This change lands first. Afterwards `platform-cicd-pipeline` is updated, not rewritten: Compose and nginx paths gain the `legacy/` prefix, the path mapping (its D11) becomes "one folder, one sub-project" plus the legacy services, and its three capabilities move under `platform/`. Its branch rules and agent instructions do not depend on the layout and could be applied before this change if the team wants protection on `main` during the restructure.

## Risks / Trade-offs

- **Empty InfluxDB after the move** → D3, verified on the host before and after (tasks 1.x and 6.x). Fallback if it still happens: stop the stack, start it with the old project name; the old volumes are untouched.
- **Backups stop silently** because the cron path moved → explicit host task with a test run.
- **Credential files become tracked** when their `.gitignore` paths no longer match → fix-up task plus a `git status` check on a machine that has those files.
- **Someone pulls on vm23 between the move and the host follow-up** → the running containers keep their mounts until restarted, but the next `docker compose up` from the old directory finds no compose file and fails loudly rather than doing damage. Announce the move; do the host follow-up the same day.
- **In-flight local work** on anyone's machine conflicts the same way as the remote branches → announce a freeze window for the move.
- **Legacy rots while frozen** → it only has to live until cut-over; the freeze rule allows keep-alive fixes.
- **The platform has no confirmed owner** → the folder and group exist, but the contract change cannot start without one. Listed as an open question because it blocks the next change, not this one.
- **Docs describe the wrong system for a while** → the banner says so; updating pages is part of each sub-project's changes.

## Migration Plan

1. Decide the unmerged branches; announce a short freeze on `main`.
2. Read the Compose project and volume names on vm23; land and deploy the `name:` pin; confirm nothing was recreated and data is intact.
3. Land the move pull request (pure rename commit, then fix-ups, new folders, spec regrouping, docs notice). Confirm the Pages build and site.
4. Host follow-up on vm23 the same day: pull, start from `legacy/`, confirm volumes and data, fix the cron line, clean leftovers.
5. Lift the freeze. Next: `platform-data-contract`, then the sub-project changes; `platform-cicd-pipeline` updated to the new layout.

**Rollback.** Revert the move pull request; on vm23 check out the previous commit and start from the root again. Because the project name is pinned, the volumes are the same in both layouts, so rolling back loses no data.

## Open Questions

- Who owns `leoiot-platform/` and the `platform` spec group? It does not change this restructure, but the data-contract change needs a named owner; the project lead is the default until the team decides.
- Is the weekly backup cron job actually installed on vm23? If not, task 6.3 installs it instead of editing it.
