# Design

## Context

See `proposal.md` for motivation. What the legacy collector does (`legacy/solax-collector/index.js`, 117 lines), used here only to know the behaviour that has to be matched:

- Logs in at the SolaX cloud (`/openapi/auth/get_token`) and keeps the session in memory. It discards the session only on two specific error codes.
- Every 60 seconds it requests `/openapi/v2/plant/realtime_data` for one plant, computes `consumption`, writes one point with the current time as timestamp, and publishes the whole answer retained on the PV live topic of the local broker.
- All errors are logged and the cycle is skipped. A missing value produces an invalid write that the database rejects. There is no restart policy and no health check.
- `backfill.js` is a manual script that once loaded seven days of two fields. It is not a running service.

Readers of its output: the kiosk at `/kiosk/` (database and live channel) and the legacy `/dashboard/`.

The values are running totals of the day. A missing minute therefore loses nothing: the next point carries the full total again.

## Goals / Non-Goals

**Goals:**

- Readers cannot tell which collector wrote a point.
- The switch is one planned minute and can be undone by starting the old service.
- The known operational weaknesses are gone: no credentials in code, self-recovery, restart, health.

**Non-Goals:**

- Changing or extending the data (see proposal).
- Buffering readings during a database outage. The totals make that unnecessary.

## Decisions

### D1. Stack: Node 22 and TypeScript, as the kiosk

`leoiot-pv/collector/` has its own `package.json`, tests with Vitest and a `Dockerfile` producing a small image that runs the compiled program. HTTP uses the built-in `fetch`; the only runtime dependency is the MQTT client.

*Why:* one language and one test runner in `leoiot-pv/`, and the team already works in it. *Alternative:* Telegraf with an HTTP input (rejected: the login flow, the derived field and the retained raw message need scripting there too, and it would be the third way of writing data in the project).

### D2. Structure follows the three outside systems

Pure functions turn a cloud answer into a contract point and a contract message and decide whether a reading is complete; three thin adapters talk to the cloud, the database and the broker; one loop ties them together. Tests run the loop against local fake servers for the cloud and the database and assert the exact line written and message published.

*Why:* the comparison with the legacy collector depends on byte-level agreement of what is written, and that is testable without the real cloud.

### D3. Session handling: log in again on any authorisation failure

A rejected data request (HTTP 401 or 403, or a cloud error code outside the success code) discards the session; the next cycle logs in again. A failed login is retried at the next cycle, not faster.

*Why:* the legacy code names two codes and stays stuck on any other. Retrying only once a minute keeps the request rate towards the cloud what it is today.

### D4. Completeness check before delivering

A reading is delivered only if all values the contract requires are finite numbers. Otherwise nothing is written or published for that minute and the log names the value.

### D5. Timestamp and interval as before

The timestamp is the collection time and the interval is a fixed 60 seconds from start, as the contract states.

### D5a. Values are stored as received

The collector does not smooth or correct values. On some days a daily counter of the cloud steps back by a few kWh for some minutes (seen on 4 of 30 days up to 2026-10-13, mostly `daily_imported`); the collector stores that as received and only logs it. *Why:* stored readings are the record of what the plant reported; a correction at write time cannot be undone, while readers can treat the data for their purpose (the kiosk reads each counter as its highest value so far that day). It also keeps the comparison with the legacy collector exact. Decided with Daniel on 2026-10-14.

### D6. Deployment and health

A service `collector` in `leoiot-pv/compose.yaml` on the same external network as the kiosk, with `restart: unless-stopped`. The process writes the time of its last delivered reading to a file; the container health check fails when that time is older than five minutes. Credentials come from `leoiot-pv/.env`: the SolaX login, the plant identifier, the write token from `platform-data-contract-pv` and the broker login.

Two settings exist for the comparison run: the bucket name and a switch that turns publishing off.

### D7. Short check against the real cloud, then a hard switch (revised 2026-10-14)

The first plan ran both collectors side by side for a day. That is not possible: the SolaX cloud keeps only one valid session per account. On 2026-10-14 a two-minute local run of the new collector invalidated the legacy collector's session and the other way round (error code 10402 on both sides); production lost one point (05:23:33 UTC) until the new collector was stopped. A day of parallel running would have halved the production data.

The equality check is therefore done with the readings already taken: the two points the new collector wrote on 2026-10-14 at 05:23 and 05:24 UTC are identical in all seven fields to the legacy points of the same minutes, and the line format is byte-equal by construction and by test. Decided with Daniel on 2026-10-14: switch without a comparison day, as long as everything keeps working as before.

```
 now     legacy collector -> server_data, topic (unchanged)
 switch  stop legacy service, confirm it is stopped -> start new on server_data, publishing on
 week    legacy service stays defined but stopped (rollback)
 after   remove legacy/solax-collector and its service, delete pv_shadow
```

Rule for the whole change: the new collector never runs against the real cloud while the legacy one runs, and the other way round. Tests and health checks use a local stand-in for the cloud.

**Rollback** during the week: stop the new service, then start the legacy one. No data has to be repaired; one or two minutes may be missing around each switch.

### D8. The legacy collector's secrets

The legacy service keeps running until the switch. Its credentials leave the repository's current tree with the removal of `legacy/solax-collector/` (done in #59); they stay in the Git history. Moving the other legacy credentials out of the repository is not part of the PV work (decided by Daniel on 2026-10-19).

## Risks / Trade-offs

- **Two collectors use the account at the same time** (by mistake, or a rollback that starts the old one before the new one is stopped) → they invalidate each other's session and each loses every other minute. The switch and the rollback always stop one before starting the other and check the log for code 10402.
- **The cloud's answer has a shape the tests did not expect** → the two real readings of 2026-10-14 had the expected shape; the completeness check keeps bad readings out, and the rollback is one minute away.
- **Both collectors write to the real bucket by mistake** → the switch task stops and checks the legacy service first; the new one starts in production mode only by an explicit setting.
- **The switch falls into the day change** → done during daylight on a normal day, away from midnight.
- **A reader depended on an unspecified field of the raw message** → the new collector publishes the complete cloud answer as before, not a reduced one; the contract only names the minimum.
- **The write token cannot do what the administrator token did** → the collector only writes; verified with the write token for `pv_shadow` (write accepted, other bucket and queries refused) before the switch.

## Migration Plan

As in D7. Steps on `main`: (1) collector code and Compose service, defaulting to the test bucket with publishing off; (2) the production setting, right before the switch; (3) after a week, the removal from `legacy/`.

## Open Questions

- Could the SolaX account get a second API access for the same plant? Not needed any more; it would only allow a parallel run in a later change.
