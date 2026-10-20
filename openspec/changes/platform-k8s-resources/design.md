# Design

> Based on a snapshot of vm23 taken on 2026-10-20 (Context). Figures marked *est.* belong to services that do not run anywhere yet. The short version for the teacher is `resource-request.md`; this document holds the reasoning behind it.

## Resource request (summary)

| | CPU | Memory | Storage |
|---|---|---|---|
| Sum of requests | 400 m (0.4 cores) | 1024 MiB | |
| Sum of limits | 3700 m (3.7 cores) | 2624 MiB | |
| Persistent volumes | | | 27 GiB (database 25 GiB, broker 1 GiB, Grafana 1 GiB) |
| Backup storage outside the cluster | | | 11 × backup size: 25 GiB today, about 95 GiB after 24 months |

Requested from the school: **0.5 cores and 1 GiB guaranteed, up to 4 cores and 3 GiB, 27 GiB persistent storage and 30 GiB backup storage outside the cluster, growing to about 100 GiB within two years.** As a single VM: 2 vCPU, 4 GiB RAM, 60 GB disk (system and Docker 20 GB, images 5 GB, database 25 GB, reserve) and the backup storage elsewhere.

## Context

Today everything runs on vm23 as two Docker Compose projects (`legacy/docker-compose.yaml`, `leoiot-pv/compose.yaml`) behind the host's nginx. No container has a CPU or memory limit. The legacy frontends run Vite dev servers that execute `npm install` on every start, so their current usage says little about the built images that will run in the cluster.

The database is InfluxDB 2.7 with one bucket `server_data` and no retention limit (`platform/data-contract`). It receives one PV point per minute from the collector and, through Telegraf, every reading published on the sensor topics (`nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#`, `room-temperature`). The legacy simulators (`quarkus-app`, `fake-sensors`) publish room temperatures every 10 seconds, and those end up in the same bucket.

The backup today is `legacy/backup/backup.sh`: a weekly cron job runs `influx backup`, copies the result to `$HOME/influxdb-backups` on vm23 and keeps the newest 8. The token is written into the script, and the copies are on the same VM as the database.

Snapshot of vm23 (2026-10-20, school hours, `docker stats --no-stream`, VM with 3.8 GiB RAM):

| Container | CPU | Memory | Moves to |
|---|---|---|---|
| `influxdb` | 0.38 % | 168.2 MiB | row 2 |
| `grafana` | 0.45 % | 156.4 MiB | row 5 |
| `frontend` (Vite dev server) | 0.00 % | 154.8 MiB | row 10, as a built image |
| `quarkus-app` | 0.32 % | 118.6 MiB | row 9 (comparable Java service) |
| `leoiot-pv-collector` | 0.00 % | 40.1 MiB | row 6 |
| `telegraf` | 0.31 % | 35.3 MiB | row 3 |
| `mqtt-ws-bridge` | 0.18 % | 33.5 MiB | row 4 |
| `fake-sensors` | 0.00 % | 28.4 MiB | not counted (open question) |
| `dashboard-v2` (Vite dev server) | 0.00 % | 26.0 MiB | rows 8 and 9 |
| `mosquitto` | 0.15 % | 4.4 MiB | row 1 |
| `leoiot-pv-kiosk` | 0.00 % | 2.0 MiB | rows 7 and 8 |
| **Sum** | **1.8 %** | **768 MiB** | |

| Storage on vm23 | Value |
|---|---|
| InfluxDB data directory | 5.6 GiB |
| Backups in `$HOME/influxdb-backups` | 8 backups (weekly since 2026-07-26, gap in August and September), 18 GiB together, about 2.3 GiB each |
| Host disk | 98 GiB, 79 GiB used (85 %), 15 GiB free |

The per-bucket and per-shard sizes are missing: the command was sent as a chat message, which removed the `*` characters. The growth is therefore the average since the database exists: Telegraf and InfluxDB were added to the stack on 2026-01-26, so 5.6 GiB in about 8.8 months is **about 0.65 GiB per month**.

Local measurement of the new images (2026-10-19, Docker Desktop, idle, empty database, 12 samples):

| Container | CPU | Memory | Image size |
|---|---|---|---|
| `eclipse-mosquitto:2` | < 0.1 % | 3.8 MiB | 21 MB |
| `influxdb:2.7` (empty) | < 0.1 % | 209 MiB | 393 MB |
| `leoiot-pv` kiosk (nginx) | 0 % | 10.1 MiB | 68 MB |
| `leoiot-pv` dashboard (nginx) | 0 % | 10.1 MiB | 68 MB |

## Goals / Non-Goals

**Goals:**

- One table of all cluster services with requests, limits and volumes that the school can approve.
- A measurement method that anyone with access to vm23 can repeat without database credentials.
- A backup concept that survives the loss of the database volume and of the node.

**Non-Goals:**

- Writing Kubernetes manifests or choosing between plain manifests, Kustomize and Helm.
- Autoscaling. Every service runs with one replica; the load (a few kiosks and browsers in one school) does not need more.
- High availability of the database. A failed node means downtime until it is rescheduled; the backup covers data loss, not uptime.

## Decisions

### D1 Service inventory

The cluster runs the built images of the new sub-projects, not the legacy dev servers. The ingress controller of the cluster replaces the host nginx and is not counted here.

| # | Service | Sub-project | Replaces in `legacy/` | Basis |
|---|---|---|---|---|
| 1 | MQTT broker (Mosquitto) | platform | `mosquitto` | measured on vm23 |
| 2 | Database (InfluxDB 2.7) | platform | `influxdb` | measured on vm23 |
| 3 | Ingest (Telegraf, MQTT → database) | platform | `telegraf` | measured on vm23 |
| 4 | WebSocket bridge (`/ws`) | platform | `mqtt-ws-bridge` | measured on vm23 |
| 5 | Grafana | platform | `grafana` | measured on vm23; only if kept (open question) |
| 6 | PV collector | pv | (SolaX polling) | measured on vm23 |
| 7 | PV kiosk (`/kiosk/`) | pv | kiosk apps | measured on vm23 |
| 8 | PV dashboard (`/pv/`) | pv | PV views of `dashboard-v2` | image measured locally; same nginx image type as the kiosk |
| 9 | Sensor service(s) | sensors | `quarkus-app`, sensor views of `dashboard-v2` | *est.* from `quarkus-app` on vm23, not built yet |
| 10 | 3D building model (`/`) | 3d | `frontend` | *est.*, static files behind nginx like the kiosk |
| 11 | Backup job (daily, minutes) | platform | `legacy/backup/` | *est.* |

`fake-sensors` and the sine generator in `quarkus-app` produce test data. They are not listed: whether simulated readings run in the cluster at all is decided by the sensors team (open question).

*Alternative considered:* counting the legacy containers one to one. Rejected, because the dev servers need several hundred MiB each for `npm install` and Vite, which would inflate the request for code that will not run in the cluster.

### D2 Requests and limits

| # | Service | CPU request | CPU limit | Memory request | Memory limit | Volume |
|---|---|---|---|---|---|---|
| 1 | Mosquitto | 10 m | 200 m | 32 MiB | 128 MiB | 1 GiB |
| 2 | InfluxDB | 100 m | 1000 m | 256 MiB | 1024 MiB | 25 GiB (D4) |
| 3 | Telegraf | 20 m | 200 m | 64 MiB | 128 MiB | – |
| 4 | WebSocket bridge | 20 m | 200 m | 64 MiB | 256 MiB | – |
| 5 | Grafana | 50 m | 500 m | 192 MiB | 256 MiB | 1 GiB |
| 6 | PV collector | 20 m | 200 m | 64 MiB | 128 MiB | – |
| 7 | PV kiosk | 10 m | 100 m | 32 MiB | 64 MiB | – |
| 8 | PV dashboard | 10 m | 100 m | 32 MiB | 64 MiB | – |
| 9 | Sensor service(s) | 50 m | 500 m | 128 MiB | 256 MiB | – |
| 10 | 3D model | 10 m | 200 m | 32 MiB | 64 MiB | – |
| 11 | Backup job | 100 m | 500 m | 128 MiB | 256 MiB | – |
| | **Sum** | **400 m** | **3700 m** | **1024 MiB** | **2624 MiB** | **27 GiB** |

Rules (`platform/resource-requirements`): the memory request is the typical use, the memory limit at least 1.5 × the highest use measured. CPU requests are low because every service idles most of the time; CPU limits are generous because exceeding them only throttles, while exceeding a memory limit kills the container.

Every measured service uses less than its request, and every limit is at least 1.5 × the measured value (Grafana: 156 MiB measured, 192 MiB request, 256 MiB limit). All CPU values on vm23 are below 0.5 % of a core, so the CPU requests are the smallest sensible values. InfluxDB keeps the largest limit (6 × the snapshot) because its memory grows with the number of series and with query load, for example the weekly views of the kiosks and dashboards or a compaction of the 5.6 GiB of data.

*Alternative considered:* no limits, only requests. Rejected: one runaway container (for example a query over the whole bucket) could then take the memory of every other service on the node.

### D3 Measuring vm23

vm23 is measured with one snapshot command, run by a team member with access during school hours, when the kiosks and dashboards are in use. It needs no database token and changes nothing. Its output is sent as a file or screenshot, not pasted into a chat that formats `*`:

```bash
docker stats --no-stream; docker exec influxdb sh -c 'du -sh /var/lib/influxdb2/engine/data/*; du -sk /var/lib/influxdb2/engine/data/*/autogen/*'; ls -l --full-time ~/influxdb-backups/ 2>/dev/null; du -sh ~/influxdb-backups/* 2>/dev/null; df -h /
```

- `docker stats --no-stream`: CPU and memory of every running container at that moment.
- Size of the InfluxDB data directory per bucket and per shard. InfluxDB stores data in time-based shards (one week each without retention; shard ids grow with time), so the shard sizes show the growth per week back to the start.
- Size and dates of the existing backups in `$HOME/influxdb-backups`, which give the backup size for D5, and the free space of the host.

A snapshot shows no peaks. The limits therefore stay at least 1.5 × the measured value, and `platform/resource-requirements` requires a comparison with the real usage four weeks after the move. If the snapshot looks unusual, `measure-vm23.sh` (in this change) samples the same figures every minute for a given time (default 24 hours) and adds the time ranges of the shards.

*Alternative considered:* reading the figures from Grafana or InfluxDB's own metrics. Rejected because there is no container metrics collection on vm23 today, and setting one up is a change to the running system.

### D4 Storage

The PV readings are kept without limit, so volumes are sized for the current data plus 24 months of growth:

```
database volume = current size + 24 × growth per month (+ 20 % for compaction and WAL)
```

With the vm23 figures: 5.6 GiB + 24 × 0.65 GiB = 21.2 GiB, plus 20 % = 25.4 GiB, stated as **25 GiB**. PV alone writes 7 values per minute, a few dozen MB per year; almost all of the growth comes from the sensor readings, including the simulated room temperatures of `quarkus-app` and `fake-sensors`. The growth is an average since January 2026; if sensors were added over time, the current rate is higher, which the check after the move (`platform/resource-requirements`) catches.

A retention limit for sensor readings (for example 12 months at full resolution and a downsampled copy beyond that), or not storing simulated readings at all, would cap the volume and the backups. Either is a change to `platform/data-contract` and not part of this change.

### D5 Backup

| Question | Answer |
|---|---|
| What | the whole InfluxDB instance: all buckets and the metadata (organisations, users, tokens), with `influx backup` |
| Not backed up | broker persistence, images, static apps, provisioned Grafana dashboards: rebuilt from the repository or republished by the collectors within a minute |
| How often | daily, 02:00, as a Kubernetes CronJob (data loss in the worst case: one day) |
| Where | outside the cluster: an S3-compatible bucket or a share the school provides (open question), copied as part of the job |
| How long | 7 daily and 4 weekly backups, i.e. 11 copies; older ones are deleted by the job |
| Credentials | an operator token (required for the metadata) as a cluster secret; a copy of all platform secrets is kept by the teacher or the project lead outside the cluster |
| Failure | the CronJob fails visibly (`kubectl get jobs`, failed-job alert if the cluster offers one) |

Backup storage = 11 × size of one backup. On vm23 one backup is about 2.3 GiB for 5.6 GiB of data (18 GiB for 8 backups), a ratio of about 0.4. Today that is 11 × 2.3 GiB ≈ 25 GiB, requested as 30 GiB. After 24 months the database holds about 21 GiB, one backup about 8.5 GiB, and 11 backups about 95 GiB.

The current backups use 18 GiB on vm23's disk, which has only 15 GiB left (85 % used). Moving them off the VM, as this concept requires, also removes the most pressing disk risk on vm23.

*Alternative considered:* keeping the weekly schedule of `legacy/backup/`. Rejected: one backup a week risks losing up to seven days of readings, and a daily backup costs only storage, which is cheap at this data size.

*Alternative considered:* storing backups on a second volume in the cluster. Rejected: a volume of the same storage class can fail together with the database volume (`platform/backup`: kept away from the data).

### D6 Restore and the restore test

Restore in the cluster (documented, not run before the move):

1. Scale the services that write (collector, Telegraf) to zero.
2. Copy the chosen backup from the backup storage into the InfluxDB pod.
3. `influx restore --full <dir>` with the operator token. `--full` replaces all data and metadata, including the tokens.
4. Query `solax_stats` for the day of the backup and check the values; scale the writers up again.

Restore test before the move (criterion 5 of #54): the procedure was tested on 2026-10-20 with a local backup of test data restored into a separate instance; it passed (`restore-test.md`, test 1). If a backup of vm23 is made available, the same test is repeated with it on a team member's computer, never on vm23 or against the production database, and recorded as test 2.

## Risks / Trade-offs

- [A snapshot misses peaks, such as many browsers during an open day or a database compaction] → Limits are at least 1.5 × the measured value, and `platform/resource-requirements` requires a check four weeks after the move.
- [The growth is an average since January 2026 and the current rate may be higher] → The database volume is checked at 80 % fill (`platform/resource-requirements`); the shard sizes can be measured later with `measure-vm23.sh`.
- [The full restore also replaces tokens, so services lose access if the backup is older than a token change] → The restore steps check the tokens of the writers and readers after the restore; token changes are rare.
- [A restore test with real data on a private computer] → The bucket holds only room-climate and PV readings, no personal data; the copy is deleted after the test and the backup's tokens are not used outside it.
- [The sensor and 3D figures come from services that do not exist yet] → Marked *est.*; the owning teams confirm or replace them before merge.

## Migration Plan

No running service changes. The figures are used by the later Kubernetes deployment change. `legacy/backup/` and the cron job on vm23 stay until the CronJob in the cluster has made its first successful backup and one restore from it has been tested.

## Open Questions

- Which cluster does the school provide: number of nodes, storage class, does it bring an ingress controller and a container metrics service?
- Where can backups be stored outside the cluster (S3-compatible storage, network share, a second VM)?
- Does Grafana move to the cluster, or is it dropped once the new dashboards exist?
- Do the simulated readings (`fake-sensors`, `quarkus-app`) run in the cluster? (sensors team)
