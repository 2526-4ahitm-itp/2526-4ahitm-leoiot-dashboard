# AGENTS.md

Rules for coding agents and people working in this repository. Read all of it before you change anything.

## Layout and ownership

| Folder | Owner | What it is |
|---|---|---|
| `legacy/` | nobody, **frozen** | the running system on vm23 |
| `leoiot-platform/` | to be assigned (the repository maintainers until then) | broker, database, proxy, deployment, CI, shared data contract |
| `leoiot-sensors/` | Sensoren: Elias Pointinger | sensor ingestion, room-climate views |
| `leoiot-pv/` | PV-Dashboard: Daniel Lettner, Stefan Schachner | PV collection, dashboard, kiosks |
| `leoiot-3d/` | 3D-Modell: Paul Kreinecker, Jonas Leitner | building model, navigation |
| root | platform | docs site (`src/`, `public/`, `asciidocs/`), `openspec/`, `docs/`, `.github/` |

- Work in the folder of your sub-project. Its code stays there and never imports, copies or mounts anything from `legacy/` or from a sibling sub-project; shared behaviour comes through an interface specified in `openspec/specs/platform/`.
- `legacy/` only gets changes that keep the running system working (or remove parts a new implementation replaced). A feature request for an old app is specified for the matching new sub-project instead.
- `.github/`, Compose files and root files are shared. Change them in a pull request of their own and take extra care: a change in `.github/` makes CI run every check.
- Never write credentials, tokens or `.env` files into the repository, and do not copy the credentials found in `legacy/`.

## Specs

- One spec tree at the root, `openspec/specs/<group>/<capability>/spec.md`, group = `platform`, `sensors`, `pv` or `model3d`. The rules are in `openspec/specs/README.md`; read them, do not copy them. Never create an `openspec/` folder inside a sub-project.
- A change is named after its group: `pv-daily-yield-kiosk`, `sensors-stale-warning`, `platform-data-contract`. It normally touches one group. A change that needs another group's spec is a `platform-…` change or is split.
- Contract first: a topic, payload, field or any other shared interface goes into `openspec/specs/platform/` through a `platform-…` change that is merged before code relies on it.

## Branches, worktrees, pull requests

- One short-lived branch per task, created from fresh `main`. Names: `feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`, then a short kebab-case description.
- One worktree per concurrent agent, so that agents never share a working directory. Create it from `origin/main`, and remove it when the work is merged:

  ```bash
  git fetch origin
  git worktree add ../leoiot-<task> -b feat/<task> origin/main
  cd ../leoiot-<task>        # work and commit here; run npm ci in the components you touch
  git worktree remove ../leoiot-<task>
  git branch -D feat/<task>  # only once the pull request is merged
  ```

- To hand unfinished work to a later session, save a continuation prompt in `docs/continuations/`. The rules are in `docs/continuations/README.md`.
- Push your branch and open a pull request into `main` (`gh pr create --base main`). CI runs only the components the change touches; the aggregate check `ci-ok` must be green before it merges. Merge only when your user asks you to.
- **Never push to `main` or `release`** (both are protected) and never force-push a shared branch. `main` must always be shippable: do not merge unfinished work.

## Shipping

- A merge into `main` does not deploy. Shipping is a pull request `main` → `release`, merged with a merge commit once `ci-ok` is green. It needs no approval: the person who opened it may merge it. The push to `release` starts the deployment to vm23 (`.github/workflows/deploy.yml`, details in `src/content/docs/en/docs/operations.md`). One promotion ships everything on `main`.
- You may open a promotion pull request when your user asks. You never approve or merge a pull request into `release`.
- Without the explicit instruction of your user, do not change rulesets, the runner, the `production` environment, the deploy workflow's targets or anything on vm23, and do not log in to vm23.

## Run the checks locally

CI runs these; run the ones your change affects before you push.

```bash
.github/ci/affected.sh origin/main HEAD    # prints what CI will check, one "kind value" line each
```

Then, per line of the output (the commands are the ones in `.github/workflows/ci.yml`):

- `docs true`: `npm ci && npm run build` at the root (Node 22).
- `node <dir>`: `cd <dir> && npm ci && npm test --if-present && npm run build`. Node 22 for `leoiot-*`, Node 20 for `legacy/*`. If the component has no `build` script, run `node --check` on its entry file (`main` in `package.json`, default `index.js`) instead. `legacy/kiosk`, `legacy/kiosk4` and `legacy/leogreenKiosk` have no lockfile: use `npm install --no-package-lock` and never commit a lockfile there.
- `maven <dir>`: `cd <dir> && ./mvnw -B verify` (Java 21).
- `compose <file>`: `docker compose -f <file> config -q`. A unit with a `.env.example` is checked with it, empty values replaced:

  ```bash
  env=$(mktemp); sed -E 's/^([A-Za-z_][A-Za-z0-9_]*)=$/\1=ci-placeholder/' leoiot-pv/.env.example > "$env"
  docker compose -f leoiot-pv/compose.yaml --env-file "$env" config -q
  ```

- `image <dir>`: `.github/ci/image-build.sh <dir>`, which runs `docker build <dir>`, or builds from an ancestor folder within the same sub-project when `<dir>/build-context` names one (for example `..`, so that two apps can share a package of their sub-project). A Node component that uses another one of its sub-project as a local `file:` dependency is checked whenever that one changes.
- `ci-scripts true`: `bash .github/ci/affected.test.sh`.
- Specs: `openspec validate <change> --strict`.

A new sub-project folder is picked up by CI and deployment by its shape: a `package.json` or `pom.xml` per component, a `Dockerfile`, a `compose.yaml` in the sub-project root, routes in `.github/ci/smoke-routes`.

## More

`README.md`, `openspec/specs/README.md`, `openspec/config.yaml`, `legacy/README.md`, and the Operations page of the docs site.
