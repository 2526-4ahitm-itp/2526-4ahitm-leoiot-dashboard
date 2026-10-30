# temporary-simulator

> **TEMPORARY. Not a permanent part of the system.** Delete it as soon as real or faked room-climate data from the sensors team arrives.

The 3D explorer reads room climate from the broker, and nothing publishes it on vm23 yet. This stopgap generates values so that the explorer has something to display. **The values are made up**: a slow wave per room, not measurements. They are marked `source` = `simulated` and `device` = `temporary-simulator`.

It publishes every room of the building model once a minute on the room-climate live topic (`platform/data-contract`). It writes nothing to the database and reads no legacy data. Change: `model3d-temporary-simulator`.

## Switch it on (vm23, by hand)

It is off unless the host switches it on, so a deployment works without any of this.

1. Create the broker account `model3d-simulator` in `leoiot-platform/broker/pwfile` on the host, and add to `leoiot-platform/broker/acl`:

   ```
   user model3d-simulator
   topic write leoiot/room-climate/#
   ```

   Then reload the broker.
2. Create `leoiot-3d/.env` on the host from `leoiot-3d/.env.example`, with `COMPOSE_PROFILES=temporary-simulator` and the account. Never commit it.
3. It starts with the next deployment of `leoiot-3d`, or at once with `docker compose up -d` in `leoiot-3d/`.

## Run it locally

Against the local test stack (`../compose.dev.yaml`), whose broker accepts any login:

```bash
npm ci
SIMULATOR_MQTT_URL=mqtt://localhost:1883 SIMULATOR_MQTT_USER=dev SIMULATOR_MQTT_PASSWORD=dev npm start
```

## Removal

Do this **before** the sensors team publishes, otherwise both write the same topics:

1. On vm23, in `leoiot-3d/`: `docker compose stop temporary-simulator`, then `docker compose run --rm temporary-simulator node index.mjs --clear`. Without this the rooms stay on the broker and show as outdated for good.
2. Delete `leoiot-3d/.env` on the host, and the account from `pwfile` and `acl`.
3. In a pull request: delete this folder, the service and the network in `leoiot-3d/compose.yaml`, `leoiot-3d/.env.example` and the note in `leoiot-3d/README.md`. Remove the capability `model3d/temporary-simulator` from the specs.
