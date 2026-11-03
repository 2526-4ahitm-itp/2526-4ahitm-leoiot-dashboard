# leoiot-sensors

New sensor ingestion and room-climate views (CO₂, temperature and humidity per room).

| | |
|---|---|
| **Owning team** | Sensoren — Elias Pointinger (project lead) |
| **Status** | In progress (change `sensors-room-climate`): the collector is written and tested; the dashboard, the `/sensors/` route and the deployment on vm23 are still to come |
| **Spec group** | `openspec/specs/sensors/` |

## Layout

- `collector/`: the collector (Node 22, TypeScript, Vitest, `mqtt`). It reads the devices of its mapping `collector/devices.json` (today `nili3` in room `105`), stores every reading in `room_climate` and publishes the room's retained live message, both as `platform/data-contract` specifies.
- `compose.yaml`: the Compose project `leoiot-sensors`. It holds the collector; the dashboard service is added with the dashboard.
- `.env.example`: names of the variables of the unit, without values.
- `PRODUCT.md`, `.impeccable/surfaces/dashboard.md`: product facts and the design direction of the coming dashboard.

Each application is its own folder with its own `package.json` and `Dockerfile`; there is no workspace.

## Dependency rule

This sub-project may depend only on the interfaces specified in the `platform` spec group (`openspec/specs/platform/`). It must not import, copy or mount anything from `legacy/` or from a sibling sub-project. Legacy logic is re-specified and re-implemented, never referenced.

## Replaces from `legacy/`

- `legacy/sensorbox/`
- `legacy/fake-sensors/`
- `legacy/backend/sensor-data-generator/`
- the sensor views of `legacy/dashboard-v2/`

## Tests and build

Collector, Node 22 (Node 26 runs it too):

```
cd leoiot-sensors/collector
npm ci
npm test
npm run build
```

`npm test` needs no network and no Docker: it uses a fake MQTT client, a fake InfluxDB over HTTP and a fake clock. CI runs exactly this.

Image and Compose file as CI checks them, from the repository root:

```
.github/ci/image-build.sh leoiot-sensors/collector
env=$(mktemp); sed -E 's/^([A-Za-z_][A-Za-z0-9_]*)=$/\1=ci-placeholder/' leoiot-sensors/.env.example > "$env"
docker compose -f leoiot-sensors/compose.yaml --env-file "$env" config -q
```

## Integration tests (Docker)

```
cd leoiot-sensors/collector
npm ci
npm run test:integration
```

This starts a throwaway Mosquitto 2.1 and InfluxDB 2.7 in Docker on free ports of `127.0.0.1` (accounts, ACL and test token are made up for the run), builds the collector image once, and removes everything afterwards. It takes about a minute. It checks that a message on the legacy simulator topic is not received, that a broker restart is survived, that new subscribers get the retained message, that the container turns unhealthy when the database or the broker is gone for longer than the (shortened) limit, and the whole path against `platform/data-contract`. CI does not run it.

## Run the collector locally

Against a throwaway stack of the same kind. Needs Docker and Node 22 or later; use three terminals, all in `leoiot-sensors/collector`.

Terminal 1, the stack and the collector:

```
npm ci
npm run build
npm run stack:up
set -a; . .dev-stack/collector.env; set +a
npm start
```

Terminal 2, a stand-in for the sensor box `nili3` (five rounds, two seconds apart):

```
set -a; . .dev-stack/collector.env; set +a
npm run stack:publish -- --count 5 --interval 2000
```

Terminal 3, look at the result:

```
set -a; . .dev-stack/collector.env; set +a
curl -s -X POST "$SENSORS_INFLUX_URL/api/v2/query?org=leoiot" -H "Authorization: Token $SENSORS_INFLUX_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/csv' -d '{"query":"from(bucket: \"server_data\") |> range(start: -1h) |> filter(fn: (r) => r._measurement == \"room_climate\")","type":"flux"}'
docker exec leoiot-sensors-dev-mosquitto mosquitto_sub -u sensors-collector -P "$SENSORS_MQTT_PASSWORD" -t 'leoiot/room-climate/#' -C 1 -v
```

When done, stop the collector with Ctrl-C and remove the stack:

```
npm run stack:down
```

`npm run stack:up` writes the test values (token `test-token-not-secret`, generated passwords) to `collector/.dev-stack/`, which Git ignores. The browser listener of the stack answers at `ws://127.0.0.1:<port>`; the port is in `.dev-stack/stack.json`.

## Collector variables

All settings come from the environment. When a required variable is missing, the collector exits at once with code 1 and names each missing variable; it never prints a credential.

| Variable | Required | Default |
|---|---|---|
| `SENSORS_INFLUX_TOKEN` | yes (write only) | |
| `SENSORS_MQTT_USER`, `SENSORS_MQTT_PASSWORD` | yes | |
| `SENSORS_INFLUX_URL` | no | `http://influxdb:8086` |
| `SENSORS_INFLUX_ORG` | no | `leoiot` |
| `SENSORS_INFLUX_BUCKET` | no | `server_data` |
| `SENSORS_MQTT_URL` | no | `mqtt://mosquitto:1883` |
| `SENSORS_DEVICES_FILE` | no | the bundled `collector/devices.json` |
| `SENSORS_HEALTH_FILE` | no | `/tmp/collector-health.json` |
| `SENSORS_FLUSH_INTERVAL_MS` | no | `2000` (batch interval of database writes) |
| `SENSORS_BUFFER_MAX_AGE_MS` | no | `3600000` (readings kept while the database fails) |
| `SENSORS_MQTT_RECONNECT_MS` | no | `5000` |
| `SENSORS_HEALTH_BROKER_DOWN_MS` | no | `120000` (unhealthy when the broker is gone longer) |
| `SENSORS_HEALTH_WRITE_FAIL_MS` | no | `300000` (unhealthy when writes fail longer) |
| `SENSORS_HEALTH_INTERVAL_MS` | no | `5000` (status file is rewritten this often) |

In the container the three required variables come from the file named by `SENSORS_COLLECTOR_ENV_FILE` in `compose.yaml` (on vm23: `/home/solmqadmin/leoiot-host-secrets/sensors-collector.env`, outside the checkout). Never put credentials into the repository.
