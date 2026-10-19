# Spec Delta

## Purpose

Describes the service that collects the readings of the school's PV plant from the SolaX cloud and delivers them to the LeoIoT database and broker, and how it behaves when one of those is unavailable.

## ADDED Requirements

### Requirement: Readings are collected every minute
The collector SHALL request the plant's current values from the SolaX cloud at start and then once every minute.

#### Scenario: Normal operation
- **WHEN** the collector has been running for ten minutes and the cloud answers every request
- **THEN** it has collected ten or eleven readings

### Requirement: Readings are stored as the contract specifies
For every collected reading the collector SHALL store one point of PV daily readings exactly as specified in `platform/data-contract`.

#### Scenario: Reading stored
- **WHEN** the cloud returns a complete reading
- **THEN** a reader querying the PV daily readings finds one new point with all specified fields within the same minute

#### Scenario: Counter lower than before
- **WHEN** the cloud returns a daily counter that is lower than in the previous reading of the same day
- **THEN** the collector stores and publishes the value as received and logs that the counter stepped back

#### Scenario: Same result as the previous collector
- **WHEN** the new collector and the legacy collector both process readings of the same day
- **THEN** for every field the values they store at the end of each five-minute window differ by no more than the plant produced or consumed between their two requests

### Requirement: Readings are published as the contract specifies
For every collected reading the collector SHALL publish the daily-totals message of the PV live data as specified in `platform/data-contract`.

#### Scenario: Reading published
- **WHEN** the cloud returns a complete reading and the broker is reachable
- **THEN** the message is published and a client connecting to the broker afterwards receives it as the retained message

#### Scenario: Broker unreachable
- **WHEN** the broker is not reachable while a reading is collected
- **THEN** the reading is still stored in the database and publishing resumes by itself when the broker is back

### Requirement: Incomplete readings are not delivered
If the answer of the cloud lacks one of the values the contract requires or a value is not a number, the collector SHALL neither store nor publish that reading and SHALL log which value was missing.

#### Scenario: Value missing
- **WHEN** the cloud's answer contains no value for the energy fed into the grid
- **THEN** no point is written for that minute, the log names the missing value, and the next complete reading is stored normally

### Requirement: The collector recovers by itself
The collector SHALL keep running when the SolaX cloud, the database or the broker is unreachable or answers with an error, and SHALL try again at the next minute. When the cloud rejects its login session, the collector SHALL obtain a new one without being restarted.

#### Scenario: Cloud unreachable for an hour
- **WHEN** the SolaX cloud does not answer for an hour and then answers again
- **THEN** the collector has not stopped, and the first reading after the outage is stored within a minute of the cloud answering

#### Scenario: Login session rejected
- **WHEN** the cloud rejects a request because the session is no longer valid, whatever error code it uses
- **THEN** the collector logs in again and the reading of the following minute is stored

#### Scenario: Database unreachable
- **WHEN** the database rejects or does not accept a write
- **THEN** the collector logs the failure and writes the next reading at the next minute

### Requirement: The collector is restarted when it stops
The deployment of the collector SHALL start it again if its process ends, and SHALL make visible from outside whether a reading was delivered in the last five minutes.

#### Scenario: Process ends
- **WHEN** the collector process ends unexpectedly
- **THEN** it is running again within a minute without anyone acting

#### Scenario: No reading for five minutes
- **WHEN** the collector has not delivered a reading for more than five minutes
- **THEN** its health status says so

### Requirement: Credentials come from the environment only
The collector SHALL take the SolaX login, the plant identifier, the database token and the broker login from its environment and SHALL refuse to start and name the variable if one is missing.

#### Scenario: Variable missing
- **WHEN** the collector is started without the database token
- **THEN** it exits at once with a message naming the missing variable and collects nothing

### Requirement: Only one collector delivers at a time
At any time at most one collector SHALL store readings in the production bucket and publish to the production topic, and at most one collector SHALL use the SolaX account, because the cloud keeps only one valid session per account. A collector that is run for a test SHALL store in a separate bucket and SHALL NOT publish.

#### Scenario: Test run
- **WHEN** the new collector is run for a test before the switch
- **THEN** it stores in a separate bucket, does not publish, and the production bucket and the live topic receive data from the legacy collector only

#### Scenario: Switch
- **WHEN** the new collector takes over
- **THEN** the legacy collector has been stopped first, and readers find at most two consecutive minutes without a point
