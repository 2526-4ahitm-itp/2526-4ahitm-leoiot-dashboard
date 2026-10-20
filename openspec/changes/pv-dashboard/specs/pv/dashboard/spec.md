# Spec Delta

## Purpose

Describes the PV dashboard: a page on one's own device where students, teachers and the building services look up what the school's photovoltaic system produced and where the energy went, for a chosen day, week, month or year. The main kiosk shows "now and today" on a screen nobody operates; the dashboard is for looking things up and comparing. Labels are quoted in German as they appear; the English labels are listed in design decision D9a.

## ADDED Requirements

### Requirement: The dashboard is reached at `/pv/`
The PV dashboard SHALL be served at the address `/pv/` of the LeoIoT host.

#### Scenario: Opening the address
- **WHEN** a browser opens `/pv/` or `/pv`
- **THEN** it shows the PV dashboard with the day view of today

### Requirement: Four views with one question each
The dashboard SHALL offer the views "Tag", "Woche", "Monat" and "Jahr", switchable at any time. Each view answers one question:

| View | Question | For whom |
|---|---|---|
| Tag | What did the system produce on this day, how much did the school use, and where did the energy come from and go to? For today additionally: what is happening right now? | students and teachers looking up a day, building services checking that the system runs |
| Woche | How did the days of this week compare? | students and teachers, building services |
| Monat | How did the days of this month compare, and what did the month add up to? | building services and school management, teachers in class |
| Jahr | How do the months compare over the seasons, and what did the year add up to? | building services and school management, teachers in class |

Week means the calendar week from Monday to Sunday, month the calendar month and year the calendar year, all in Vienna time.

#### Scenario: Switching the view
- **WHEN** the day view of 15 October 2026 is open and "Woche" is chosen
- **THEN** the week from Monday 12 to Sunday 18 October 2026 is shown

#### Scenario: Week across a month boundary
- **WHEN** the week of 1 October 2026 is shown
- **THEN** it covers Monday 28 September to Sunday 4 October 2026

### Requirement: Moving through time
Every view SHALL allow moving one period back and forward and choosing a date directly. Periods after today SHALL NOT be reachable. Moving back SHALL stop at the period of the earliest stored PV reading.

#### Scenario: Today is the end
- **WHEN** the week of today is shown
- **THEN** the control for the next week is disabled

#### Scenario: Going back
- **WHEN** the month view of October 2026 is shown and "back" is chosen
- **THEN** September 2026 is shown

#### Scenario: Drilling down
- **WHEN** a day in the week or month view, or a month in the year view, is selected
- **THEN** the day view of that day, or the month view of that month, opens

### Requirement: View and date are part of the address
The chosen view and period SHALL be part of the address, so that a link opens the same view, reloading keeps it, and the browser's back button returns to the previous view. An address with an unknown view or an impossible date SHALL open the day view of today.

#### Scenario: Shared link
- **WHEN** a teacher sends the address of the month view of September 2026 and a student opens it
- **THEN** the student sees the month view of September 2026

#### Scenario: Back button
- **WHEN** the year view is opened from the month view and the back button is pressed
- **THEN** the month view is shown again

#### Scenario: Broken address
- **WHEN** the address names the date 2026-02-30
- **THEN** the day view of today is shown

### Requirement: One definition of every quantity
The dashboard SHALL use the same names and definitions as the main kiosk: Produktion, Verbrauch, Eigenverbrauch, Ins Netz, Vom Netz, In Batterie, Von Batterie, with Eigenverbrauch = Produktion − Ins Netz − In Batterie (never below 0) and Verbrauch = Eigenverbrauch + Vom Netz + Von Batterie. It SHALL compute them from the stored PV readings specified in `platform/data-contract`. Each quantity SHALL carry the same colour as in the kiosk.

#### Scenario: Same day in kiosk and dashboard
- **WHEN** a day's readings are Produktion 410.0 kWh, Ins Netz 52.0 kWh, In Batterie 60.0 kWh, Vom Netz 18.0 kWh and Von Batterie 40.0 kWh
- **THEN** the dashboard shows Eigenverbrauch 298 kWh and Verbrauch 356 kWh, the same values as the kiosk for that day

### Requirement: Autarky and self-consumption rate
For every period with complete readings the dashboard SHALL show "Autarkie" = (Verbrauch − Vom Netz) / Verbrauch and "Eigenverbrauchsquote" = (Produktion − Ins Netz) / Produktion, as whole percentages. Each SHALL be explained in one sentence on the page. If the denominator is 0, the ratio SHALL be shown as not available instead of a number.

#### Scenario: Summer day
- **WHEN** a day has Produktion 410.0 kWh, Ins Netz 52.0 kWh, In Batterie 60.0 kWh, Vom Netz 18.0 kWh and Von Batterie 40.0 kWh
- **THEN** "Autarkie" reads 95 % and "Eigenverbrauchsquote" reads 87 %

#### Scenario: No production
- **WHEN** a day has Produktion 0 kWh
- **THEN** "Eigenverbrauchsquote" shows "–" with the note that nothing was produced

### Requirement: Day view
The day view SHALL show the day's totals of all quantities with Autarkie and Eigenverbrauchsquote, and the course of Produktion and Verbrauch in kW over the day from 00:00 to 24:00 in Vienna time. A day's total SHALL be the last stored value of that day.

#### Scenario: Past day
- **WHEN** the day view of 14 October 2026 is open
- **THEN** it shows the totals at the end of that day and both curves over the full day

#### Scenario: Day with 25 hours
- **WHEN** the day view of 25 October 2026 is open
- **THEN** the time axis covers the 25 hours of that day and no reading is drawn twice or dropped

#### Scenario: A counter steps back
- **WHEN** a stored daily counter is lower than a few minutes before at a time that is not the start of the day
- **THEN** the curves before that moment stay visible and no power is drawn for the step back, as in the kiosk

### Requirement: Today shows live power
In the day view of today the dashboard SHALL additionally show the current power in kW of Produktion, Verbrauch, grid and battery with the direction in words ("Bezug" or "Einspeisung", "lädt" or "entlädt"). If the values come from momentary-power messages of the PV live data specified in `platform/data-contract` that are at most two minutes old, they SHALL be labelled "Live"; otherwise they SHALL be computed from the stored readings of the last ten minutes and labelled "Ø letzte 10 Min". Totals and curves of today SHALL update at least once a minute without reloading the page.

#### Scenario: Live values present
- **WHEN** a live message with momentary power arrived 30 seconds ago with Produktion 62.4 kW and grid −8.1 kW
- **THEN** the dashboard shows 62.4 kW for Produktion, 8.1 kW "Bezug" for the grid, and the label "Live"

#### Scenario: No live values
- **WHEN** no live message with momentary power has arrived for more than two minutes
- **THEN** the power values are computed from the last ten minutes of stored readings and labelled "Ø letzte 10 Min"

#### Scenario: Past day
- **WHEN** the day view of a past day is open
- **THEN** no live power is shown

### Requirement: Week and month views
The week and month views SHALL show Produktion, Verbrauch, Vom Netz and Ins Netz in kWh per day as bars, and the totals of the period for all quantities with Autarkie and Eigenverbrauchsquote. Days after today SHALL stay empty. The current day SHALL show its value so far and be marked as not finished.

#### Scenario: Current week
- **WHEN** the week view of today is open on Wednesday 21 October 2026 at 14:00
- **THEN** Monday and Tuesday show their end-of-day values, Wednesday shows its value so far marked as not finished, and Thursday to Sunday are empty

#### Scenario: Period totals
- **WHEN** a week's days have Produktion 300, 280, 0, 310, 295, 120 and 90 kWh
- **THEN** the week's Produktion reads 1395 kWh

### Requirement: Year view
The year view SHALL show Produktion, Verbrauch, Vom Netz and Ins Netz in kWh per month as bars, and the totals of the year for all quantities with Autarkie and Eigenverbrauchsquote. Months after the current month SHALL stay empty.

#### Scenario: Seasons
- **WHEN** the year view of 2026 is open in October 2026
- **THEN** January to October show their bars, the current month marked as not finished, and November and December are empty

### Requirement: Missing readings are unknown, not zero
A quantity that the stored readings do not carry for a day SHALL be shown as unknown ("keine Daten") and never as 0. A total over a period SHALL be marked as incomplete if one of its days lacks the quantity, and SHALL name how many days are missing. Autarkie and Eigenverbrauchsquote SHALL be computed only over days with all quantities, and the page SHALL say so when days were left out. A day without any reading SHALL be shown as a gap.

#### Scenario: Day before complete readings
- **WHEN** the day view of 10 April 2026 is open and that day's readings carry only production and the field `consumption`
- **THEN** Produktion is shown, Vom Netz, Ins Netz, In Batterie, Von Batterie, Eigenverbrauch, Verbrauch, Autarkie and Eigenverbrauchsquote read "keine Daten" with a note that these values are recorded from 20 April 2026 on

#### Scenario: Month with partial data
- **WHEN** the month view of April 2026 is open
- **THEN** the month's Produktion is a full total, the other quantities are marked "unvollständig, 19 Tage ohne Daten", and the ratios name that they cover 20 to 30 April

#### Scenario: Collection interrupted for a day
- **WHEN** there is no stored reading for one day of a week
- **THEN** that day shows no bar and a mark "keine Daten", and the week's totals are marked as incomplete with one missing day

### Requirement: Data age and outages are visible
The dashboard SHALL show the time of the most recent reading. If it is older than five minutes while today is shown, the dashboard SHALL mark the data as outdated. If the data source does not answer, the dashboard SHALL say so in words instead of showing empty charts, and SHALL load the data by itself as soon as the source answers again.

#### Scenario: Outdated data
- **WHEN** the most recent reading is from 10:00 and it is 10:20
- **THEN** the page shows "10:00" as the update time and a note that the data is outdated

#### Scenario: Data source unreachable
- **WHEN** the data source does not answer while the month view is open
- **THEN** a note in words replaces the chart, and the chart appears without reloading once the source answers again

### Requirement: Every value is explained
Every quantity and both ratios SHALL carry an info control that shows, in the chosen language, what the value means in one or two sentences, with its unit. A collapsible section "So lesen Sie das Dashboard" / "How to read this dashboard" SHALL explain the difference between power (kW) and energy (kWh), show a sketch of the energy flow between the plant, the school, the battery and the grid with the seven quantities on it, give the formulas of Eigenverbrauch, Verbrauch, Autarkie and Eigenverbrauchsquote, explain what "keine Daten" means, and say where the data come from (readings of the school's plant once per minute, live power about every two seconds).

#### Scenario: Teacher asks what self-consumption is
- **WHEN** the info control of "Eigenverbrauch" is activated
- **THEN** a text explains that this is energy from the plant that the school used directly, without going through the battery or the grid, measured in kWh

#### Scenario: Reading guide
- **WHEN** "So lesen Sie das Dashboard" is opened
- **THEN** it shows the energy flow sketch with all seven quantity names in their colours, the four formulas and the meaning of kW and kWh

#### Scenario: Keyboard
- **WHEN** an info control is reached with the tab key and activated with Enter
- **THEN** the explanation appears, Esc closes it, and the focus returns to the control

### Requirement: Peaks of the day
The day view SHALL show the highest Produktion power with its time, the highest power drawn from the grid with its time, and the base load, defined as the mean Verbrauch power between 00:00 and 04:00. Peaks SHALL be taken from the same 15-minute average the power curve shows. For today the values SHALL be labelled as "bisher" / "so far"; a value whose readings are missing SHALL read "keine Daten".

#### Scenario: Past day
- **WHEN** the 15-minute averages of 12 October 2026 reach their highest Produktion of 61.8 kW at 12:45 and their highest grid draw of 104.3 kW at 11:15, and the mean Verbrauch between 00:00 and 04:00 is 31.2 kW
- **THEN** the day view shows "Spitzenleistung 61,8 kW um 12:45", "höchster Netzbezug 104 kW um 11:15" and "Grundlast 31,2 kW"

#### Scenario: Early morning today
- **WHEN** it is 03:00 today
- **THEN** the base load is labelled "bisher" and computed from 00:00 to 03:00

#### Scenario: Day before complete readings
- **WHEN** the day view of 15 April 2026 is open, which carries only production
- **THEN** the Produktion peak is shown and the grid peak and the base load read "keine Daten"

### Requirement: Key figures of a period
The week, month and year views SHALL show, for the days of the period up to today: the day with the highest Produktion, Verbrauch and Vom Netz, each with its date and value; the day with the lowest Produktion; the mean Produktion and Verbrauch per day over the days that carry the value; and the data completeness, the share of past days of the period that carry all readings, as a whole percentage with the counts. Days without readings SHALL NOT count as lowest day or lower the mean.

#### Scenario: Month with a long gap
- **WHEN** the month view of August 2026 is open and readings exist for 1 to 9 August only
- **THEN** completeness reads "29 % (9 von 31 Tagen)", and the means and extremes refer to 1 to 9 August

#### Scenario: Current week
- **WHEN** the week view of today is open on a Wednesday
- **THEN** the key figures cover Monday to today, today's values are marked as not finished, and Thursday to Sunday do not count

### Requirement: Values readable as text
Every value shown in a chart SHALL also be available as text: on pointing at or tapping a bar or point, and in a table of the shown period that can be opened below each chart.

#### Scenario: Tapping a bar
- **WHEN** the bar of 14 October is tapped on a phone in the month view
- **THEN** the date and the values of Produktion, Verbrauch, Vom Netz and Ins Netz for that day are shown as text

#### Scenario: Table
- **WHEN** the table below the year chart is opened
- **THEN** it lists every month of the year with its four values in kWh

### Requirement: Language
The dashboard SHALL be available in German and English. It SHALL start in the browser's language if that is English and in German otherwise, offer a switch, and keep the choice across visits. Numbers and dates SHALL follow the chosen language.

#### Scenario: English
- **WHEN** English is chosen
- **THEN** all labels are English, a value of 12.5 reads "12.5", a value of 1395.5 reads "1,396" and the date 14 October 2026 reads "14 Oct 2026"

#### Scenario: German
- **WHEN** German is chosen
- **THEN** a value of 12.5 reads "12,5" and the date 14 October 2026 reads "14.10.2026"

### Requirement: Numbers and units
The dashboard SHALL show energy in kWh, power in kW and ratios in %, values below 100 with one decimal place and from 100 without, with a thousands separator from 1000 on.

#### Scenario: Large yearly value
- **WHEN** the year's Produktion is 84312.4 kWh and German is chosen
- **THEN** it reads "84.312 kWh"

### Requirement: Themes
The dashboard SHALL offer a light and a dark theme that use the same design tokens as the documentation site. It SHALL start in the theme of the operating system, offer a switch that is always visible and operable by keyboard, and keep the choice across visits.

#### Scenario: First visit
- **WHEN** the dashboard is opened for the first time on a device set to dark mode
- **THEN** it appears dark

#### Scenario: Choice kept
- **WHEN** the light theme was chosen and the page is opened again
- **THEN** it appears light, whatever the operating system is set to

### Requirement: Desktop and phone
The dashboard SHALL be usable on screens from 360 pixels width without a horizontal scroll bar and without overlapping content. Every control SHALL be at least 44 × 44 pixels on touch screens.

#### Scenario: Phone
- **WHEN** the month view is opened on a screen 360 pixels wide
- **THEN** the chart, the totals and the controls are fully visible one below the other and the page scrolls only vertically

#### Scenario: Desktop
- **WHEN** the day view is opened at 1920 × 1080 pixels
- **THEN** the totals and the chart are visible without scrolling

### Requirement: Accessible operation
All controls SHALL be operable by keyboard with a visible focus, all texts SHALL have a contrast of at least 4.5:1 to their background in both themes, and every quantity SHALL be recognisable by name and not only by colour. Animations SHALL stop when the system asks for reduced motion.

#### Scenario: Keyboard only
- **WHEN** the dashboard is operated with the tab key and Enter only
- **THEN** every view, period and switch can be reached and used, and the focus is visible at every step

### Requirement: No credentials in the browser or the repository
No content delivered to the browser by the dashboard and no tracked file of the dashboard SHALL contain a token, a password or a login. The browser SHALL NOT contact the PV system's cloud service.

#### Scenario: Delivered files
- **WHEN** all files delivered by the dashboard are searched for the database token
- **THEN** there is no match

#### Scenario: Network requests
- **WHEN** the browser's network log is recorded while all four views are opened
- **THEN** every request goes to the LeoIoT host

### Requirement: Works without the internet
The dashboard SHALL NOT load any file from a foreign server at run time.

#### Scenario: No internet access
- **WHEN** the device reaches only the school network with the LeoIoT host
- **THEN** the dashboard loads completely and shows the data

### Requirement: The legacy dashboard leads to `/pv/`
Once the PV dashboard has been accepted, the PV tab of `/dashboard/` SHALL lead to `/pv/`, and `/dashboard/` SHALL no longer show PV data or contact the PV system's cloud service. Its sensor views SHALL behave as before.

#### Scenario: PV tab
- **WHEN** "PV System" is chosen on `/dashboard/`
- **THEN** the browser opens `/pv/`

#### Scenario: Sensor views unchanged
- **WHEN** the sensor view of `/dashboard/` is opened before and after the switch
- **THEN** it shows the same rooms, cards and charts and makes the same requests
