# Tasks

## 1. Check the rule against data and readers

- [ ] 1.1 Re-run the query of falls of the daily fields over the last 30 days on vm23 (read token) and classify them by time; verify every fall within the first 30 minutes of a day is a day change, no step back halves the summed daily fields, and record the numbers in the pull request
- [ ] 1.2 Check that `leoiot-pv/kiosk` and `leoiot-pv/collector` follow the requirement; verify the kiosk tests for the readings of 2026-10-13 04:40 to 05:40 and the collector test for a lower value pass (`npm test` in both)

## 2. Adopt

- [ ] 2.1 Sync the delta into `openspec/specs/platform/data-contract/spec.md` and archive the change; verify `openspec validate --specs --strict` passes and the requirement appears in the main spec
