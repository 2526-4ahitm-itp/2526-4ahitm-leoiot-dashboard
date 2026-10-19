# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin`. This change starts only after `platform-data-contract-pv` is merged and `pv-main-kiosk` has created `leoiot-pv/compose.yaml`.

## 1. Collector core

- [x] 1.1 Create `leoiot-pv/collector/` with `package.json`, TypeScript and Vitest configuration and a README stub; verify `npm ci` and an empty `npm test` exit 0
- [x] 1.2 Implement the pure functions that check a cloud answer for completeness and turn it into the contract's database point and live message; verify unit tests cover a complete answer, each missing value, a non-numeric value and the `consumption` formula with the example values from `platform/data-contract`
- [x] 1.2a Log a counter that is lower than in the previous reading of the same day without changing the value; verify a unit test shows the value is delivered unchanged and the log line names the field and both values
- [x] 1.3 Implement reading the configuration from the environment with a clear error for each missing variable; verify a test for every required variable shows the process exits with that variable's name

## 2. Adapters and loop

- [x] 2.1 Implement the SolaX cloud adapter (login, data request, new login after any authorisation failure); verify tests against a local fake server cover a successful request, a rejected session followed by a new login, a failed login and an unreachable server
- [x] 2.2 Implement the database adapter and the broker adapter; verify tests assert the exact line sent to a fake database endpoint and the topic, payload and retained flag of the published message, and that a failed write or an unreachable broker does not throw out of the cycle
- [x] 2.3 Implement the one-minute loop with the last-delivery marker and the settings for bucket name and publishing; verify a test with a fake clock shows one delivery per minute, that an hour of cloud failures is followed by a delivery in the first minute after recovery, and that nothing is published when publishing is off
- [x] 2.4 Verify the dependency rule: a search of `leoiot-pv/collector/` for `legacy` finds nothing and no file contains a credential

## 3. Container and deployment files

- [x] 3.1 Add the `Dockerfile` and the service `collector` to `leoiot-pv/compose.yaml` (restart policy, health check on the last-delivery marker, test bucket and publishing off as defaults) and the variable names to `leoiot-pv/.env.example`; verify `docker compose config -q` exits 0 with a complete `.env` and names the variable without one
- [x] 3.2 Run the container against a local legacy stack with a test bucket; verify points with all seven fields arrive once a minute in the test bucket, the container reports healthy, and it reports unhealthy within six minutes after the cloud address is made unreachable
- [x] 3.3 Complete `leoiot-pv/collector/README.md` and the collector section of `leoiot-pv/README.md`: what it does, its variables, how to run tests and the container, how to read its health; verify every command in them runs as written

## 4. Check against the real cloud (revised 2026-10-14, see design D7)

- [x] 4.1 Create the bucket `pv_shadow` and a token that can only write to it; verify a write to `pv_shadow` is accepted, a write to `server_data` and a query are refused. Done 2026-10-14
- [x] 4.2 Run the new collector for a few minutes against the real cloud into a test bucket without publishing and compare its points with the legacy points of the same minutes; verify all seven fields agree. Done 2026-10-14 05:23 and 05:24 UTC: identical in all seven fields. Finding: the cloud keeps one session per account, the run cost production one point (05:23:33 UTC); no further run against the real cloud while the legacy collector runs
- [x] 4.3 Record one complete live message of the legacy collector (from the WebSocket channel or the retained topic) and add a test that feeds the same cloud answer to the new collector; verify the published message carries every field of the old one with the same values

## 5. Switch

- [x] 5.1 Change the Compose defaults to the production bucket with publishing on, right before the switch; verify the diff changes only those two settings
- [x] 5.2 **(human, vm23)** During daylight: add the collector variables to `leoiot-pv/.env` on the host (write token for `server_data`), stop the legacy service `solax-collector`, confirm it is stopped, pull and start the new collector, check its log for code 10402; verify `solax_stats` in `server_data` has no gap longer than two minutes, the kiosk at `/kiosk/` shows a current "Zuletzt aktualisiert" and `/dashboard/` shows PV values
- [ ] 5.3 Observe for one week with the legacy service stopped but still defined; verify on two different days that the collector is healthy, has not restarted, and that the previous day's totals on the kiosk match the SolaX portal

## 6. Remove the legacy collector

- [x] 6.1 In a separate pull request remove `legacy/solax-collector/` and its service from `legacy/docker-compose.yaml` and update `legacy/README.md`; verify `docker compose -f legacy/docker-compose.yaml config -q` exits 0 and a search of `legacy/` for `solax-collector` finds only intended mentions. Done by Elias Pointinger in #59 (2026-10-14); the deployment of 2026-10-15 removed the container. Checked 2026-10-19: `config -q` exits 0; remaining mentions are the removal note in `legacy/README.md` and the old notes `legacy/project_overview.md` and `legacy/as-built-specs/`
- [ ] 6.2 **(human, vm23)** Pull, run `docker compose up -d --remove-orphans` from `legacy/` and delete the bucket `pv_shadow`; verify the legacy collector container is gone, the bucket `pv_shadow` is deleted and new points keep arriving in `server_data`
- [ ] 6.3 Update the collector's description on the documentation site (`architecture` and `operations` in both languages); verify `npm run build` at the root exits 0
- [ ] 6.4 Sync the spec to `openspec/specs/pv/solax-collector/spec.md`; verify `openspec list --specs` shows `pv/solax-collector`
