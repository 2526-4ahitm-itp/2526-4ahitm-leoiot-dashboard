# Proposal

## Why

The last PV part still in `legacy/` is the PV view of `/dashboard/` (`legacy/dashboard-v2/`). It logs in to the SolaX cloud from the browser with a client secret and a password that are delivered to every visitor, shows missing values of past days as 0, and offers only time windows (1 h to 7 days) that fit poorly with daily counters. The main kiosk already answers "what is happening now and today" on a screen nobody operates; what is missing is a place where students, teachers and the building services look things up on their own device: a chosen day, a week, a month, a year. Issue #64 (part of #55) asks for this view to be rebuilt in `leoiot-pv/`.

## What Changes

- New application `leoiot-pv/dashboard/` at the address `/pv/`: the PV dashboard with the views day, week, month and year, live power for today, and the ratios autarky and self-consumption rate. Desktop and phone, German and English, light and dark theme, view and date in the address.
- New local package `leoiot-pv/shared/` with what kiosk and dashboard both need: the definitions of the energy quantities, Vienna day boundaries, the database query, number formatting and the live channel. The kiosk is switched to it without changing what it shows.
- Three clickable design previews before the views are built; Daniel picks one.
- The dashboard service joins `leoiot-pv/compose.yaml` and reads with the kiosk's existing read token, injected by its own nginx; no credential reaches the browser.
- After acceptance: in `legacy/dashboard-v2/` the button "PV System" becomes a link to `/pv/`, the legacy PV view and its SolaX login are removed, and the proxy entry `/solax/` disappears from `legacy/deploy/nginx.conf`. The sensor views stay unchanged.
- **BREAKING** (after acceptance only) The PV tab of `/dashboard/` no longer shows PV data itself but leads to `/pv/`.
- Every value is explained (info per quantity, a reading guide with flow sketch, formulas and kW/kWh), and the views show technical key figures: peaks and base load of a day, extremes, means and data completeness of a period (added 2026-10-20 after Daniel's review, so that teachers understand what they see).
- Documentation site and `leoiot-pv/README.md` name the new address.

Not in this change:

- A view of the whole lifetime, avoided CO₂, savings in euro.
- Running in Kubernetes; the image built here is what a later deployment change uses.
- The market analysis of #55 and the second kiosk.
- Anything in the sensor part of `dashboard-v2`.

## Capabilities

### New Capabilities

- `pv/dashboard`: what the PV dashboard shows in each view and for whom, how quantities and ratios are defined, how missing and old data appear, how it is operated (navigation, address, language, theme, phone), and under which address it is reached.

### Modified Capabilities

None. `pv/main-kiosk` keeps its requirements; the kiosk only moves code into `leoiot-pv/shared/`.

## Impact

- **Depends on** `platform-ci-build-context` being merged first: CI builds every image with its own folder as the build context and does not notice that a change in `leoiot-pv/shared/` affects kiosk and dashboard.
- **Data**: only interfaces of `platform/data-contract` (stored PV readings, live channel). No new interface; no `platform-…` contract change.
- **New code**: `leoiot-pv/shared/`, `leoiot-pv/dashboard/`; changed: `leoiot-pv/kiosk/` (imports, Dockerfile build context), `leoiot-pv/compose.yaml`, `leoiot-pv/README.md`.
- **Legacy**: `legacy/dashboard-v2/` loses its PV view (allowed by the freeze, a new implementation replaces it). The sensor views share the files `dashboard.js`, `index.html` and `style.css` with it; the Sensoren team is told before the change ships.
- **Host configuration**: `legacy/deploy/nginx.conf` gains `/pv/` and later loses `/solax/`; both are applied on vm23 by hand (needs shell access as `solmqadmin`).
- **CI and deployment**: a smoke route `/pv/` in `.github/ci/smoke-routes`, in a pull request of its own once `/pv/` is live.
- **Documentation site**: pages that list the PV addresses, in both languages.
