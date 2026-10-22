# Tasks

Tasks marked **(human, vm23)** need a shell on the host and are done only on the explicit instruction of the sensors team lead. Tokens and account credentials are handed over outside the repository.

## 1. Decide before merge

- [x] 1.1 **Important.** Decide the storage volume question in `design.md` ("Important decision: storage volume", options A to D) with the sensors team; verify the section states the chosen option and the date, and, if it is C or D, that the storage and retention requirements in `specs/platform/data-contract/spec.md` are changed to match
- [x] 1.2 Verify `openspec validate platform-data-contract-sensors --strict` passes after task 1.1

## 2. Documentation

- [x] 2.1 Correct the room of the real sensor box from 153 to 105 in `src/content/docs/docs/index.md`, `src/content/docs/docs/project.md`, `src/content/docs/en/docs/index.md` and `src/content/docs/en/docs/project.md`; verify `grep -rn "153" src/content/docs` no longer names it as the box's room and `npm run build` at the root succeeds

## 3. Agreement

Decided by Elias Pointinger, sensors team lead, on 2026-10-22: no separate review by the other teams or the maintainers is needed. PR #98 was merged with his acceptance, and the signposts required by task 4.1 redirect the other teams' agents to `leoiot-platform/`. Tasks 3.1 to 3.3 are closed on that basis.

- [x] 3.1 Link the pull request for the PV team (Daniel Lettner, Stefan Schachner) and the 3D team (Paul Kreinecker, Jonas Leitner); verify both teams have answered or reacted on the pull request before it is merged
- [x] 3.2 Get the repository maintainers' agreement to D8 (broker moves into `leoiot-platform/`, `legacy/` only loses its `mosquitto` service); verify the agreement is recorded on the pull request
- [x] 3.3 Elias Pointinger accepts the final spec for the sensors team after tasks 1.1 to 3.2; verify he has said so on the pull request

## 4. Follow-up and access (after merge)

- [x] 4.1 Propose the change `platform-broker`: broker in `leoiot-platform/` with the WebSocket listener at `/mqtt`, anonymous read-only access on `leoiot/room-climate/#`, a collector account that may publish only there, and the three browser scenarios of this contract as its acceptance tests. Its tasks must also leave signposts so that other teams' agents find the broker in `leoiot-platform/`: an entry under "Removed parts" in `legacy/README.md` naming `leoiot-platform/` as the replacement and the date it went live; the `config/pwfile` note in `legacy/README.md` moved or rewritten for the new location; `src/content/docs/{docs,en/docs}/{setup.md,interfaces.md,architecture.mdx}` describing the broker as part of `leoiot-platform/`; the status in `leoiot-platform/README.md` updated; and the `leoiot` network created by the platform instead of the legacy Compose file, so that `leoiot-pv/compose.yaml` and the legacy services keep joining it as an external network and still start after `legacy/` is deleted. Verify `openspec validate platform-broker --strict` passes and its tasks name each of these signposts
- [ ] 4.2 **(human, vm23)** Create an InfluxDB token that can only write `server_data` for the sensors collector; verify a write with it is accepted and a query with it is rejected

## 5. Sync

- [ ] 5.1 After merge, archive this change so the requirements land in `openspec/specs/platform/data-contract/spec.md`; verify `openspec show platform/data-contract --type spec` lists "Room-climate readings are stored as `room_climate`" and still lists every PV requirement
