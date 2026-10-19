# Design

## Context

See `proposal.md` for motivation. What is known and how:

| Statement | Source | Certainty |
|---|---|---|
| Measurement, tag, seven fields, one-minute interval, collection-time timestamp | `legacy/solax-collector/index.js` | read from the writer |
| `consumption` formula | same file | read from the writer |
| Topic name; daily-totals shape published retained by the collector on the local broker | same file | read from the writer; fields beyond the seven used ones not verified |
| Momentary-power shape from the school broker `mqtt.htl-leonding.ac.at` | only from consumer code in `legacy/leogreenKiosk/kiosk.js`; `legacy/mqtt-ws-bridge/index.js` subscribes to it | **not verified**; it is unknown whether the school broker currently delivers |
| WebSocket messages `hello` and `pv`, no subscription needed, cached last message | `legacy/mqtt-ws-bridge/index.js` | read from the forwarder |
| A `backfill.js` run wrote points with only `daily_yield` and `consumption` | `legacy/solax-collector/backfill.js` | read; whether such points exist on vm23 is unknown |
| Bucket retention | `DOCKER_INFLUXDB_INIT_RETENTION` in the Compose file, if set; otherwise unlimited | to be read on vm23 |
| Tokens | every reader and writer uses the administrator token today | read |

## Goals / Non-Goals

**Goals:**

- A contract a PV implementation can be built and tested against without opening `legacy/`.
- No behaviour change in the running system.

**Non-Goals:**

- Sensor interfaces.
- Fixing known weaknesses of the PV interfaces (see proposal).

## Decisions

### D1. Describe what exists, do not design

Every requirement except the two named in D4 and D5 restates current behaviour. *Why:* the new kiosk is already built against these interfaces, legacy apps keep reading them for weeks, and a contract that differs from the running system on day one would be wrong for one of the two sides.

### D2. Both live message shapes are part of the contract

The topic carries two shapes from two publishers, and the forwarder keeps only the latest message whichever shape it has. The contract makes that explicit and obliges consumers to handle both.

*Alternative:* specify one shape and have the platform convert (rejected here: it changes `mqtt-ws-bridge`, which is frozen and also serves the legacy apps. It is the obvious first improvement once they are gone.)

### D3. The spec names concrete identifiers

Bucket, measurement, field and topic names appear in the spec text. *Why:* `openspec/specs/README.md` makes the contract the one place where they are written; PV specs then say "as specified in `platform/data-contract`".

### D4. Separate read and write tokens (new)

Today everything uses the administrator token. The contract asks for limited tokens because the new kiosk is built to work with a read token and the new collector needs to write only. Creating two tokens changes nothing for legacy; the administrator token stays valid until the credentials are replaced (`platform-legacy-secrets`, follow-up).

### D5. A minimum retention (new)

The contract sets a floor of eight days, which the weekly view needs. The actual value is read on vm23 and written into the spec before merge; if the bucket is unlimited today, the spec says so and the backup concept (issue #54) decides the final value.

### D6. Verification before merge is the implementation

Tasks record real data from vm23 and compare it with each requirement. Where reality differs, the spec is corrected, not the system.

## Risks / Trade-offs

- **The momentary-power shape is wrong or the school broker is silent** → task 1.3 records the topic for a day. If nothing arrives, the shape stays in the contract as "may arrive" and the kiosk's fallback (power computed from totals) is the normal case; the spec text is adjusted to say which.
- **Partial points from an old backfill** → task 1.2 counts them. If they exist, the first requirement gains a sentence that points before a given date may lack fields.
- **The sensors team writes a competing contract** → same capability path; their change adds requirements to this spec. Not agreed with them beforehand, because the PV team decides on its part itself.
- **Contract freezes known flaws** → intended for the migration; the compatibility requirement ends when the last legacy reader is removed.

## Open Questions

- Who becomes the permanent owner of the `platform` group? Until decided, the PV team decides on the PV part of the contract itself.
