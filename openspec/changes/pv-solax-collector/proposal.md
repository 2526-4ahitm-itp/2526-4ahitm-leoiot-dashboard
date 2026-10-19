# Proposal

## Why

All PV data in LeoIoT comes from one small service, `legacy/solax-collector`, which asks the SolaX cloud once a minute and writes the answer to the database and the broker. It works, but it carries its credentials as fallback values in code, keeps a rejected login until it is restarted, writes an invalid point when the cloud leaves out a value, and is not restarted when it stops. It is also the last PV part that writes data, so `leoiot-pv/` cannot be complete without it. This change rebuilds it in `leoiot-pv/` so that it does exactly what the old one does for every reader, and replaces the old one without a gap anyone would notice.

## What Changes

- Add `leoiot-pv/collector/`: a new collector that reads the plant's values from the SolaX cloud every minute, stores them and publishes them as specified in `platform/data-contract`.
- It takes all credentials from its environment, recovers by itself from a rejected login and from unreachable services, never writes an incomplete reading, and is restarted if it stops.
- Check it against the real cloud for a few minutes and compare its readings with the legacy ones, then switch. A day of running both side by side is not possible, because the SolaX cloud keeps only one valid session per account (found on 2026-10-14).
- **BREAKING** for operators: at the switch the legacy service `solax-collector` is stopped and the new one takes over; only one of the two may write to the real bucket.
- Remove `legacy/solax-collector/` including `backfill.js` and its Compose service once the new collector has run for a week.

Not in this change:

- Any change to what is stored or published. Field names, the `consumption` formula, the topic and the one-minute interval stay as the contract states them.
- Momentary power from the SolaX cloud, or filling gaps after an outage. Both are improvements that need a contract change first.
- A replacement for `backfill.js`. If old values ever have to be loaded again, that is its own task.

## Capabilities

### New Capabilities

- `pv/solax-collector`: collecting the plant's readings from the SolaX cloud and delivering them to the database and the broker, including behaviour on errors.

### Modified Capabilities

None.

## Impact

- **Depends on** `platform-data-contract-pv` (contract and a write token) and on `pv-main-kiosk` (the `leoiot-pv/` scaffold and Compose file).
- **New code**: `leoiot-pv/collector/`, one more service in `leoiot-pv/compose.yaml`, more names in `leoiot-pv/.env.example`.
- **Removed code**: `legacy/solax-collector/` and its service; allowed by the freeze because a new implementation replaces it.
- **Readers**: the kiosk at `/kiosk/` and the legacy `/dashboard/` read what the collector writes. They must see no difference.
- **vm23**: a test bucket for one day, a write token, a planned switch of about one minute. Needs shell access as `solmqadmin`.
- **External**: the SolaX cloud account stays the same; the request rate does not change after the switch and doubles for the one day both collectors run.
