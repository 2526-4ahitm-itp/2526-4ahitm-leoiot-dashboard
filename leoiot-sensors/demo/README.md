# leoiot-sensors-demo

> **DEMO. Not a permanent part of the system.**

Generates CO₂, temperature and humidity for every room of the 3D building model except room 105 (it has the real sensor `nili3`), so that the explorer's maps and the sensors dashboard show values everywhere while the project is shown. The values are generated, not measured.

## What it does

- Rooms: the 107 rooms of the 3D model (`rooms.mjs`, a deliberate one-off copy, see the comment there) minus the skip list, which defaults to `105`. Set `DEMO_SKIP_ROOMS` (comma separated) to skip other rooms.
- Values: a deterministic function of room and time (`model.mjs`, Europe/Vienna). CO₂ rises during lessons and falls in breaks and at night, temperature and humidity differ per room; some rooms are too cold or too warm.
- Marks: every reading carries `source` = `simulated` and `device` = `demo`; the live message also carries `demo: true`.
- Rate: once a minute it publishes each room's live message (`leoiot/room-climate/<room>`, retained, QoS 1, 30 days expiry) and writes the same readings to `room_climate`.
- Backfill: on every start it writes the last 7 days at 5-minute steps (`DEMO_BACKFILL_DAYS`, `0` switches it off). Because the values depend only on room and time, writing them again overwrites the same points.
- Do not run it together with `leoiot-3d/temporary-simulator`: both write the same topics.

## Variables

Same names and defaults as the collector. Required: `SENSORS_INFLUX_TOKEN`, `SENSORS_MQTT_USER`, `SENSORS_MQTT_PASSWORD`. Optional: `SENSORS_MQTT_URL` (`mqtt://mosquitto:1883`), `SENSORS_INFLUX_URL` (`http://influxdb:8086`), `SENSORS_INFLUX_ORG` (`leoiot`), `SENSORS_INFLUX_BUCKET` (`server_data`), `DEMO_BACKFILL_DAYS` (`7`), `DEMO_SKIP_ROOMS` (`105`). Never put credentials into the repository.

## Test

```
cd leoiot-sensors/demo
npm ci
npm test
```

## Run locally

Against the throwaway stack of the collector (needs Docker):

```
cd leoiot-sensors/collector
npm ci
npm run stack:up
cd ../demo
npm ci
set -a; . ../collector/.dev-stack/collector.env; set +a
npm start
```

`collector.env` sets `SENSORS_INFLUX_URL`, `SENSORS_INFLUX_TOKEN`, `SENSORS_MQTT_URL`, `SENSORS_MQTT_USER` and `SENSORS_MQTT_PASSWORD`, which are the names the demo reads. Stop with Ctrl-C; remove the stack with `npm run stack:down` in `leoiot-sensors/collector`. `node index.mjs --clear` removes the demo's data again.

## Switch on at vm23

With the OK of the project lead: add the line `COMPOSE_PROFILES=demo` to `leoiot-sensors/.env`, then run `docker compose up -d` in `leoiot-sensors/`. The service `demo` uses the collector's env file (`SENSORS_COLLECTOR_ENV_FILE`). Without the line no demo service starts.

## Dump

1. On vm23 in `leoiot-sensors/`: `docker compose --profile demo stop demo`, then `docker compose --profile demo run --rm demo node index.mjs --clear`, then `docker compose --profile demo rm -f demo`, then remove `COMPOSE_PROFILES=demo` from `.env` and run `docker compose up -d --remove-orphans`.
   If `--clear` fails on the delete with 401 or 403, the collector's token has no delete right. The retained messages are already empty then; delete the points by hand with a token that may delete, for example in the InfluxDB container: `influx delete --org leoiot --bucket server_data --start 1970-01-01T00:00:00Z --stop <now> --predicate '_measurement="room_climate" AND device="demo"'`.
2. In a pull request: delete `leoiot-sensors/demo/`, the `demo` service in `leoiot-sensors/compose.yaml`, the note in `leoiot-sensors/README.md` and the change folder `openspec/changes/sensors-demo/`. Never archive that change.

`--clear` empties the retained message of every demo room and deletes every `room_climate` point with `device` = `demo`; all other readings, room 105 included, stay.
