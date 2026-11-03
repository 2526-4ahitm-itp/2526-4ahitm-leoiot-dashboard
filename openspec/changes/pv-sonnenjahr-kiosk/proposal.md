# Proposal

## Why

Issue #55 asks for a presentation that is "creative and not boring", and #123 for a second kiosk that makes visitors notice the PV system when they walk past. The main kiosk at `/kiosk/` answers questions about today with four panels; it is read, not watched. Daniel worked out the second kiosk with clickable prototypes on 2026-11-02 and chose the film "Unser Sonnenjahr" in the light "Morgenglut": the past year of the school's own readings as a mountain landscape that a point of light draws day by day.

## What Changes

- New application `leoiot-pv/kiosk2/`: a full-screen film without sound and without operation, about 100 seconds, looping without a cut.
  - Each of the last 365 days with readings becomes a mountain ridge. Left on the screen is morning, right is evening, the height is the PV power at that time of day.
  - A point of light draws the first day slowly with the time and the power next to it. Then the film speeds up into a time-lapse in which whole days rise out of a sea of fog.
  - Always on screen: "Solaranlage der HTL Leonding", the date of the day being drawn and a running counter of the energy produced.
  - Large moments: the best day of the year, a milestone every 10 000 kWh, the power right now, the lifetime yield and the avoided CO₂. At the end the year runs backwards into the start of the next loop.
- **BREAKING** `/kiosk2/` shows this film. Since 2026-10-19 the address redirects permanently (301) to `/kiosk/`; that redirect ends. The requirement "Former kiosk addresses lead to the kiosk" in the change `pv-main-kiosk` loses `/kiosk2/`.
- Avoided CO₂ is shown with a stated factor: 169 g CO₂-equivalent per kWh, derived from the Umweltbundesamt report REP-0948 (2025), table 4. `leoiot-pv/PRODUCT.md` so far says no CO₂ factor exists; it is updated together with three deliberate exceptions for this kiosk: its own typefaces, its own colours instead of the data colours, and "astonish first, every number true" instead of "readable first, attractive second".
- New container on port 8093 and an entry in the platform proxy. The documentation site lists the new address.

Not in this change:

- Weather, battery and autarky of the day: decided against on 2026-11-02.
- Changes to the data contract: the film uses only `solax_stats` and the live channel as they are specified.
- Which screen in the school shows the film. That is decided with the teacher, as for the main kiosk (#120).
- Kubernetes: the container image is what a later deployment change uses.

## Capabilities

### New Capabilities

- `pv/sonnenjahr-kiosk`: what the film shows, how it reads its data, how it stays honest about missing and outdated data, how it is read from a distance and under which address it is reached.

### Modified Capabilities

None in `openspec/specs/`. The requirement "Former kiosk addresses lead to the kiosk" is still in the open change `pv-main-kiosk` and not yet in the spec tree; that change's delta is edited in the same pull request so that it no longer lists `/kiosk2/`.

## Impact

- **New code**: `leoiot-pv/kiosk2/` with its tests, Dockerfile and nginx template. It uses `leoiot-pv/shared/` and adds nothing to it unless a function is needed by two applications.
- **New dependencies**: Three.js for rendering; the typefaces Instrument Serif and DM Mono (SIL Open Font License) bundled with the application.
- **Shared files**: `leoiot-pv/compose.yaml` (new service), `leoiot-platform/proxy/nginx.conf` (`/kiosk2/` proxies instead of redirecting), `.github/ci/smoke-routes` (already lists `/kiosk2/`), documentation site pages that list addresses, in both languages.
- **Host configuration**: the proxy file has to be installed on vm23 and nginx reloaded. That needs `sudo` and is done by Daniel.
- **Browsers that cached the 301**: a browser that opened `/kiosk2/` since 2026-10-19 may keep sending it to `/kiosk/` until its cache is cleared. No screen in the school shows a kiosk yet (task 4.1 of `pv-main-kiosk`), so no screen is affected.
- **Hardware**: whether the school TV renders itself or receives a stream is unknown. The film adapts its rendering to the device, and acceptance happens on the real screen.
- **Issue**: #123, part of #55 criterion 4.
