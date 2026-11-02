# Tasks

## 1. Check the rule against data and readers

- [x] 1.1 Re-run the query of falls of the daily fields over the last 30 days on vm23 (read token) and classify them by time; verify every fall within the first 30 minutes of a day is a day change, no step back halves the summed daily fields, and record the numbers in the pull request Done 2026-11-02 (read-only through the kiosk proxy, 42,873 points from 2026-10-03 to 2026-11-02, sorted by UTC): 129 falls. 109 lie at 00:07 or 00:08 Vienna time on 30 days and all halve the sum, so they are day changes. 20 are step backs on 6 days and none halves the sum. The largest is bigger than the design says: on 2026-10-22 at 19:49 `daily_imported` fell by 270 kWh and `daily_yield` by 102.4 kWh, the sum from 1206 to 833 kWh, and all fields were back after 14 minutes. The rule still holds
- [x] 1.2 Check that `leoiot-pv/kiosk` and `leoiot-pv/collector` follow the requirement; verify the kiosk tests for the readings of 2026-10-13 04:40 to 05:40 and the collector test for a lower value pass (`npm test` in both) Done 2026-11-02: the tests for these readings moved with the code to `leoiot-pv/shared/tests/influx.test.ts`; `npm test` passes in `shared` (129), `kiosk` (83) and `collector` (71, `tests/counters.test.ts`, `tests/loop.test.ts`)

## 2. Adopt

- [x] 2.1 Sync the delta into `openspec/specs/platform/data-contract/spec.md` and archive the change; verify `openspec validate --specs --strict` passes and the requirement appears in the main spec Done 2026-11-02
