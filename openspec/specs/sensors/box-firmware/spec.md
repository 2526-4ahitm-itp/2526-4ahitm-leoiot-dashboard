# sensors/box-firmware Specification

## Purpose
Describes the firmware of the school's room-climate sensor boxes, today only `nili3` in room 105: an ESP32 with CO₂, temperature, pressure, humidity, illuminance and motion sensors and a NeoPixel traffic light, built and flashed with ESPHome from `leoiot-sensors/firmware/`. It covers the traffic-light limits, the readings the box publishes for `sensors/collector`, how its credentials are kept out of the repository, and how it is updated over the air.

## Requirements

### Requirement: The traffic light follows fixed limits
The box SHALL show the air state on its NeoPixel from the latest CO₂ value, with the limits of `sensors/dashboard`: green below 800 ppm, yellow from 800 to 1000 ppm inclusive, red above 1000 ppm. Exactly one of the three colours SHALL be shown for every CO₂ value. The limits SHALL be fixed in the firmware. The box SHALL NOT take limits from MQTT and SHALL NOT subscribe to `co2/threshold/#`, so that no retained message can change the colours.

#### Scenario: Limits
- **WHEN** the latest CO₂ value is 799, 800, 1000 or 1001 ppm
- **THEN** the NeoPixel is green, yellow, yellow or red

#### Scenario: Threshold message
- **WHEN** a message with the value 400 is retained on `co2/threshold/high` or `co2/threshold/middle`
- **THEN** the box does not receive it and the colours stay as above

### Requirement: The box publishes its readings on its device topics
The box `nili3` SHALL publish its readings to the broker of `platform/broker` on vm23 with its own account, on the device topics `nili3/sensor/<sensor id>/state`. These SHALL include the topics the collector's mapping names for CO₂, temperature and humidity (`nili3/sensor/nili3_co2/state`, `nili3/sensor/nili3_temperature/state`, `nili3/sensor/nili3_humidity/state`, see `sensors/collector`), and the box's other sensors (pressure, illuminance, motion, Wi-Fi signal, the temperature of the CO₂ sensor) under the same prefix. The box SHALL publish no topic outside `nili3/`.

#### Scenario: A CO₂ reading
- **WHEN** the CO₂ sensor reports 868 ppm
- **THEN** the box publishes 868 on `nili3/sensor/nili3_co2/state` and the collector stores it as a CO₂ reading of device `nili3` in room 105

#### Scenario: Other sensors
- **WHEN** the box measures air pressure
- **THEN** it publishes it under `nili3/sensor/`, and the collector ignores the topic because its mapping does not name it

### Requirement: Secrets stay out of the repository
The Wi-Fi, MQTT, OTA and fallback-hotspot credentials SHALL come only from a file `secrets.yaml` next to the firmware YAML. That file SHALL NOT be committed; the repository SHALL contain `secrets.yaml.example` with the key names only, and no credential value anywhere in `leoiot-sensors/firmware/`. A build without `secrets.yaml` SHALL fail.

#### Scenario: Building without secrets
- **WHEN** `esphome config nili-ldr.yaml` or a build runs in a checkout without `secrets.yaml`
- **THEN** it fails with ESPHome's error about the missing `secrets.yaml` and does not build firmware with default credentials

#### Scenario: Credentials in the repository
- **WHEN** someone searches `leoiot-sensors/firmware/` for `password:`
- **THEN** every hit is a `!secret` reference

### Requirement: The box is updated over the air, with a fallback
The box SHALL accept new firmware only through ESPHome OTA, protected by the OTA password. When it cannot join its Wi-Fi network, it SHALL open a fallback hotspot named after the box (`nili3`) protected by the hotspot password, through which it can be flashed again at `192.168.4.1`.

#### Scenario: Update with the password
- **WHEN** firmware is uploaded to the box with the OTA password
- **THEN** the box installs it and reboots

#### Scenario: Update with a wrong password
- **WHEN** firmware is uploaded with a wrong OTA password
- **THEN** the box refuses it and keeps running its firmware

#### Scenario: Wi-Fi not available
- **WHEN** the box cannot join its Wi-Fi network
- **THEN** it opens a hotspot named `nili3` that needs the hotspot password, and firmware uploaded to `192.168.4.1` is accepted
