# Tasks

## 1. Spec

- [x] 1.1 Write the change `sensors-box-firmware` with the spec `sensors/box-firmware`; verify `openspec validate sensors-box-firmware --strict`

## 2. Firmware

- [x] 2.1 Move `legacy/sensorbox/nili-ldr/` to `leoiot-sensors/firmware/nili-ldr/` with `git mv`
- [x] 2.2 Remove the MQTT threshold override (globals, the two `mqtt_subscribe` sensors, the commented-out text sensors, the debug interval) and use fixed limits 800 and 1000 ppm; verify every CO₂ value falls into exactly one of the three branches
- [x] 2.3 Replace the OTA and hotspot passwords by `!secret` and name the hotspot `${name}`
- [x] 2.4 Add `secrets.yaml.example` with key names only; make `.gitignore` ignore `/secrets.yaml` and `/.esphome/` and update the root `.gitignore` paths; verify `git grep -i 'password:' -- leoiot-sensors/firmware` shows only `!secret` references

## 3. Documentation

- [x] 3.1 Write `leoiot-sensors/firmware/README.md` (secrets, build, flash, recovery, changing the OTA password)
- [x] 3.2 Update `leoiot-sensors/README.md`, `legacy/README.md` ("Removed parts") and `interfaces.md` of the docs site (both languages)

## 4. Check and ship

- [x] 4.1 With a placeholder `secrets.yaml` outside the repository, verify `esphome config nili-ldr.yaml` says the configuration is valid; verify the build fails with the missing-secret error without one
- [ ] 4.2 Open the pull request and verify `ci-ok` is green
- [x] 4.3 Flash `nili3` (Sensoren lead): set the new OTA and hotspot passwords, verify `nili3/status` is `online`, room 105 on the dashboard shows current values and the traffic light follows 800 and 1000 ppm
- [ ] 4.4 Archive the change
