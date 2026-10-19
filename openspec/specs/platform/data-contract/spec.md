# data-contract Specification

## Purpose

Specifies the data interfaces sub-projects share: what is stored in the database, what is published on the broker and what reaches browsers over the live channel. A sub-project relies on nothing that is not written here.

## Requirements

### Requirement: PV daily readings are stored as `solax_stats`
PV readings SHALL be stored in the InfluxDB organisation `leoiot`, bucket `server_data`, as measurement `solax_stats` with the tag `plant_id` and these fields, all floating-point numbers in kWh:

| Field | Meaning |
|---|---|
| `daily_yield` | energy produced since midnight, plant local time |
| `daily_exported` | energy fed into the grid since midnight |
| `daily_imported` | energy drawn from the grid since midnight |
| `daily_charged` | energy charged into the battery since midnight |
| `daily_discharged` | energy taken from the battery since midnight |
| `consumption` | `daily_yield − daily_exported + daily_imported` |
| `total_yield` | energy produced over the lifetime of the plant |

One point SHALL be written per minute while the plant's cloud service answers. The timestamp of a point SHALL be the time the reading was collected. All fields of one reading SHALL be written in the same point.

Points with a timestamp before 2026-04-20 MAY carry only `daily_yield` and `consumption`. A reader SHALL treat a field that is missing from a point as unknown and not as zero.

#### Scenario: Reader asks for today's values
- **WHEN** a reader queries `solax_stats` for the last ten minutes during normal operation
- **THEN** it receives about ten points, each carrying all seven fields

#### Scenario: Day change
- **WHEN** the plant's local day ends
- **THEN** the six daily fields start again near zero and `total_yield` keeps growing; the first points after midnight may still carry the totals of the day before

#### Scenario: Collection interrupted
- **WHEN** no reading could be collected for some minutes
- **THEN** there are no points for those minutes, and the next point again carries the full totals of the day

#### Scenario: Reader meets an early point
- **WHEN** a reader queries a time range before 2026-04-20
- **THEN** it may receive points without `daily_exported`, `daily_imported`, `daily_charged`, `daily_discharged` and `total_yield`, and it does not show the missing values as zero

### Requirement: The `consumption` field excludes the battery
The field `consumption` SHALL keep the definition above while any reader depends on it. A reader that needs consumption including battery charge and discharge SHALL compute it from the other fields.

#### Scenario: Battery discharges in the evening
- **WHEN** the battery supplies energy that neither comes from the grid nor from current production
- **THEN** `consumption` does not include that energy, and a reader derives the complete figure from `daily_yield`, `daily_exported`, `daily_imported`, `daily_charged` and `daily_discharged`

### Requirement: PV live data is published on one broker topic
PV live data SHALL be published as a JSON object on the topic `leoenergy/solax_pv/overall_inverter`. Two message shapes are valid on this topic and a consumer SHALL accept both and tell them apart by their field names:

- **Daily totals**, published once per minute and retained: `dailyYield`, `dailyExported`, `dailyImported`, `dailyCharged`, `dailyDischarged`, `totalYield` (kWh) and `plantLocalTime`. Further fields may be present.
- **Momentary power**: `pv_power_kw`, `load_power_kw`, `grid_power_kw`, `battery_power_kw` (kW) and `daily_pv_kwh` (kWh), published about every two seconds. `grid_power_kw` is negative while the site draws power from the grid. Further fields may be present.

#### Scenario: Consumer receives daily totals
- **WHEN** a message with `dailyYield` and without `pv_power_kw` arrives
- **THEN** the consumer treats it as daily totals and does not read momentary power from it

#### Scenario: Consumer receives momentary power
- **WHEN** a message with `pv_power_kw` arrives
- **THEN** the consumer reads the four power values in kW from it

#### Scenario: Unknown extra field
- **WHEN** a message carries a field this contract does not name
- **THEN** the consumer ignores that field and processes the message

### Requirement: PV live data reaches browsers over the WebSocket channel
The platform SHALL forward every message of the PV live topic to all clients connected to the WebSocket channel at `/ws`, as `{"type":"pv","data":{…}}`, where `data` is the published object with an added `_ts` holding the forwarding time in milliseconds since the epoch. A client SHALL receive PV messages without subscribing, and a newly connected client SHALL at once receive the most recent PV message if there is one.

#### Scenario: Client connects
- **WHEN** a browser opens the WebSocket channel after a PV message has been forwarded
- **THEN** it receives a `hello` message and then the most recent `pv` message without sending anything

#### Scenario: New PV message
- **WHEN** a message is published on the PV live topic
- **THEN** every connected client receives it as a `pv` message with `_ts` set

### Requirement: Readers and writers get separate, limited database access
The platform SHALL give a sub-project that only reads the bucket a token that allows reading it and nothing else, and a sub-project that writes readings a token that allows writing to the bucket and nothing else. A sub-project SHALL NOT use the administrator token.

#### Scenario: Reader tries to write
- **WHEN** a request with a read token tries to write a point or delete data
- **THEN** the database rejects it

#### Scenario: Reader queries
- **WHEN** a request with a read token queries `solax_stats`
- **THEN** it receives the data

### Requirement: Stored PV readings are kept for a stated time
The contract SHALL state for how long PV readings are kept in the bucket, and that time SHALL be at least eight days so that a view of the last seven calendar days is complete.

PV readings are currently kept without a time limit: the bucket `server_data` has no expiry.

#### Scenario: Weekly view
- **WHEN** a reader queries the last seven calendar days
- **THEN** readings for each of those days are still available

#### Scenario: Old readings
- **WHEN** a reader queries a day more than eight days ago
- **THEN** the readings are still available as long as this contract states no time limit

### Requirement: The PV interfaces stay compatible during the migration
While any part of `legacy/` reads or writes a PV interface specified here, that interface SHALL NOT be renamed, removed or redefined. Additions that existing consumers ignore are allowed.

#### Scenario: New writer replaces the legacy one
- **WHEN** the legacy collector is replaced by a new one
- **THEN** legacy readers show the same values as before without any change to them

#### Scenario: Request to rename a field
- **WHEN** someone proposes to rename a field while a legacy app still queries it
- **THEN** the proposal waits until that app is removed, or adds a new field beside the old one
