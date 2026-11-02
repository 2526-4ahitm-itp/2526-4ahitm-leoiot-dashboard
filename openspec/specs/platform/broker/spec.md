# platform/broker Specification

## Purpose
The shared MQTT broker of all sub-projects: how devices, services and browsers reach it, what each kind of account may do, and that retained messages survive a restart. Topics and payloads are specified in `platform/data-contract`.

## Requirements

### Requirement: Devices and services reach the broker with an account
The platform SHALL run one MQTT broker for all sub-projects. Services on the shared network SHALL reach it at `mosquitto:1883`; devices SHALL reach it at port 1883 of the host. Every connection on this listener SHALL need a user name and password; a connection without them SHALL be rejected.

#### Scenario: Sensor box connects
- **WHEN** a sensor box connects to port 1883 of the host with its account
- **THEN** the connection is accepted and the box can publish its readings

#### Scenario: Connection without credentials
- **WHEN** a client connects to port 1883 without a user name and password
- **THEN** the broker rejects the connection

### Requirement: Existing accounts keep their access
Every account that exists when the platform broker takes over SHALL keep the access it had before, with the same user name and password, while any part of `legacy/` or any device uses it.

#### Scenario: Legacy services after the takeover
- **WHEN** the platform broker has replaced the legacy one
- **THEN** Telegraf, the legacy WebSocket forwarder, the simulators, the PV collector and the sensor boxes connect and exchange messages as before, without any change to them

### Requirement: New writer accounts publish only on their own topics
An account created for a new writer SHALL be allowed to publish only on the topics `platform/data-contract` assigns to that writer. The account of the sensors collector SHALL be allowed to publish only on `leoiot/room-climate/#`.

#### Scenario: Collector publishes room climate
- **WHEN** the sensors collector publishes on `leoiot/room-climate/105`
- **THEN** subscribers receive the message

#### Scenario: Collector publishes elsewhere
- **WHEN** the sensors collector's account publishes on `co2/threshold/high` or `leoenergy/solax_pv/overall_inverter`
- **THEN** the broker does not deliver the message to any subscriber and does not change any retained message

### Requirement: The WebSocket listener is reachable only through the reverse proxy
The broker's WebSocket listener SHALL be reachable from outside the host only at `/mqtt` of the reverse proxy, as `platform/data-contract` specifies for browsers. It SHALL NOT be published on a public port of the host.

#### Scenario: Direct connection from outside
- **WHEN** a client outside the host tries to reach the WebSocket listener on its own port
- **THEN** the connection fails

#### Scenario: Connection through the proxy
- **WHEN** a browser opens `wss://<host>/mqtt`
- **THEN** it reaches the WebSocket listener

### Requirement: Retained messages survive a restart
The broker SHALL keep retained messages across a restart of the broker or the host.

#### Scenario: Broker restarts
- **WHEN** the broker restarts and a client then subscribes to `leoiot/room-climate/#`
- **THEN** the client receives the retained message of every room that had one before the restart

### Requirement: The platform provides the shared network
The platform SHALL provide the Docker network `2526-4ahitm-leoiot-dashboard_leoiot`, on which the broker and every service that uses it run. Other deploy units SHALL join it as an external network and SHALL NOT create it. The network SHALL exist whenever the platform unit runs, independent of `legacy/`.

#### Scenario: PV unit starts
- **WHEN** the platform unit runs and `leoiot-pv` starts with its default settings
- **THEN** its services join the network and reach `mosquitto:1883`

#### Scenario: Legacy folder deleted
- **WHEN** `legacy/` no longer exists on the host and the platform unit runs
- **THEN** the network exists and the other deploy units start
