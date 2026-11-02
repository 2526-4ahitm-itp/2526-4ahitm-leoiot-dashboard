# Design

## Context

See proposal.md for the motivation. The evidence is a query of all falls of the daily fields in `solax_stats` over the 30 days up to 2026-10-13: 99 falls, 83 of them between 00:07 and 00:09 plant local time (the day change, 7 to 9 minutes after midnight), 16 at other times on 4 days, up to 7 kWh, 13 of them in `daily_imported`. The collector spec and the main kiosk spec already handle step backs, each for its own side; the contract does not mention them.

## Goals / Non-Goals

**Goals:**
- One rule every reader of `solax_stats` can rely on to tell the day change from a step back.

**Non-Goals:**
- Changing what is stored. Old points keep their step backs.
- Changing `legacy/` readers.

## Decisions

### D1. Store as delivered, readers take the daily maximum

The writer keeps the value from the cloud service; readers read each field as its highest value so far that day.

Alternative: the collector clamps each field to its daily maximum before writing. Rejected because the stored data would no longer show what the plant reported, the 30 days already stored would still contain step backs, and every reader would need the rule for old data anyway.

### D2. Day change = fall in the first 30 minutes or a fall of the sum to less than half

This is the rule the main kiosk has used since 2026-10-13 (`pv-main-kiosk` D10). 30 minutes leaves a wide margin over the observed 7 to 9 minutes. The halving of the sum catches a day change that is delayed beyond 30 minutes; a step back of one field by a few kWh never halves the sum after the first minutes of the day.

Alternative: day change = the plant-local date changes. Rejected because the first points after midnight still carry the totals of the day before, so they would be counted for the new day.

## Risks / Trade-offs

- [A step back within the first 30 minutes is taken for the day change] → in those minutes the daily fields are near zero or still hold the day before; a reader at worst assigns a few minutes of the night to the wrong day, which shifts no visible total.
- [A real day change more than 30 minutes late with a nearly unchanged sum] → not observed; the rule is written down so a reader that meets it can report it against this requirement.
