# Spec Delta

## Purpose

Describes the main kiosk: a full-screen display of the school's energy data (PV production, consumption, grid, battery) for a large screen that is read from a distance without anyone operating it. Labels on the screen are German and are quoted here as they appear.

## ADDED Requirements

### Requirement: The kiosk is reached at `/kiosk/`
The main kiosk SHALL be served at the address `/kiosk/` of the LeoIoT host.

#### Scenario: Opening the address
- **WHEN** a browser opens `/kiosk/` or `/kiosk`
- **THEN** it shows the main kiosk

### Requirement: Former kiosk addresses lead to the kiosk
The addresses `/leogreen/`, `/kiosk2/`, `/kiosk3/` and `/kiosk4/` SHALL redirect to `/kiosk/` and keep a `theme` parameter if one was given.

#### Scenario: Screen with an old bookmark
- **WHEN** a screen opens `/leogreen/?theme=dark`
- **THEN** it ends up on `/kiosk/?theme=dark` and shows the main kiosk in the dark theme

#### Scenario: Numbered kiosk
- **WHEN** a browser opens `/kiosk3/`
- **THEN** it ends up on `/kiosk/`

### Requirement: Screen layout
The kiosk SHALL show, without scrolling, a header and below it a grid of four panels of equal size: top left, under the title "Heute", the rings "Verbrauch" and "Produktion"; top right the "Wochenübersicht"; bottom left "Leistung" for today; bottom right the "Energiefluss". The header SHALL contain the HTL logo, a theme switch, the time and the note "Zuletzt aktualisiert".

#### Scenario: Full screen on the TV
- **WHEN** the kiosk is opened on a screen of 1920 × 1080 pixels
- **THEN** the header and all four panels are completely visible and there is neither a vertical nor a horizontal scroll bar

#### Scenario: Larger screen
- **WHEN** the kiosk is opened on a screen of 3840 × 2160 pixels
- **THEN** the grid fills the screen and text and charts are proportionally larger

### Requirement: Display below Full HD
The kiosk SHALL also be displayed without scrolling and without overlapping content on screens between 1280 × 720 and 1920 × 1080 pixels. The number in the middle of a ring in the panel "Heute" SHALL lie completely inside the opening of the ring at every screen size.

#### Scenario: Screen of 1280 × 720
- **WHEN** the kiosk shows a four-digit daily value at 1280 × 720 pixels
- **THEN** the number with its unit lies completely inside the opening of the ring and does not touch the ring

### Requirement: One definition of every quantity
The kiosk SHALL use the same definitions in all panels: self-consumption = production − feed-in − battery charge (never below 0); consumption = self-consumption + grid import + battery discharge. It SHALL compute them from the stored PV readings specified in `platform/data-contract`.

#### Scenario: Consumption agrees across panels
- **WHEN** today's readings are production 746.2 kWh, feed-in 0 kWh, battery charge 82.4 kWh, grid import 207 kWh and battery discharge 141.2 kWh
- **THEN** the ring "Verbrauch" and today's bar "Verbrauch" both show 1012 kWh and the ring names 664 kWh "Von PV"

#### Scenario: Power chart with battery
- **WHEN** the battery discharges during a period
- **THEN** the consumption curve in the panel "Leistung" includes that discharge

### Requirement: Rings for today
The ring "Verbrauch" SHALL show the shares "Von PV", "Vom Netz" and "Von Batterie" with the total consumption in the middle. The ring "Produktion" SHALL show the shares "Eigenverbrauch", "Ins Netz" and "In Batterie" with the day's production in the middle. The legend SHALL name every share with colour, name and value in kWh, sorted by value in descending order.

#### Scenario: Legend sorted
- **WHEN** "Vom Netz" is 207 kWh, "Von PV" 664 kWh and "Von Batterie" 141 kWh
- **THEN** the legend lists "Von PV" first, then "Vom Netz", then "Von Batterie"

### Requirement: Weekly overview
The weekly overview SHALL show "Produktion", "Verbrauch" and "Ins Netz" in kWh per day for exactly the last seven calendar days in Vienna time, today included, and SHALL name the date range shown.

#### Scenario: Seven days
- **WHEN** the kiosk is open on 7 October
- **THEN** the weekly overview shows the days 1 to 7 October and the date range says so

#### Scenario: Shortly after midnight
- **WHEN** it is 00:10 in Vienna
- **THEN** yesterday's bar keeps its end-of-day value and the new day starts with its own values

### Requirement: Power today
The panel "Leistung" SHALL show the course of production and consumption in kW for today in Vienna time from 00:00 to 24:00. Displayed values SHALL be magnitudes; a minus sign in front of a consumption value does not occur.

#### Scenario: No negative consumption
- **WHEN** consumption at 12:00 is 80 kW
- **THEN** every label of that value reads "80" and not "-80"

#### Scenario: The future stays empty
- **WHEN** it is 14:00
- **THEN** both curves end at 14:00 and the rest of the time axis stays empty

#### Scenario: A counter steps back during the day
- **WHEN** a stored daily counter is lower than a few minutes before, at a time that is not the start of the day (for example grid import 134 kWh, then 128 kWh, then 134 kWh at 04:45)
- **THEN** the curves before that moment stay visible, the lower value is treated as "no change" and not as the start of a new day, and no power is drawn for the step back

### Requirement: Energy flow shows power
The energy flow SHALL show the current power in kW for production, consumption, grid and battery. If the values come from momentary-power messages of the PV live data specified in `platform/data-contract` that are at most two minutes old, the panel SHALL be labelled "Live". Otherwise the power SHALL be computed from the stored readings of the last ten minutes and the panel SHALL be labelled "Ø letzte 10 Min".

#### Scenario: Live values present
- **WHEN** a live message with momentary power arrived 30 seconds ago
- **THEN** the energy flow shows those values in kW and the label reads "Live"

#### Scenario: No live values
- **WHEN** no live message with momentary power has arrived for more than two minutes
- **THEN** the energy flow shows values computed from the last ten minutes in kW and the label reads "Ø letzte 10 Min"

### Requirement: Flow direction recognisable without colour
The energy flow SHALL state the direction for grid and battery by a word and an arrow in addition to colour: "Bezug" or "Einspeisung" for the grid, "lädt" or "entlädt" for the battery. If nothing flows, the connection SHALL be recognisable as idle.

#### Scenario: Feed-in
- **WHEN** power flows into the grid
- **THEN** the grid is labelled "Einspeisung" and the arrow points to the grid

#### Scenario: Reduced motion
- **WHEN** the system asks for reduced motion
- **THEN** no animation runs and word and arrow still show the direction

### Requirement: Consistent colours and terms
Every quantity SHALL carry the same colour and the same name in all panels. The names are: Produktion, Verbrauch, Eigenverbrauch, Ins Netz, Vom Netz, In Batterie, Von Batterie. The colour follows the origin: one colour for PV (Produktion, Eigenverbrauch, "Von PV"), one for consumption, one for the grid (Ins Netz, Vom Netz) and one for the battery (In Batterie, Von Batterie).

#### Scenario: Production in three panels
- **WHEN** production appears in the weekly overview, the power panel and the energy flow
- **THEN** it is called "Produktion" everywhere and has the same colour everywhere

### Requirement: Numbers and units
The kiosk SHALL show all numbers in German notation with a decimal comma and a unit: energy in kWh, power in kW; values below 100 with one decimal place, from 100 without.

#### Scenario: Axes and legends
- **WHEN** a value of 12.5 appears on an axis, in a legend or in a panel
- **THEN** it reads "12,5" and not "12.5"

### Requirement: Data age and outages are visible
"Zuletzt aktualisiert" SHALL show the time of the most recent reading, not the time of the request. If the most recent reading is older than five minutes, the kiosk SHALL visibly mark the data as outdated. If there is no data or the request fails, the kiosk SHALL say so in words and keep trying by itself.

#### Scenario: Outdated data
- **WHEN** the most recent reading is from 10:00 and it is 10:20
- **THEN** the header shows "10:00" as the update time and a note that the data is outdated

#### Scenario: Data source unreachable
- **WHEN** the data source does not answer at start
- **THEN** the kiosk shows a note in words instead of empty charts and loads the data as soon as the source answers again, without anyone reloading the page

#### Scenario: Day change
- **WHEN** Vienna time changes from 23:59 to 00:00
- **THEN** the panels for today start with the new day and the date range of the weekly overview moves on by one day

### Requirement: One message when everything is missing
If all four panels are in the same state without data (loading, data source not answering, or data source delivering no readings), the kiosk SHALL show one single message across the area of the four panels instead of four identical notes. The header SHALL stay visible. As soon as at least one panel shows data or the panels are in different states, every panel SHALL show its own content or note again, without anyone reloading the page.

#### Scenario: Data source does not answer
- **WHEN** the data source does not answer at start and no live values arrive
- **THEN** the note "Keine Daten" with its explanation appears exactly once on the screen, and time and logo remain visible

#### Scenario: Only a part fails
- **WHEN** the data source does not answer but live values for the energy flow arrive
- **THEN** the panel "Energiefluss" shows the live values and the three other panels each show their note

#### Scenario: Recovery
- **WHEN** the common message is shown and the data source answers again
- **THEN** the message disappears and the four panels show their data without the page being reloaded

### Requirement: Readable from a distance
On a screen of 1920 × 1080 pixels no text SHALL be smaller than 18 pixels, and all texts SHALL have a contrast of at least 4.5:1 to their background in both themes. Font sizes SHALL grow with the screen size.

#### Scenario: Smallest text
- **WHEN** the kiosk is displayed at 1920 × 1080 pixels
- **THEN** the smallest text, axis labels included, measures at least 18 pixels

### Requirement: Themes
The kiosk SHALL offer a light and a dark theme that use the same design tokens as the documentation site. The switch SHALL be operable by keyboard and the choice SHALL survive a restart. The theme SHALL also be selectable through the address.

#### Scenario: Theme through the address
- **WHEN** the kiosk is opened with `?theme=dark`
- **THEN** it appears dark, whatever choice was stored

#### Scenario: Keyboard
- **WHEN** the switch is reached with the tab key and activated with the space bar
- **THEN** the theme changes and the focus is visible

### Requirement: Theme switch visible only while operated
The theme switch in the header SHALL be hidden as long as nobody operates the kiosk. It SHALL appear as soon as the mouse is moved or the keyboard focus is on it, and SHALL disappear five seconds after the last mouse movement unless the focus is on it. Showing and hiding it MUST NOT move other elements of the header.

#### Scenario: Unattended screen
- **WHEN** the kiosk is opened and neither mouse nor keyboard is used
- **THEN** the switch is not visible, and logo, time and "Zuletzt aktualisiert" are in the same place as with the switch visible

#### Scenario: Mouse movement
- **WHEN** the mouse is moved
- **THEN** the switch is visible and usable, and five seconds after the last movement it is hidden again

#### Scenario: Reduced motion
- **WHEN** the system asks for reduced motion
- **THEN** the switch appears and disappears without a transition

### Requirement: No credentials in the browser or the repository
No content delivered to the browser by the kiosk and no tracked file of the kiosk SHALL contain a token, a password or a login.

#### Scenario: Delivered files
- **WHEN** all files delivered by the kiosk are searched for the database token
- **THEN** there is no match

### Requirement: Works without the internet
The kiosk SHALL NOT load any file from a foreign server at run time.

#### Scenario: No internet access
- **WHEN** the screen reaches only the school network with the LeoIoT host
- **THEN** the kiosk loads completely and shows the data
