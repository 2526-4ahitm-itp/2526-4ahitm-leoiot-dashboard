# Proposal

## Why

The data contract says the daily fields of `solax_stats` count up from midnight and start again near zero at the day change. Real readings do more than that: on 4 of the 30 days up to 2026-10-13 a daily field, mostly `daily_imported`, fell by up to 7 kWh during the day and rose again within minutes. A reader that takes every fall for the day change loses the hours before it; the main kiosk did exactly that until it was fixed on 2026-10-13 (`pv-main-kiosk` design D10). The rule lives only in the PV specs today, so the next reader of `solax_stats` (the PV dashboard of #64, Grafana, the sensors team) would run into the same trap.

## What Changes

- Add to `platform/data-contract` that the daily fields of `solax_stats` can briefly step back during the day and are stored as delivered.
- State how a reader tells the day change from a step back and which value of the day it reads.
- No change to fields, units, write interval or the live topic. No code changes: the collector and the main kiosk already behave this way.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform/data-contract`: a new requirement on daily fields that step back within a day, next to the requirement "PV daily readings are stored as `solax_stats`".

## Impact

- **Readers of `solax_stats`**: `leoiot-pv/kiosk` already follows the rule (commit `7fdcce4`). The future PV dashboard (#64) refers to it. `legacy/dashboard-v2` and Grafana are not changed (`legacy/` is frozen); they keep showing a step back as it is stored.
- **Writer**: `leoiot-pv/collector` already stores and publishes a lower value as received (`pv/solax-collector`, scenario on a counter that steps back).
- **Ownership**: PV part of the contract, decided by the PV team (rule of 2026-10-13); no review by the project lead needed.
- **No running service changes.**
