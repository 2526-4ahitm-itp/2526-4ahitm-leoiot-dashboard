# Sensor box firmware

ESPHome firmware of the room-climate sensor boxes of the school. Today there is one box, `nili3` in room 105: an ESP32 with an MH-Z19 CO₂ sensor, a BME280 for temperature, pressure and humidity, an LDR for illuminance, a motion sensor and a NeoPixel traffic light. Its configuration is `nili-ldr/nili-ldr.yaml`; the behaviour is specified in `openspec/specs/sensors/box-firmware/`.

- The NeoPixel shows the air state with the limits of the dashboard: green below 800 ppm, yellow from 800 to 1000 ppm, red above 1000 ppm. The limits are fixed in the firmware; the box does not read them from MQTT.
- The box joins the Wi-Fi network `htlleonding-iot` and reports to the platform broker on vm23 (`vm23.htl-leonding.ac.at:1883`) on the topics `nili3/sensor/<sensor id>/state`. The collector (`../collector/`) reads three of them (CO₂, temperature, humidity); the box also publishes `nili3/status` (`online` while it is connected).

## Secrets

Wi-Fi, MQTT, OTA and fallback-hotspot credentials are not in the repository. Create `nili-ldr/secrets.yaml` from the example and fill in the values:

```bash
cd leoiot-sensors/firmware/nili-ldr
cp secrets.yaml.example secrets.yaml
```

`secrets.yaml` and `.esphome/` are ignored by Git. The real `secrets.yaml` is kept by the Sensoren lead; a copy is on vm23 at `~/leoiot-host-secrets/sensors-nili3-secrets.yaml` (mode 600, never in the repository). Without it, ESPHome stops with an error about the missing file instead of building with defaults.

## Build and flash

The ESP32 toolchain of ESPHome needs Python 3.10 to 3.13. An ESPHome installed with Homebrew on Python 3.14 fails with "Python version must be between 3.10 and 3.13", so run it with `uvx` and a pinned Python:

```bash
cd leoiot-sensors/firmware/nili-ldr
uvx --python 3.13 --from esphome==2026.4.5 esphome run nili-ldr.yaml --device nili3.local
```

Your computer has to be in the same Wi-Fi network as the box, `htlleonding-iot`; the box then answers as `nili3.local`. To only check the configuration without building, use `esphome config nili-ldr.yaml` in place of `esphome run ...` (same `uvx` prefix).

When the box is back, it publishes `nili3/status` = `online` and room 105 shows current values on the dashboard at `/sensors/?room=105`.

## Connection

These settings keep the box connected to the broker (specified in `openspec/specs/sensors/box-firmware/`):

- `wifi: power_save_mode: none`: the ESP32's default Wi-Fi power saving made the link lose about a fifth of all packets, and the broker dropped the box every 30 seconds.
- `wifi: post_connect_roaming: false`: ESPHome otherwise scans for a better access point five minutes after every connect. The box never moves; on 2026-11-24 it stopped answering about 20 seconds after such a scan and restarted.
- `mqtt: keepalive: 60s`: a short stall does not end the session.
- `mqtt: clean_session: true`: every connect starts a new session. With a kept session the broker carried old subscriptions and unacknowledged messages from one connection to the next and logged "exceeded its receive-maximum quota" after each reconnect.
- `mqtt: idf_send_async: true`: the MQTT task sends the messages, so a stalled connection cannot block the main loop and trip the watchdog.
- `mqtt: log_topic` at level `WARN`: only warnings and errors go to `nili3/debug`. Read them with `esphome logs nili-ldr.yaml --device MQTT` (same `uvx` prefix); the full debug log is on the serial port and on the box's web page.

The box also reports why it last restarted and how much memory it has left, so that a restart can be explained from the broker alone: `nili3/sensor/nili3_reset_reason/state` (retained), `nili3/sensor/nili3_uptime/state`, `nili3/sensor/nili3_heap_free/state` and `nili3/sensor/nili3_heap_max_block/state`. The collector ignores these topics.

To check the connection, count the box's reconnects in the broker log on vm23 (read-only):

```bash
ssh solmqadmin@vm23.htl-leonding.ac.at 'docker logs --since 1h leoiot-platform-mosquitto-1 2>&1 | grep -c "as nili3_usb"'
```

A healthy box shows 0 new connections per hour, apart from one after a restart or a flash. "session taken over" in that log means the box opened a new connection before the broker noticed the old one was gone; a falling uptime means it restarted.

## Recovery

If the box cannot join the Wi-Fi network, it opens a hotspot named `nili3`, protected by the hotspot password (`ap_password`). Join it and flash through the box's fixed address:

```bash
uvx --python 3.13 --from esphome==2026.4.5 esphome run nili-ldr.yaml --device 192.168.4.1
```

Alternatively connect the box with a USB cable and flash over the serial port (`--device` is then the serial port).

## Changing the OTA password

The box accepts a new firmware only with the password it currently has. To change it, set the new `ota_password` in `secrets.yaml` and compile, then upload that binary while authenticating with the old password:

1. Compile with the new password: `esphome compile nili-ldr.yaml`. The compile output names the firmware file `firmware.ota.bin` below `.esphome/build/nili3/`.
2. Make a copy of the configuration (with its own `secrets.yaml`) in which `ota_password` is still the old password.
3. Upload the compiled binary using that copy: `esphome upload <copy>/nili-ldr.yaml --device nili3.local --file <path to firmware.ota.bin>`. `--file` is ESPHome's option "manually specify the binary file to upload" (checked in 2026.4.5), so the upload does not rebuild with the old password.

Then switch back to the new `secrets.yaml`; later uploads use the new password. The same way works for `ap_password`: a changed hotspot password takes effect with the new firmware.
