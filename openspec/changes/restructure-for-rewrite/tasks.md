# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin`. Everything else is done in pull requests.

## 1. Preparation

- [x] 1.1 For each branch with commits not on `main` (`Sensor`, `feat/sensor-data`, `openspec`, `pv_dashboard`, `feat/nili-subscribe`, `docs/archtecture`) get the owner's decision to merge now or abandon; verify with `git rev-list --count origin/main..origin/<branch>` that every branch to be kept shows 0 after merging
- [ ] 1.2 Announce a freeze on `main` for the duration of the move and ask everyone to push or stash local work; verify all five team members acknowledged
- [ ] 1.3 **(human, vm23)** Record the output of `docker compose ls`, `docker volume ls` and `crontab -l` in the pull request for 1.4; verify the project name and the three volume names (`…_influxdb_data`, `…_mosquitto_data`, `…_influxdb_backups`) are written down
- [x] 1.4 Add a top-level `name:` with the recorded project name to `docker-compose.yaml` in its own pull request; verify `docker compose config --volumes` and `docker compose config | grep '^name:'` show the recorded names locally
- [ ] 1.5 **(human, vm23)** Pull the pin and run `docker compose up -d`; verify no container was recreated (`docker compose ps` start times unchanged), `docker volume ls` shows no new volumes, and the dashboard still shows historical data

## 2. Move the running system into `legacy/`

- [x] 2.1 Check whether the site build or `asciidocs/` references `img/` and decide stay or move per design D1; verify the decision with a grep result noted in the pull request
- [x] 2.2 Move everything listed under "Moves into `legacy/`" in design D1 with `git mv` in one commit containing no content edits; verify `git diff -M --stat HEAD~1` lists only renames at 100 % and `git log --follow legacy/frontend/logic.js` shows the pre-move history
- [x] 2.3 Verify the stack definition still resolves from its new place: `docker compose -f legacy/docker-compose.yaml config -q` exits 0 and the resolved bind-mount sources all point inside `legacy/`
- [x] 2.4 Verify the documentation site is unaffected: `npm ci && npm run build` at the root exits 0

## 3. Fix-ups after the move

- [x] 3.1 Update the path-specific `.gitignore` entries (`config/pwfile`, the two `sensorbox/…/secrets.yaml`, `sensorbox/nili-ldr/.esphome/`) to their `legacy/` paths; verify `git check-ignore -v legacy/config/pwfile legacy/sensorbox/nili-ldr/secrets.yaml legacy/sensorbox/s3-mini-oled/secrets.yaml` matches all three
- [x] 3.2 Update paths inside the moved documentation (`legacy/README.adoc` update, backup and restore commands, cron line) to the new locations; verify no command in it refers to a path that no longer exists
- [x] 3.3 Add `legacy/README.md` stating that the folder is frozen (keep-alive fixes and removals only), how to start the stack from there, and which new sub-project replaces which part; verify the start command in it runs as written
- [x] 3.4 Write a new root `README.md` describing the five folders, the docs site and where specs live, linking to `legacy/README.adoc` for the old system; verify every link resolves
- [x] 3.5 Search the repository for references to moved paths (`.claude/`, `.gemini/`, `.opencode/`, `.qwen/`, `.github/`, `src/content/`, `asciidocs/`) and update them; verify with a grep for the old top-level directory names that only intended matches remain

## 4. New sub-project folders

- [x] 4.1 Create `leoiot-platform/README.md`, `leoiot-sensors/README.md`, `leoiot-pv/README.md` and `leoiot-3d/README.md` per design D7 (purpose, owning team, status, spec group, dependency rule, legacy parts it replaces) and nothing else; verify each folder contains exactly one file
- [x] 4.2 Verify the four READMEs name the same teams as `src/content/docs/docs/project.md` and that the platform README states its owner is still to be assigned

## 5. OpenSpec regrouping

- [x] 5.1 Move `openspec/specs/dashboard-pv`, `openspec/specs/dashboard-sensors` and `openspec/specs/README.md` to `legacy/as-built-specs/` with `git mv`; verify `openspec list --specs` no longer lists them and `legacy/` is not detected as an OpenSpec root (`openspec status` run inside `legacy/` resolves to the repository root)
- [x] 5.2 Write the new `openspec/specs/README.md` with the six grouping rules and the tree from design D5; verify it names all four groups and the contract-first rule
- [x] 5.3 Add a `context:` to `openspec/config.yaml` containing the folder layout, the grouping rules, the change-naming rule and the legacy freeze; verify `openspec instructions proposal --change restructure-for-rewrite --json` returns that context
- [x] 5.4 Prove the grouping works end to end: confirm `openspec validate restructure-for-rewrite --strict` passes with the capability at `platform/repository-layout`

## 6. Documentation site notice

- [x] 6.1 Add a site-wide notice in German and English per design D8 saying the documentation describes the previous implementation and is being updated; verify it appears on a docs page in both locales in `npm run dev`
- [x] 6.2 Update the links in `src/content/docs/docs/project.md`, `interfaces.md` and their `en/` counterparts that point at moved repository paths; verify the built site has no link to a path that no longer exists
- [ ] 6.3 After merge, verify the Pages workflow run succeeds and the published site shows the notice

## 7. Host follow-up on vm23

- [ ] 7.1 **(human, vm23)** Pull the merged move, then run `docker compose up -d` from `legacy/`; verify `docker compose ls` shows the pinned project name, `docker volume ls` shows no new volumes, and all public routes answer
- [ ] 7.2 **(human, vm23)** Verify data continuity: the dashboard shows data from before the move and new sensor readings keep arriving
- [ ] 7.3 **(human, vm23)** Edit the backup cron line to `…/legacy/backup/backup.sh` (or install it if 1.3 showed none) and run the script once by hand; verify a new dated folder appears in `~/influxdb-backups/`
- [ ] 7.4 **(human, vm23)** Remove the leftover untracked top-level app directories once the stack runs from `legacy/`; verify `git status --short` in the checkout is empty
- [ ] 7.5 Lift the freeze and tell the team where things are now; verify each team has opened its sub-project README

## Workflow follow-up

- Update `fix-cicd-pipeline` to the new layout (Compose and nginx paths under `legacy/`, path mapping per folder, capabilities under `platform/`) before applying it.
- Start `platform-data-contract` as the first change of the rewrite, once the platform owner is named.
- Archive this change after 7.5.
