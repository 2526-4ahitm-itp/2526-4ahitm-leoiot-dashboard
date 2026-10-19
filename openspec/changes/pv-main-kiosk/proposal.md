# Proposal

## Why

The legacy system serves five PV kiosks under addresses that grew by accident (`/leogreen/`, `/kiosk/`, `/kiosk2/`, `/kiosk3/`, `/kiosk4/`). Three of them are variants of each other, and only the layout of `/leogreen/` was approved by the teacher. That kiosk has already been rebuilt from a spec (Vite, TypeScript, tests, own container image) on the unmerged branch `feat/kiosk-rebuild`, but in the folder layout from before the restructure. This change makes it the first part of `leoiot-pv/`, puts it at the address people expect, and removes the five old kiosks without a moment in which a screen in the school shows nothing.

## What Changes

- Set up `leoiot-pv/` with its first application, `leoiot-pv/kiosk/`: the rebuilt main kiosk, with its tests, its container image and a Compose file for the PV services. This is the tech-stack and scaffolding decision the sub-project's README asks for.
- Adopt the kiosk's behaviour spec into the spec tree as `pv/main-kiosk`. It combines the requirements of the two local changes `rebuild-main-kiosk` and `fix-review-findings`; data interfaces are no longer described there but referenced from `platform/data-contract`.
- **BREAKING** `/kiosk/` shows the main kiosk instead of the legacy "Today's PV Overview" kiosk.
- `/leogreen/`, `/kiosk2/`, `/kiosk3/` and `/kiosk4/` redirect to `/kiosk/`.
- Remove from `legacy/`: the folders `kiosk/`, `kiosk2/`, `kiosk3/`, `kiosk4/`, `leogreenKiosk/`, their five Compose services, their proxy entries and the notes that only describe them.
- Update the addresses on the documentation site.

Not in this change:

- The second, more showy kiosk. It gets its own `pv-…` change and its own address after the migration is complete.
- `/dashboard/`. It stays in `legacy/` and keeps running. Its PV views are rebuilt from a new spec in a later `pv-…` change; it is listed in `leoiot-pv/README.md` as outstanding so it is not forgotten.
- The collector (`pv-solax-collector`).
- Running in Kubernetes. The container image built here is what a later deployment change uses.
- Content shown only by the removed kiosks (weather, avoided CO₂, lifetime yield, battery charge of the day). It is noted as input for the second kiosk.

## Capabilities

### New Capabilities

- `pv/main-kiosk`: what the main kiosk shows, how it behaves when data is old or missing, how it is read from a distance, and under which addresses it is reached.

### Modified Capabilities

None.

## Impact

- **Depends on** `platform-data-contract-pv` being merged first (contract-first rule).
- **New code**: `leoiot-pv/kiosk/`, `leoiot-pv/compose.yaml`, `leoiot-pv/.env.example`, `leoiot-pv/README.md`.
- **Removed code**: five folders and five services in `legacy/`; allowed by the freeze because a new implementation replaces them.
- **Host configuration**: `legacy/deploy/nginx.conf` changes and has to be copied to vm23 by hand and reloaded. Needs shell access as `solmqadmin`.
- **Screens in the school**: any screen that has `/kiosk/` or a numbered kiosk open shows a different page after the switch; screens on `/leogreen/` end up on the same kiosk in its new version.
- **Branch `feat/kiosk-rebuild`**: its kiosk code is the source for `leoiot-pv/kiosk/`. Its documentation-site commits are not part of this change and need their own pull request. The local changes `rebuild-main-kiosk` and `fix-review-findings` are superseded for the kiosk; their one open task each (acceptance) is carried over here.
- **Documentation site**: pages and diagrams that list kiosk addresses, in both languages.
