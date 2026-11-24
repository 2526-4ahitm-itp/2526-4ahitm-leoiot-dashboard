# Spec Delta

## ADDED Requirements

### Requirement: The box keeps its broker connection
The box SHALL keep one MQTT connection to the broker for as long as its Wi-Fi network and the broker are reachable, so that every reading reaches the broker within a few seconds. The firmware SHALL NOT use the ESP32's Wi-Fi power saving, SHALL use an MQTT keepalive of at least 60 seconds, and SHALL publish only warnings and errors of its log to the broker (on `nili3/debug`); the debug log of single readings SHALL NOT be published over MQTT.

#### Scenario: A school day
- **WHEN** the box runs for one hour during lessons with its Wi-Fi network and the broker up
- **THEN** the broker log shows no "exceeded timeout" and no new connection of `nili3_usb` in that hour, and the room page of room 105 never shows its values as outdated

#### Scenario: Log over MQTT
- **WHEN** the box takes a CO₂ reading
- **THEN** no debug line about it is published on `nili3/debug`, and a warning of the box still is
