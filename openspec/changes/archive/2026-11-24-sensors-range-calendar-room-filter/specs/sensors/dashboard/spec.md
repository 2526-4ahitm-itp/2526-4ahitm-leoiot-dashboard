# Spec Delta

## MODIFIED Requirements

### Requirement: Time ranges and chosen dates
The dashboard SHALL offer the last 24 hours, the default, and the last 7 days, both ending now, and a range of chosen dates. The dates SHALL be chosen through a control placed with the two ranges and styled like them; while no dates are shown it SHALL show only a calendar icon, with "Zeitraum wählen" as its accessible name. It SHALL open one calendar in which the first and the last day are picked one after the other, showing the days in between as part of the range; picking a day before the first day SHALL start a new range, and one day SHALL be a range whose first and last day are the same. Every day from 13 months before today up to today SHALL be allowed and days outside that span SHALL NOT be pickable. A chosen range SHALL be shown from 00:00 of the first day to 24:00 of the last day in local time; when the last day is today it SHALL end now and keep updating like the last 24 hours. Exactly one of the two ranges or the chosen dates SHALL be selected at a time, and the control SHALL show which one, for chosen dates with the dates. Each chart SHALL state the start and end of the shown range. The last 24 hours SHALL be shown as means of five-minute windows and the last 7 days as means of thirty-minute windows; chosen dates SHALL be shown as means of five-minute windows up to 2 days, thirty-minute windows up to 14 days, four-hour windows up to 93 days and one-day windows beyond, with windows aligned to local time. The selected range SHALL change only the charts; the current values, the air state and the day summary SHALL stay on the present. Times SHALL be shown in the school's local time (Europe/Vienna).

#### Scenario: Switching to 7 days
- **WHEN** a visitor switches to 7 days on Friday 23 October 2026 at 10:41
- **THEN** all three charts show 16 October 10:41 to 23 October 10:41 and state that range

#### Scenario: Control without chosen dates
- **WHEN** the last 24 hours are shown
- **THEN** the date control shows only the calendar icon and a screen reader announces it as "Zeitraum wählen"

#### Scenario: Choosing several past days
- **WHEN** a visitor on room `105` opens the calendar, clicks 16 November 2026, then 20 November 2026, and chooses "Anzeigen"
- **THEN** 16 to 20 November are marked as one range in the calendar, all three charts show 16 November 00:00 to 21 November 00:00 as thirty-minute means and state that range, the control shows the icon and the dates as selected, "24 h" and "7 Tage" are not, and the lamp and the current values still show the present

#### Scenario: Choosing one day
- **WHEN** a visitor clicks 17 November 2026 once, or twice, and chooses "Anzeigen"
- **THEN** the charts show 17 November 2026 from 00:00 to 24:00 as five-minute means

#### Scenario: First day after the last day
- **WHEN** a visitor has clicked 20 November 2026 as first day and then clicks 17 November 2026
- **THEN** 17 November becomes the first day and the calendar waits for the last day; no error is shown

#### Scenario: Range ending today
- **WHEN** a visitor chooses 20 November 2026 to today, 23 November 2026, at 10:41
- **THEN** the charts show 20 November 00:00 to 23 November 10:41 and keep adding new readings

#### Scenario: A long range
- **WHEN** a visitor chooses 1 January 2026 to 31 October 2026
- **THEN** the charts show one-day means, each day from 00:00 to 24:00 local time

#### Scenario: Back to the last 24 hours
- **WHEN** chosen dates are shown and the visitor chooses "24 h"
- **THEN** the charts show the last 24 hours and the control shows only the calendar icon again

#### Scenario: Days outside the allowed span
- **WHEN** a visitor opens the calendar on 23 November 2026
- **THEN** days after 23 November 2026 and before 23 October 2025 cannot be picked, and the calendar cannot be paged past November 2026 or before October 2025

#### Scenario: Keyboard only
- **WHEN** a visitor opens the calendar with the keyboard, moves with the arrow keys and picks two days with Enter
- **THEN** each day is announced with its full date, the picked range is announced, and "Anzeigen" shows it

#### Scenario: Range without readings
- **WHEN** a visitor chooses a range in which the room delivered nothing
- **THEN** each chart says that there are no values in that range, never a line at zero

## ADDED Requirements

### Requirement: The room list can be searched and filtered by floor
The room list SHALL offer a search field and a floor filter above the floors. The search SHALL match, as the visitor types and ignoring case and spaces, every room whose room id contains the entered text. The floor filter SHALL offer "Alle" and each floor that has rooms in the list, and exactly one of them SHALL be selected. Search and floor SHALL combine; floors without a matching room SHALL be hidden. While a filter is active the list SHALL say how many of its rooms are shown; when no room matches it SHALL say so and offer to reset the filter. The summary line SHALL keep counting all rooms. Search text and floor SHALL be kept in the address, so that a reload, going back from a room page and a shared link show the same filter. Filtering SHALL NOT reset the field or move the focus when the list updates.

#### Scenario: Searching a room
- **WHEN** a visitor types "10" into the search field while 107 rooms are listed
- **THEN** only rooms whose id contains "10" are shown, grouped by floor, and the list says how many of the 107 rooms are shown

#### Scenario: One floor
- **WHEN** a visitor chooses "1. Stock"
- **THEN** only the rooms of the first floor are shown and the summary line still counts all rooms

#### Scenario: No match
- **WHEN** a visitor searches "xyz" on the ground floor
- **THEN** the list says that no room matches and offers a button that resets search and floor

#### Scenario: Back from a room
- **WHEN** a visitor filters by "Erdgeschoss", opens room `E11` and goes back
- **THEN** the list shows the ground floor filter again

#### Scenario: Live updates while typing
- **WHEN** new readings arrive while the visitor types in the search field
- **THEN** the values update and the field keeps its text and focus
