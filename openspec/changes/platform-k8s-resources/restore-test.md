# Restore test

Record required by `platform/backup` ("The restore is documented and proven") and criterion 5 of issue #54.

## Test 1: local, test data (2026-10-20)

| | |
|---|---|
| Date | 2026-10-20 |
| Performed by | Stefan Schachner, with Claude Code |
| Where | local Docker (Docker Desktop, macOS), two separate `influxdb:2.7` containers; vm23 not touched |
| Data | test data written for the test: 28 days of `solax_stats` (one point per minute, all seven fields, 282 240 values) and `room_temperature` for 20 rooms every 10 s (4 838 400 values) in org `leoiot`, bucket `server_data` |
| Backup | `influx backup` of the whole source instance: 5 shard files, metadata (`bolt`, `sqlite`) and manifest; 396 KiB |
| Backup duration | 0.3 s |
| Restore | into a second, freshly set-up instance with a different org, bucket and operator token: `influx restore --full` |
| Restore duration | 0.2 s |
| Result | **passed** |

Checks after the restore:

| Check | Expected | Result |
|---|---|---|
| Values per measurement, last 30 days | as written | `solax_stats` 282 240, `room_temperature` 4 838 400 ✔ |
| `solax_stats` on 2026-10-17, per field | 1440 points for each of the seven fields | 1440 × 7 ✔ |
| Token of the source instance | works on the restored instance | ✔ (queries above ran with it) |
| Metadata of the target instance | replaced by the backup | the target's own org and bucket are gone; only `_monitoring`, `_tasks`, `server_data` remain ✔ |

Findings:

- `--full` replaces all metadata, including users and tokens. After a restore in the cluster, every service keeps working only if its token existed when the backup was taken (`design.md`, Risks).
- Data written seconds before the backup was included, so the backup also covers data that InfluxDB had not yet compacted to disk.
- The test data is far more regular than real readings and therefore compresses much better. The backup size here (396 KiB) says nothing about real backups; the size of the backups on vm23 is used instead (`design.md`, D5).

Steps used (same as `design.md`, D6, without the cluster parts):

```bash
# source instance with data
docker exec <source> influx backup --token <operator token> /backups/test
docker cp <source>:/backups/test ./backup
# separate target instance, set up with throwaway credentials
docker cp ./backup <target>:/tmp/restore
docker exec <target> influx restore --token <target operator token> --full /tmp/restore
docker exec <target> influx query --token <source token> --org leoiot '<count query>'
# afterwards: docker rm -f <source> <target>; rm -rf ./backup
```

## Test 2: real backup from vm23 (open)

To be recorded here if a backup of vm23 is made available: date, backup used, size, duration and the result of the same checks.
