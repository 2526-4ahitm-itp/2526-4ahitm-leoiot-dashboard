# Tasks

## 1. Firmware

- [x] 1.1 Set `wifi: power_save_mode: none`, `mqtt: keepalive: 60s` and `mqtt: log_topic` (`nili3/debug`, level WARN) in `leoiot-sensors/firmware/nili-ldr/nili-ldr.yaml`; verify `esphome config nili-ldr.yaml` reports a valid configuration.
- [x] 1.2 Flash `nili3` over the air from a temporary copy with the secrets outside the repository; verify the upload ends with "OTA successful" and the box is back online.
- [x] 1.3 Document the three settings and the broker-log check in `leoiot-sensors/firmware/README.md`; verify the README names them.

## 2. Checks

- [ ] 2.1 Broker log over at least one hour during lessons after the flash: no "exceeded timeout" and no new connection of `nili3_usb`; verify with the `docker logs … | grep nili3_usb` command from the README.
- [ ] 2.2 Run `openspec validate sensors-box-mqtt-stability --strict` and verify it passes.
