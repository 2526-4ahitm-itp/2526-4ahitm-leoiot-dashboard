# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin`. This change starts only after `platform-data-contract-pv` is merged.

## 1. Sub-project scaffold with the kiosk

- [x] 1.1 On a fresh branch from `main`, add the files of `leogreenKiosk/` from the tip of `feat/kiosk-rebuild` as `leoiot-pv/kiosk/` in one commit that names the source commit; verify `git diff --stat` shows additions under `leoiot-pv/kiosk/` only and no file under `legacy/` is touched
- [x] 1.2 Verify the kiosk is intact in its new place before changing it: `npm ci`, `npm test` and `npm run build` in `leoiot-pv/kiosk/` all exit 0 and the test count matches the count on the source branch
- [x] 1.3 Verify the dependency rule: nothing in `leoiot-pv/` imports, copies or mounts a file from `legacy/` or a sibling sub-project, and no kiosk file contains a token, password or login. Two intended exceptions, accepted by Daniel on 2026-10-13: `kiosk/tests/tokens.test.ts` reads `src/styles/tokens.css` of the documentation site at the repository root (the spec asks for the same design tokens), and the READMEs name what is still in `legacy/`

## 2. Address `/kiosk/`

- [x] 2.1 Change the base path from `/leogreen/` to `/kiosk/` in the build configuration, the nginx template, the `Dockerfile`, the tests and the kiosk README, and the container port to 8088; verify a search for `leogreen` and `8087` in `leoiot-pv/` finds nothing and `npm test` passes
- [x] 2.2 Verify the built container: `docker build` succeeds, `GET /kiosk/` returns the page, `GET /kiosk` redirects to `/kiosk/`, `GET /healthz` returns 200, `GET /leogreen/` returns 404, and a `GET` on `/kiosk/api/query` returns 405
- [x] 2.3 Verify no credential is delivered: with `KIOSK_INFLUX_TOKEN` set to a marker value, a search of every file the container serves for that marker finds nothing

## 3. Deployment files

- [x] 3.1 Add `leoiot-pv/compose.yaml` (project `leoiot-pv`, kiosk service built from `./kiosk`, published on `127.0.0.1:8088`, attached to the external network of the legacy stack, restart policy, health check on `/healthz`) and `leoiot-pv/.env.example` naming `KIOSK_INFLUX_TOKEN`, and ignore `leoiot-pv/.env` in Git; verify `docker compose -f leoiot-pv/compose.yaml config -q` exits 0 with an `.env` present and fails with a named variable without one
- [x] 3.2 Verify against a local legacy stack: with both stacks up, `http://localhost:8088/kiosk/` shows data in all four panels and the browser's network view shows the live channel connected under `/kiosk/ws`
- [x] 3.3 Rewrite `leoiot-pv/README.md`: layout and stack decision, how to run tests and the container, which variables are needed, what is live, and what is still in `legacy/` (the collector, the PV views of `/dashboard/`) or planned (the second kiosk, with the content only the removed kiosks showed); verify every command in it runs as written

## 3a. Power panel with counters that step back (added 2026-10-13, decided by Daniel)

- [x] 3a.1 Change the day-start detection and compute power from the highest counter value so far that day (design D10), with tests built from the readings of 2026-10-13 between 04:40 and 05:40; verify `npm test` passes, the new tests fail without the change, and the power panel for 2026-10-13 shows curves from 00:00 on
- [x] 3a.2 Verify the rings and the weekly overview show the same values as before the change for the same readings

## 4. Cut-over on vm23

- [x] 4.1 Find out which address the screens in the school have open and tell the people responsible for them the switch day; answer from Daniel on 2026-10-13: no screen in the school shows a kiosk at present, so there is nobody to warn. A kiosk goes on the screens only after talking to the teacher, once `/kiosk/` and the second kiosk are finished
- [x] 4.2 **(human, vm23)** Check that port 8088 is free and the legacy network name matches `compose.yaml`, create `leoiot-pv/.env` with the read token from `platform-data-contract-pv`, and start the PV stack; verify through an SSH tunnel that `/kiosk/` on port 8088 shows current data in all four panels in both themes
- [x] 4.3 Change `legacy/deploy/nginx.conf`: point `/kiosk/` to port 8088 with WebSocket upgrade headers; verify `nginx -t` accepts the file
- [x] 4.4 **(human, vm23)** Apply 4.3 to the host configuration and reload nginx; verify `https://vm23.htl-leonding.ac.at/kiosk/` shows the new kiosk with data, the live channel connects, and the other four kiosk addresses still show their old pages
- [x] 4.5 Change `legacy/deploy/nginx.conf`: `/leogreen/`, `/kiosk2/`, `/kiosk3/` and `/kiosk4/` (with and without trailing slash) answer with a 302 to `/kiosk/` that keeps the query string; verify `nginx -t` accepts the file
- [x] 4.6 **(human, vm23)** Apply 4.5 and reload nginx; verify each of the four addresses ends on `/kiosk/`, `/leogreen/?theme=dark` ends on `/kiosk/?theme=dark`, and `/dashboard/` and `/` are unaffected

## 5. Acceptance

- [ ] 5.1 Have the kiosk accepted on the real screen at `/kiosk/` with live data (the task left open in `rebuild-main-kiosk` and `fix-review-findings`); verify the acceptance and its date are written in the pull request
- [ ] 5.2 Observe for one week; verify on each of two different days that "Zuletzt aktualisiert" is current and that the kiosk container shows no restart in `docker compose ps`

## 6. Remove the legacy kiosks

- [x] 6.1 In a separate pull request remove `legacy/kiosk/`, `kiosk2/`, `kiosk3/`, `kiosk4/`, `leogreenKiosk/`, their five services in `legacy/docker-compose.yaml`, the kiosk proxy entries in `legacy/vite.config.ts`, `legacy/contextKiosk.md` and `legacy/continuations/02-leogreen-kiosk.md`, update `legacy/README.md`, and make the four redirects 301; verify `docker compose -f legacy/docker-compose.yaml config -q` exits 0 and a search of `legacy/` for the removed folder names finds only intended mentions. Done 2026-10-19 on `chore/legacy-remove-kiosks` (`e16f393`): `config -q` exits 0 with 9 services; `nginx -t` passes in a throwaway container and all four addresses answer 301 to `/kiosk/` with the query kept; `affected.test.sh` passes (35 checks); remaining mentions are the redirects, `legacy/README.md` (removed parts), the smoke routes (they now check the redirects) and the old notes `legacy/project_overview.md` and `legacy/as-built-specs/README.md`
- [x] 6.2 **(human, vm23)** Release the removal (since 2026-10-14 the deployment of `platform-cicd-pipeline` runs `docker compose up -d --remove-orphans` per unit after a `main` → `release` pull request), apply the nginx change and reload; verify the five containers are gone, ports 8082 to 8085 and 8087 are free, `/kiosk/` still shows data and `/dashboard/` and `/` still work. Done 2026-10-19: release #63 deployed `efcaeb3`, the five containers are gone, ports 8082 to 8087 are free, `/kiosk/`, `/dashboard/` and `/` answer 200; Daniel installed `legacy/deploy/nginx.conf` on the host (identical to the repo by `diff`, backup `~/nginx-before-301.conf`) and reloaded; `/leogreen`, `/kiosk2`, `/kiosk3` and `/kiosk4` answer 301 to `/kiosk/` with the query kept
- [x] 6.3 Open a GitHub issue for rebuilding the PV views of `/dashboard/` in `leoiot-pv/` and link it from `leoiot-pv/README.md`; verify the link resolves. Done 2026-10-19: issue #64, linked from `leoiot-pv/README.md` in #66
- [x] 6.4 Update the kiosk addresses on the documentation site (`architecture`, `setup`, `operations`, `interfaces`, `project` in both languages, and the architecture diagrams); verify `npm run build` at the root exits 0 and a search of `src/` for `/leogreen`, `/kiosk2`, `/kiosk3` and `/kiosk4` finds only statements about the redirect. Text pages done 2026-10-19 in #66 (build passes, search finds only the redirect and removal statements); the architecture diagram followed on 2026-10-19 on `docs/architecture-diagram`: it builds on Daniel's redrawing (`da1dfba`, site colours, light and dark variant), adds the `leoiot-pv` collector and kiosk (kiosk reads InfluxDB and the bridge, serves `/kiosk/`), and the page shows the variant that matches the theme; build passes, the search finds only the redirect statements
- [ ] 6.5 Sync the spec to `openspec/specs/pv/main-kiosk/spec.md`; verify `openspec list --specs` shows `pv/main-kiosk`
