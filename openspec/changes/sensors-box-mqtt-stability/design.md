# Design

## Context

See proposal.md for the measurements. The firmware (`leoiot-sensors/firmware/nili-ldr/nili-ldr.yaml`, ESPHome 2026.4.5, Arduino framework on an ESP32) sets no `power_save_mode`, no MQTT `keepalive` and no `log_topic`, so ESPHome's defaults apply: light modem sleep, a 15 s keepalive (the broker drops a client after 1.5 × keepalive without traffic) and the full DEBUG log on `nili3/debug`. Before the change the box answered pings with 35–200 ms and 20 % loss at −59 dBm (measured from the same network on 2026-11-24); its web server answered in under 0.1 s by IP.

## Goals / Non-Goals

**Goals:** a connection that holds; measured in the broker log, not assumed.

**Non-Goals:** a broker account of the box's own, the native API, hardware or access point changes.

## Decisions

**D1. `power_save_mode: none`.** Modem sleep makes the ESP32 wake only at the access point's beacon intervals, which matches the delays and losses seen; the box is mains powered, so the extra current does not matter. Rejected: `light` (the current default, the problem).

**D2. `keepalive: 60s`.** The broker then waits 90 s before it drops a silent client, instead of 22.5 s. Readings come every 10 s, so a healthy box is never silent that long; a longer keepalive only hides short stalls, it does not hide a dead box from the dashboard (readings older than 5 minutes are still marked outdated).

**D3. `log_topic` at level WARN.** Keeps the remote view of real problems (`esphome logs --device MQTT` still shows warnings and errors) and removes about one publish per reading. Rejected: `log_topic: null` (no remote diagnostics at all).

**D4. Flash first, specify with the measured result.** The box was flashed on 2026-11-24 at 08:36 from a temporary copy of the changed YAML with the secrets outside the repository (as in the firmware README). Right after the flash the pings had no loss (6–228 ms), and the effect on the connection is measured in the broker log before this change is merged.

## Risks / Trade-offs

- [The cause is not power saving] → the broker log after the flash decides; if reconnects continue, the next suspects are the access point and the box's main loop, checked with `esphome logs` at DEBUG over the serial port.
- [Higher power draw] → mains powered.

## Migration Plan

Flash over the air (`leoiot-sensors/firmware/README.md`); rollback is flashing the previous YAML.
