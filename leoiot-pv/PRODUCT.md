# Product

<!-- impeccable:product-schema 1 -->

Scope: the PV part of LeoIoT (`leoiot-pv/`): the main kiosk, the PV dashboard and the planned second kiosk. Confirmed by Daniel Lettner on 2026-10-19.

## Platform

web

## Users

- **Students and teachers of HTL Leonding** looking up what the school's photovoltaic system produced on a day, in a week, month or year, on their own laptop or phone; teachers also in class.
- **Building services and school management** checking that the system runs and how grid import, feed-in and self-sufficiency develop over months and seasons.
- **Visitors of the school** see the PV data mainly on the kiosk screen in the building, which nobody operates.

## Product Purpose

Show clearly what the school's PV system produces and where the energy goes (own use, battery, grid), so that people understand why the system is worth having (issue #55). Success: a student finds the numbers of a given day or month within seconds, and the numbers agree with the plant's own portal.

Two surfaces with different jobs:

- **Kiosk** (`/kiosk/`): now and today at a glance, full screen on a TV, read from a distance, no operation.
- **Dashboard** (`/pv/`): looking things up and comparing on one's own device; views day, week, month and year.

## Positioning

The data come from the school's own plant, collected every minute, and are presented with one consistent set of definitions across kiosk and dashboard. No invented comparisons or estimates.

## Operating Context

- Runs on the school server vm23 behind nginx; devices may reach only the school network, so nothing is loaded from foreign servers at run time.
- Data: stored readings once per minute and a live channel for momentary power, both specified in `openspec/specs/platform/data-contract/spec.md`. Complete readings exist from 2026-04-20 on; before that only production is reliable.
- Behaviour of each surface is specified in OpenSpec: `pv/main-kiosk`, `pv/dashboard` (`openspec/changes/pv-dashboard/`).

## Capabilities and Constraints

- Quantities and their names, identical everywhere: Produktion, Verbrauch, Eigenverbrauch, Ins Netz, Vom Netz, In Batterie, Von Batterie; ratios Autarkie and Eigenverbrauchsquote (dashboard).
- Each quantity has one colour by origin (PV, consumption, grid, battery), the same in kiosk and dashboard.
- Missing values are shown as unknown, never as zero.
- Dashboard: German and English, light and dark theme, desktop and phone from 360 px.
- No credentials ever reach the browser.

## Brand Commitments

- The design tokens of the documentation site (`src/styles/tokens.css`: system font stack, colours, spacing, radii, motion) are binding; the kiosk uses the same values (`leoiot-pv/kiosk/src/styles/tokens.css`) plus its data colours `--c-pv`, `--c-verbrauch`, `--c-netz`, `--c-batterie`.

## Evidence on Hand

- Real readings in InfluxDB on vm23; sample readings and checks in `/home/daniel/leoiot/contract-samples/` (outside the repository).
- No testimonials, savings figures or CO₂ factors exist; do not invent them.

## Product Principles

1. One definition of every number, everywhere.
2. Honest about gaps: unknown is shown as unknown, old data as old.
3. Each view answers one stated question for a stated audience.
4. Readable first, attractive second, never at the cost of the numbers.

## Accessibility & Inclusion

Contrast at least 4.5:1 in both themes, operable by keyboard, quantities recognisable by name and not only by colour, reduced motion respected.
