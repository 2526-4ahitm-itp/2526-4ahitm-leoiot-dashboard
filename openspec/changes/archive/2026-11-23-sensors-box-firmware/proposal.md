# Proposal

## Why

`legacy/README.md` and `leoiot-sensors/README.md` list `legacy/sensorbox/` as replaced by `leoiot-sensors`, but the firmware of the only real sensor box, `nili3` in room 105, still lives in the frozen `legacy/sensorbox/nili-ldr/`. Several things in it are not acceptable for a part of the running system:

- On 2026-11-23 the box got new CO₂ limits, 800 and 1000 ppm, so that its traffic light matches the dashboard (`sensors/dashboard`). The limits belong in a spec, not only in a YAML file.
- The OTA password and the password of the fallback hotspot stand in plain text in a public repository. They must leave the file and be replaced on the box.
- The fallback hotspot is named by the literal text `substitutions.name` instead of the box name, because of a typo.
- The firmware lets the MQTT topics `co2/threshold/high` and `co2/threshold/middle` override the limits. This is unused: there are no retained values, nothing publishes them, and the topics are not part of `platform/data-contract`. It only allows a stray retained message to change the colours.

## What Changes

- New capability `sensors/box-firmware`: the traffic light with fixed limits, the readings the box publishes, secrets kept out of the repository, and the over-the-air update with the fallback hotspot.
- `leoiot-sensors/firmware/nili-ldr/` replaces `legacy/sensorbox/nili-ldr/`: the YAML moves with its history. The MQTT threshold override is removed, the limits are constants (green below 800, yellow 800 to 1000, red above 1000), the OTA and hotspot passwords become `!secret`, and the hotspot is named `${name}`.
- New `secrets.yaml.example` (key names only) and a README in `leoiot-sensors/firmware/` that describes building, flashing, recovery and changing the OTA password. `.gitignore` paths and the docs that name the old path are updated.

Not in this change: new topics, new sensors, changes to the collector, the dashboard or the data contract.

## Capabilities

### New Capabilities

- `sensors/box-firmware`: what the box shows and publishes, where its secrets live and how it is updated.

### Modified Capabilities

None.

## Impact

- Only `nili-ldr` moves. `legacy/sensorbox/s3-mini-oled/`, `blinking-leds/`, `original-config/` and the other files of `legacy/sensorbox/` stay in `legacy/` as reference.
- `leoiot-sensors/firmware/` (new), `legacy/README.md` ("Removed parts"), `leoiot-sensors/README.md`, the root `.gitignore`, `interfaces.md` of the docs site.
- The box has to be flashed once with the new firmware, over Wi-Fi or USB. The old OTA and hotspot passwords are in the Git history of a public repository and count as published; the new ones are set by that flash and kept by the Sensoren lead outside the repository.
- No platform change: no topic, payload or account changes.
