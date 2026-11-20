# Spec Delta

## ADDED Requirements

### Requirement: The demo covers every room of the building model
The demo SHALL generate readings for every room of the 3D building model except rooms that have a real sensor; room `105` SHALL never be written by the demo. Room ids SHALL be written exactly as in the model.

#### Scenario: Rooms of the model
- **WHEN** the demo runs
- **THEN** every room of the model except `105` has a live message, and the explorer's CO₂ and temperature maps show a value for each of them

### Requirement: Demo readings are marked
Every reading of the demo SHALL carry `source` = `simulated` and `device` = `demo`, in the database and in the live message; the live message SHALL also carry `demo` = `true`.

#### Scenario: Telling demo from real readings
- **WHEN** a reader filters `room_climate` on `device` = `demo`
- **THEN** it gets exactly the demo's points, and the dashboard marks those rooms as simulated

### Requirement: Demo values look like a school day
The demo SHALL produce plausible values that change with the school day: CO₂ rises during lessons and falls in breaks and at night, temperature and humidity vary per room. Over a school day some rooms SHALL reach each CO₂ step (below 800, 800 to 1000, above 1000 ppm), and some rooms SHALL lie outside 19 to 25 °C. The values SHALL be a deterministic function of room and time.

#### Scenario: Weekday morning
- **WHEN** the dashboard's room list is opened on a weekday at 10:30
- **THEN** rooms show green, yellow and red CO₂ states

#### Scenario: Night
- **WHEN** it is 3:00
- **THEN** every demo room shows CO₂ near outdoor level

### Requirement: The demo is off by default and can be dumped
The demo SHALL run only when the host enables its Compose profile. Its `--clear` mode SHALL empty the retained message of every demo room and delete every `room_climate` point with `device` = `demo`, and leave every other reading untouched.

#### Scenario: Deployment without the profile
- **WHEN** a deployment runs on a host without `COMPOSE_PROFILES=demo`
- **THEN** no demo service is started

#### Scenario: Dumping the demo
- **WHEN** the demo is stopped and `--clear` runs
- **THEN** no demo room has a live message, no point with `device` = `demo` remains, and room 105's real readings are unchanged
