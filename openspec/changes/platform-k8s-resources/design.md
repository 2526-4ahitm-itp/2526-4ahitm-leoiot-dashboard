# Design

> **Status: preliminary.** The figures marked *est.* are estimates from local measurements of the images and from comparable services. They are replaced by a snapshot measurement of vm23 (task group 2). The version for the teacher is `resource-request.md`; this document holds the reasoning behind it.

## Resource request (summary)

| | CPU | Memory | Storage |
|---|---|---|---|
| Sum of requests | 550 m (0.55 cores) | 1216 MiB | |
| Sum of limits | 3700 m (3.7 cores) | 2624 MiB | |
| Persistent volumes | | | 12 GiB *est.* (database 10 GiB, broker 1 GiB, Grafana 1 GiB) |
| Backup storage outside the cluster | | | 11 × backup size, 25 GiB *est.* |

Requested from the school: **1 core and 1.5 GiB guaranteed, up to 4 cores and 3 GiB, 12 GiB persistent storage in the cluster and 25 GiB backup storage outside it.** These numbers are the rounded totals of the tables below.

## Context

Today everything runs on vm23 as two Docker Compose projects (`legacy/docker-compose.yaml`, `leoiot-pv/compose.yaml`) behind the host's nginx. No container has a CPU or memory limit. The legacy frontends run Vite dev servers that execute `npm install` on every start, so their current usage says little about the built images that will run in the cluster.

The database is InfluxDB 2.7 with one bucket `server_data` and no retention limit (`platform/data-contract`). It receives one PV point per minute from the collector and, through Telegraf, every reading published on the sensor topics (`nili3/#`, `nili3_co2/#`, `homeassistant/#`, `esphome/#`, `room-temperature`). The legacy simulators (`quarkus-app`, `fake-sensors`) publish room temperatures every 10 seconds, and those end up in the same bucket.

The backup today is `legacy/backup/backup.sh`: a weekly cron job runs `influx backup`, copies the result to `$HOME/influxdb-backups` on vm23 and keeps the newest 8. The token is written into the script, and the copies are on the same VM as the database.

Local measurement (2026-10-19, Docker Desktop, idle, empty database, 12 samples):

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
| 1 | MQTT broker (Mosquitto) | platform | `mosquitto` | image measured |
| 2 | Database (InfluxDB 2.7) | platform | `influxdb` | image measured empty |
| 3 | Ingest (Telegraf, MQTT → database) | platform | `telegraf` | *est.* |
| 4 | WebSocket bridge (`/ws`) | platform | `mqtt-ws-bridge` | *est.*, Node service |
| 5 | Grafana | platform | `grafana` | *est.*, only if kept (open question) |
| 6 | PV collector | pv | (SolaX polling) | *est.*, Node 22 image |
| 7 | PV kiosk (`/kiosk/`) | pv | kiosk apps | image measured |
| 8 | PV dashboard (`/pv/`) | pv | PV views of `dashboard-v2` | image measured |
| 9 | Sensor service(s) | sensors | `quarkus-app`, sensor views of `dashboard-v2` | *est.*, not built yet |
| 10 | 3D building model (`/`) | 3d | `frontend` | *est.*, static files behind nginx like the kiosk |
| 11 | Backup job (daily, minutes) | platform | `legacy/backup/` | *est.* |

`fake-sensors` and the sine generator in `quarkus-app` produce test data. They are not listed: whether simulated readings run in the cluster at all is decided by the sensors team (open question).

*Alternative considered:* counting the legacy containers one to one. Rejected, because the dev servers need several hundred MiB each for `npm install` and Vite, which would inflate the request for code that will not run in the cluster.

### D2 Requests and limits

| # | Service | CPU request | CPU limit | Memory request | Memory limit | Volume |
|---|---|---|---|---|---|---|
| 1 | Mosquitto | 10 m | 200 m | 32 MiB | 128 MiB | 1 GiB |
| 2 | InfluxDB | 250 m | 1000 m | 512 MiB | 1024 MiB | 10 GiB *est.* (D4) |
| 3 | Telegraf | 20 m | 200 m | 64 MiB | 128 MiB | – |
| 4 | WebSocket bridge | 20 m | 200 m | 64 MiB | 256 MiB | – |
| 5 | Grafana | 50 m | 500 m | 128 MiB | 256 MiB | 1 GiB |
| 6 | PV collector | 20 m | 200 m | 64 MiB | 128 MiB | – |
| 7 | PV kiosk | 10 m | 100 m | 32 MiB | 64 MiB | – |
| 8 | PV dashboard | 10 m | 100 m | 32 MiB | 64 MiB | – |
| 9 | Sensor service(s) | 50 m | 500 m | 128 MiB | 256 MiB | – |
| 10 | 3D model | 10 m | 200 m | 32 MiB | 64 MiB | – |
| 11 | Backup job | 100 m | 500 m | 128 MiB | 256 MiB | – |
| | **Sum** | **550 m** | **3700 m** | **1216 MiB** | **2624 MiB** | **12 GiB** |

Rules (`platform/resource-requirements`): the memory request is the typical use, the memory limit at least 1.5 × the highest use measured. CPU requests are low because every service idles most of the time; CPU limits are generous because exceeding them only throttles, while exceeding a memory limit kills the container.

InfluxDB gets the largest share because its memory grows with the number of series and with query load (the weekly views of the kiosks and dashboards). The empty instance already uses 209 MiB; the vm23 figure replaces the estimate.

*Alternative considered:* no limits, only requests. Rejected: one runaway container (for example a query over the whole bucket) could then take the memory of every other service on the node.

### D3 Measuring vm23

vm23 is measured with one snapshot command, run by a team member with access during school hours, when the kiosks and dashboards are in use. It needs no database token and changes nothing:

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

Estimate until vm23 is measured: PV alone writes 7 values per minute, about 3.7 million values per year, a few dozen MB. The sensor readings dominate: 100 rooms every 10 seconds are about 315 million values per year, roughly 1 GB on disk. 10 GiB therefore holds several years at today's rate; the measured shard growth decides.

A retention limit for sensor readings (for example 12 months at full resolution and a downsampled copy beyond that) would cap the volume. It is a change to `platform/data-contract` and not part of this change.

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

Backup storage = 11 × size of one backup. `influx backup` writes compressed shard files, so one backup is about the size of the data directory. With 2 GiB of data that is 22 GiB; 25 GiB is requested until the vm23 figure is known.

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

- [The estimates are wrong by a large factor before vm23 is measured] → The summary is marked preliminary and is not handed over until task group 2 is done.
- [24 hours of measurement miss peaks, such as many browsers during an open day] → Limits are at least 1.5 × the peak, and `platform/resource-requirements` requires a check four weeks after the move.
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
