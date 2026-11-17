# Infrastructure: production server sizing

How much storage and hardware a production server for LeoIoT needs. The figures are an estimate for **50 rooms with one nili sensor box each, over one year**. Measurements on vm23 were taken on 2026-11-17.

## Summary

| What | Recommendation |
|---|---|
| Server | VM with 2–4 vCPU, 8 GB RAM, 80 GB SSD |
| InfluxDB data, 50 rooms, 1 year | about 6 GB (12 GB if the legacy history is copied over) |
| Backup storage, on another machine | about 30–50 GB |

## What gets stored

The new system writes two measurements into the bucket `server_data` (`openspec/specs/platform/data-contract/spec.md`):

```
 sensor box (nili)              PV collector
 co2, temperature, humidity     7 kWh fields
 every 10 s (ESPHome)           every 60 s
        │                              │
        ▼                              ▼
 room_climate: one point per value   solax_stats: one point per minute
 tags: device, room, source          tag: plant_id
        └───────────────┬──────────────┘
                        ▼
               bucket server_data (no expiry)
```

- The sensors collector stores only `co2`, `temperature` and `humidity` (`leoiot-sensors/collector/devices.json`). The other values the box publishes (pressure, illuminance, WiFi signal) are not stored.
- The 3D temporary simulator only publishes to the broker and stores nothing.

## Storage for 50 rooms over one year

```
1 nili box:  3 values every 10 s = 25,920 values a day = 9.46 M values a year
50 boxes:    9.46 M × 50 = 473 M values a year
PV:          + 3.7 M values a year
```

| | Optimistic (4 bytes per value) | Conservative (10 bytes per value) |
|---|---|---|
| 50 rooms | 1.9 GB | 4.7 GB |
| PV | 0.015 GB | 0.04 GB |
| +20 % for WAL, index and compaction | 2.3 GB | **5.7 GB** |

**Plan for 6 GB of database storage in the first year.** The conservative rate is about 0.4 GB a month.

### Assumptions

- **Bytes per value.** The 4–10 bytes per value on disk is an estimate for InfluxDB 2.7 TSM files, with timestamps at the time of receipt (millisecond precision, irregular). It has not been measured yet: see "Open points".
- **Send interval.** The boxes send every 10 s, as nili3 does today. At 60 s the year needs about 1 GB.
- **Fresh start.** The new server starts without the legacy history. Copying the whole legacy bucket adds about 6.2 GiB. Most of it is legacy data (Telegraf stored every value of `nili3/#`, `homeassistant/#` and `esphome/#`, and the simulators wrote room temperatures every 10 s), not `room_climate` or `solax_stats`.

### Other scenarios

At 10 bytes per value, without a retention limit:

| Boxes | Per year | After 3 years | After 5 years |
|---|---|---|---|
| 1 | 0.13 GB | 0.4 GB | 0.7 GB |
| 10 | 1 GB | 3 GB | 5 GB |
| 50 | 5 GB | 15 GB | 25 GB |
| 107 (every room of the building model) | 10 GB | 31 GB | 52 GB |

The data contract requires room-climate readings to be kept for at least 13 months and PV readings for at least 8 days. Today the bucket has no expiry. If raw data were kept for 13 months and only 5-minute means after that, 107 rooms would stay at about 11 GB plus 0.35 GB a year. That would be a change to `platform/data-contract`.

## Backups

- **Size of one backup.** On vm23, an `influx backup` is about 0.4 × the data size. After one year with 50 rooms, that is about 2.3 GB per backup.
- **How many to keep.** Keeping 11 backups, as planned in D5 of `openspec/changes/platform-k8s-resources/design.md`, needs up to about **25 GB**.
- **Where to keep them.** Backups belong on another machine or storage (NAS, S3-compatible storage, a second VM), not on the disk of the database.

## Hardware recommendation

| | Minimum | **Recommended** | Why |
|---|---|---|---|
| CPU | 2 vCPU | **2–4 vCPU** | Normal load is tiny (all containers on vm23 together use < 2 % of a core). The peaks come from image builds during deployment and from long-range queries in the dashboards. |
| RAM | 4 GB | **8 GB** | Everything on vm23 used 768 MiB together (2026-10-20). InfluxDB needs more while it compacts data and answers long queries, and image builds need room too. |
| Disk | 40 GB SSD | **80 GB SSD** | See below. Use an SSD, not an HDD: InfluxDB reads and writes many small blocks. |
| Backup | 30 GB elsewhere | **30–50 GB elsewhere** | Not on the same disk as the database. |
| Network | school LAN | school LAN with HTTPS | 50 boxes send about 15 points a second, which is negligible. |

### Disk layout

```
OS (Ubuntu LTS)                    10 GB
Docker images + build cache        10 GB   vm23: 5.5 GB images, 3.9 GB build cache
Container logs, temp files          5 GB
InfluxDB (50 rooms, 1 year)         6 GB   with legacy history: 12 GB
Room for year 2 and 3              12 GB
───────────────────────────────────────
In use after about 3 years        ~45 GB   about 55 % of 80 GB
```

Keep the disk below 70 % full. InfluxDB needs free space for a short time while it compacts data, and a full disk can stop the database.

### Why this is enough

- **Writes:** 50 boxes × 3 values every 10 s = 15 points a second. InfluxDB handles thousands a second on this hardware.
- **Series:** 50 rooms × 3 fields plus PV is about 160 series. InfluxDB's memory grows with the number of series, and 160 is very few.
- **Queries:** the main cost. A year chart for one room covers 9.5 million values, so dashboards must aggregate in the query (`aggregateWindow`) rather than load the raw points.

## Operations: lessons from vm23

The problems on vm23 were caused by operations, not by lack of capacity. Status on 2026-11-17:

| Finding on vm23 | What the new server needs |
|---|---|
| The VM rebooted for a kernel update on 2026-11-06. `influxdb` has `restart=no` and has been down since then; the broker `leoiot-platform-mosquitto-1` did not come back either. | Every container runs with `restart: unless-stopped`. After a reboot, someone checks that all services are up. |
| The disk is 98 % full (98 GB, 1.9 GB free). | Monitoring with an alert at 80 % disk usage. |
| The `influxdb_backups` Docker volume holds 38 GB. `legacy/backup/backup.sh` prunes only the copies in `~/influxdb-backups` (19 GB), never the originals in `/backups` inside the container. | Backups are pruned where they are stored, and they are stored off the server. |
| Both collectors have reported `unhealthy` for 11 days without anyone noticing. | Health checks that someone sees, for example a notification on failure. |

## Open points

- **Bytes per value is still an estimate.** Measure it by writing a simulated year of 3 values every 10 s into a local InfluxDB 2.7.
- **Legacy history.** Copy it over completely, copy only `room_climate` and `solax_stats`, or start fresh.
- **Retention.** Decide on a retention limit or downsampling (a `platform-…` change to the data contract).
- **Send interval.** Confirm the send interval of the boxes (10 s today).
- **Kubernetes.** If the system moves to a Kubernetes cluster instead of a VM, the requests and limits in D2 of `openspec/changes/platform-k8s-resources/design.md` still apply. Only the database volume changes: 6–12 GB instead of 25 GiB.
