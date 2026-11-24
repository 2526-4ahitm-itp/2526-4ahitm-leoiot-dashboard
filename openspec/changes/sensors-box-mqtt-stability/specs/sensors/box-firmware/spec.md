# Spec Delta

## ADDED Requirements

### Requirement: The box keeps its broker connection
The box SHALL keep one MQTT connection to the broker for as long as its Wi-Fi network and the broker are reachable, so that every reading reaches the broker within a few seconds. The firmware SHALL NOT use the ESP32's Wi-Fi power saving, SHALL NOT scan for another access point while it is connected, SHALL use an MQTT keepalive of at least 60 seconds, SHALL start a clean MQTT session on every connect, SHALL NOT send MQTT messages from its main loop, and SHALL publish only warnings and errors of its log to the broker (on `nili3/debug`); the debug log of single readings SHALL NOT be published over MQTT. The box SHALL publish the reason of its last restart (retained) and its uptime, so that a restart can be told apart from a reconnect on the broker alone.

#### Scenario: A school day
- **WHEN** the box runs for one hour during lessons with its Wi-Fi network and the broker up
- **THEN** the broker log shows no "exceeded timeout" and no new connection of `nili3_usb` in that hour, and the room page of room 105 never shows its values as outdated

#### Scenario: Log over MQTT
- **WHEN** the box takes a CO₂ reading
- **THEN** no debug line about it is published on `nili3/debug`, and a warning of the box still is

#### Scenario: A restart
- **WHEN** the box restarts
- **THEN** after it is back, `nili3/sensor/nili3_reset_reason/state` holds the reason of that restart and the uptime on `nili3/sensor/nili3_uptime/state` starts again from zero
