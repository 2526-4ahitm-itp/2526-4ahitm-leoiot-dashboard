# Proposal

## Why

Since it was flashed on 2026-11-23, the sensor box `nili3` in room 105 has lost its broker connection about every 30 seconds, day and night: 733 reconnects in 26 hours (the broker log shows "exceeded timeout", "connection closed by client" and "session taken over" in turn), compared with 310 in the 3½ days before. Readings only get through in the short connected moments, so the room page shows "Keine aktuellen Werte" again and again and the charts have gaps. Measured on 2026-11-24 from the same Wi-Fi network: the box's signal is good (−59 dBm), but pings took 35–200 ms with 20 % loss, and the box still published its whole debug log (a line per reading) to the broker. That is the pattern of the ESP32's Wi-Fi power saving (modem sleep, ESPHome's default) on a busy link.

## What Changes

- The firmware turns the ESP32's Wi-Fi power saving off (`wifi: power_save_mode: none`); the box is mains powered.
- The MQTT keepalive grows from ESPHome's default 15 s to 60 s, so that a short stall does not end the session.
- Only warnings and errors of the box's log go to the broker (`nili3/debug`, level WARN); the debug lines of every reading stay on the serial port and the box's web server.
- The firmware README explains the three settings and how to check the connection in the broker log.

Not in this change: a broker account of the box's own (nili3 still uses the PV collector's account), the ESPHome native API, moving the box or the access point.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sensors/box-firmware`: a new requirement that the box keeps its broker connection.

## Impact

- `leoiot-sensors/firmware/nili-ldr/nili-ldr.yaml`, `leoiot-sensors/firmware/README.md`.
- The box `nili3` is flashed over the air with the new firmware (done on 2026-11-24 while preparing this change, so that the effect could be measured).
- No change to the broker, the collector, the dashboard or the data contract; the topics stay the same.
