# Tasks

Tasks marked **(human, vm23)** need a shell on the host as `solmqadmin`. Recorded samples and the evidence notes are kept in `/home/daniel/leoiot/contract-samples/` (outside the repository) without any credential. Decided by Daniel on 2026-10-13: the PV team decides on this change itself; no review or approval by the project lead is needed, so there is no pull request for it.

## 1. Record the running system

- [x] 1.1 **(human, vm23)** Query `solax_stats` for the last 15 minutes and for one full day and attach the result as CSV; verify the sample shows the tag `plant_id`, the seven fields and about one point per minute
- [x] 1.2 Count the points in `solax_stats` that lack one of the seven fields and note the time range they fall in; verify the count and range are written in the evidence notes, also when the count is zero
- [x] 1.3 Record the WebSocket channel `/ws` (shortened from 24 hours to 13 minutes by Daniel's decision of 2026-10-13: the recording only has to show what arrives, and both shapes arrived within two minutes) and extract one example of each `pv` message shape with its arrival times; verify the evidence notes state for each shape whether it arrived and how often
- [x] 1.4 Read the retention of the bucket `server_data`; verify the value is written in the evidence notes

## 2. Align the spec with the record

- [x] 2.1 Compare every requirement of `specs/platform/data-contract/spec.md` with the samples from group 1 and correct the spec where they differ (field list, message fields, interval, partial points); verify each requirement is ticked against a sample in the evidence notes
- [x] 2.2 Write the recorded retention into the retention requirement; verify the stated time is at least eight days or the difference is raised with the project lead
- [x] 2.3 Verify `openspec validate platform-data-contract-pv --strict` passes

## 3. Access

- [x] 3.1 Create one token that can only read `server_data` and one that can only write to it, and hand them to the PV team outside the repository; verify a write with the read token is rejected and a query with it returns data

## 4. Agreement

- [x] 4.1 Daniel accepts the final spec for the PV team after task 2.1; verify he has said so
- [x] 4.2 After acceptance, sync the spec to `openspec/specs/platform/data-contract/spec.md`; verify `openspec list --specs` shows `platform/data-contract`
