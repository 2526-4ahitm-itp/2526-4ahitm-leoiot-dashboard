# Spec Delta

## Purpose

**Temporary.** Describes a stopgap that publishes generated room-climate readings so that the 3D explorer has data to display until the sensors team publishes. This capability is deleted together with the component.

## ADDED Requirements

### Requirement: Generated readings follow the contract
The temporary simulator SHALL publish, about once a minute for every room of the building model, a retained room-climate live message as specified in `platform/data-contract`, with `source` = `simulated`, `device` = `temporary-simulator`, and both `co2` and `temperature`. It SHALL NOT write to the database and SHALL NOT read legacy topics.

#### Scenario: A new subscriber
- **WHEN** the simulator has run for a minute and a browser subscribes to the room-climate topics
- **THEN** it receives one message for each of the 107 rooms, each marked `simulated`

#### Scenario: Room id with a dot
- **WHEN** the simulator publishes for room `U74.1`
- **THEN** the topic and the `room` field both carry `U74.1`

### Requirement: Values cover every display state of the explorer
Generated values SHALL vary over time and between rooms, so that green, yellow and red CO₂ status occur at any time of day.

#### Scenario: Any moment
- **WHEN** the readings of all rooms at one moment are compared
- **THEN** they include all three FR-07 states

### Requirement: The simulator is off unless switched on
The simulator SHALL run only when the host's `leoiot-3d/.env` enables its Compose profile. Without that, a deployment of `leoiot-3d` SHALL neither start it nor fail. When its broker account is missing it SHALL exit and name the missing variable.

#### Scenario: Deployment without configuration
- **WHEN** `leoiot-3d` is deployed on a host without `leoiot-3d/.env`
- **THEN** the explorer starts and the simulator does not

#### Scenario: Missing password
- **WHEN** the simulator starts without `SIMULATOR_MQTT_PASSWORD`
- **THEN** it exits with an error naming that variable

### Requirement: The simulator is marked as temporary and can be removed without a trace
Its name, start-up log and documentation SHALL state that it is temporary. It SHALL be able to remove every retained message it published. It SHALL be removed before the sensors team publishes room climate on the same broker.

#### Scenario: Clearing
- **WHEN** the simulator is started with `--clear`
- **THEN** it removes the retained message of every room and exits, and the explorer then shows "No data for room"
