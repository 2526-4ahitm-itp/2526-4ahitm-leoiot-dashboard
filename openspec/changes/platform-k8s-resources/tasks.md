# Tasks

## 1. Service inventory

- [x] 1.1 Compare the service list in `design.md` (D1) with the containers in the `docker stats` output of vm23; verify every running container is either listed or named as not moving (column "Moves to" in the Context of `design.md`)
- [ ] 1.2 Ask the sensors and 3D teams to confirm or replace rows 9 and 10 of D2 and the open questions on the simulators and Grafana; verify by their comment on the pull request

## 2. Measurement on vm23

- [x] 2.1 Have a team member with access run the snapshot command of `design.md` (D3) on vm23 during school hours and send the full output; verify it contains `docker stats`, the bucket and shard sizes, the backups and `df` (received 2026-10-20; the shard sizes are missing because the chat removed the `*`, see 2.4)
- [x] 2.2 Enter CPU and memory per container in the Context of `design.md` and the totals in `resource-request.md`; verify every container of 1.1 has a row
- [x] 2.3 Replace the estimates in D2 of `design.md` for every measured service following `platform/resource-requirements` (request ≥ measured use, limit ≥ 1.5 × measured use) and update the sums and the summary of `resource-request.md`; verify by recomputing the sum rows
- [x] 2.4 Compute the database size and the growth per month (average since 2026-01-26, as the shard sizes are missing), fill in D4 and `resource-request.md` with the formula and its inputs; verify the volume holds current size + 24 months of growth + 20 %

## 3. Backup concept

- [x] 3.1 Take the backup size from the output (18 GiB for 8 backups), compute 11 × backup size today and after 24 months and update D5 and `resource-request.md`; verify the summary matches D2, D4 and D5
- [ ] 3.2 Ask the teacher the open questions at the end of `resource-request.md` and record the answers in D5 and `resource-request.md`; verify each question is answered or still listed with the person asked

## 4. Restore test

- [x] 4.1 Back up an InfluxDB 2.7 instance with four weeks of test data, restore it with `influx restore --full` into a separate instance, check counts, one day of `solax_stats` and the tokens, and record it in `restore-test.md` (test 1, passed 2026-10-20)
- [ ] 4.2 If a backup of vm23 is made available, repeat 4.1 with it on a local machine and record it as test 2 in `restore-test.md`; delete the local copy afterwards and verify `docker ps -a` and the folder no longer show it

## 5. Hand-over

- [x] 5.1 Replace the preliminary status in `resource-request.md` and `design.md` once group 2 is done; verify every remaining *est.* names its reason
- [x] 5.2 Run `openspec validate platform-k8s-resources --strict`; verify it passes
- [ ] 5.3 Present `resource-request.md` to the teacher (Markdown or exported as PDF) and link it in issue #54; verify the issue's six criteria are checked off

## Workflow follow-up

- Merge the pull request after review by the project lead.
- Archive the change with `/opsx:archive` so that `platform/resource-requirements` and `platform/backup` enter `openspec/specs/`.
- Close issue #54.
