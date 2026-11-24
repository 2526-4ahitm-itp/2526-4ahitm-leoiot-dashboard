# sensors/dashboard Specification

## Purpose
Describes the room-climate dashboard: the web page on which anyone at the school sees whether a room's air is fine right now, how current its values are, and how CO₂, temperature and humidity developed over the last day or week.

## Requirements

### Requirement: The dashboard is served at `/sensors/`
The dashboard SHALL be reachable at the path `/sensors/` of the host that serves the web applications, without login. `/sensors` SHALL redirect to `/sensors/`. The room shown SHALL be part of the address; without a room in the address the dashboard SHALL show room `105`.

#### Scenario: Plain address
- **WHEN** a visitor opens `/sensors/`
- **THEN** the dashboard shows room `105`

#### Scenario: Room in the address
- **WHEN** a visitor opens the dashboard with room `E10` in the address and `E10` has readings
- **THEN** the dashboard shows room `E10`, with the room id written exactly as on the door sign

### Requirement: Readings come only from the contract
The dashboard SHALL read history from the room-climate readings and current values from the room live messages specified in `platform/data-contract`, and from nothing else. It SHALL deliver no credential to the browser.

#### Scenario: Credentials stay on the server
- **WHEN** someone downloads every file the dashboard serves, including the page, scripts and styles
- **THEN** none of them contains a database token, a password or a broker login

### Requirement: The air state is shown as a traffic light
The dashboard SHALL show the room's air state from its latest CO₂ value as three lamps, of which exactly one is lit: green below 800 ppm, yellow from 800 to 1000 ppm, red above 1000 ppm. Next to the lamps one status sentence SHALL say what to do: "Luft gut", "Bald lüften" or "Jetzt lüften" (English: "Air is fine", "Air the room soon", "Air the room now"), followed by the reason, including since when the value has been above the limit when it is above 800 ppm. The air state SHALL NOT be expressed by colour alone.

#### Scenario: Thresholds
- **WHEN** the latest CO₂ value is 799, 800, 1000 or 1001 ppm
- **THEN** the lit lamp is green, yellow, yellow or red, and the status sentence matches the lamp

#### Scenario: Above the limit for a while
- **WHEN** CO₂ has been above 800 ppm since 9:55 and is 868 ppm now
- **THEN** the yellow lamp is lit and the dashboard says "Bald lüften" and that CO₂ has been above 800 ppm since 9:55

#### Scenario: No CO₂ value yet
- **WHEN** the room has temperature and humidity readings but no CO₂ reading in the last five minutes
- **THEN** no lamp is lit and the status sentence says that there is no current CO₂ value

### Requirement: Current values show their age
The dashboard SHALL show the room's latest CO₂ (ppm, no decimals), temperature (°C, one decimal) and humidity (%, no decimals) and the time of the latest reading with its age, and SHALL update them without reloading when a new live message arrives. A value SHALL change in place without moving other content.

#### Scenario: New reading arrives
- **WHEN** a live message for the shown room arrives
- **THEN** the values and their time are updated within two seconds, and the age counts up from there

#### Scenario: Unknown quantity
- **WHEN** the room's device has delivered no humidity value
- **THEN** humidity is shown as unknown and never as zero

### Requirement: Outdated values are marked
When the latest reading of the room is more than five minutes old, the dashboard SHALL show no lit lamp, neither in the CO₂ traffic light nor in the lamps of temperature and humidity, SHALL replace the status sentence by one saying that there are no current values and when the last reading was taken, SHALL show the values as outdated and SHALL show a warning symbol. It SHALL return to the normal display by itself when a new reading arrives.

#### Scenario: Box stops sending
- **WHEN** the last reading of room 105 was taken at 10:29 and it is 10:41 now
- **THEN** all lamps are off, the dashboard says there are no current values and that the last reading was at 10:29, the values are greyed and a warning symbol is shown

#### Scenario: Box sends again
- **WHEN** a new live message arrives after the room was shown as outdated
- **THEN** the lamps, the status sentence and the values return to normal without a reload

### Requirement: Rooms without data say so
When the shown room has no reading at all, the dashboard SHALL show "Keine Daten für Raum <room id>" (English: "No data for room <room id>") instead of lamps, values and charts.

#### Scenario: Unknown room in the address
- **WHEN** a visitor opens the dashboard with room `X99` in the address
- **THEN** the dashboard says "Keine Daten für Raum X99" and shows no lamps, values or charts

### Requirement: History is shown in three charts
The dashboard SHALL show the history in three charts, each in its own box: CO₂, temperature and humidity, each with its own scale and on the same time range. On desktop the CO₂ chart SHALL take the left half at the full height of the chart area, and the temperature chart and, below it, the humidity chart SHALL share the right half. The CO₂ chart SHALL mark the ranges below 800, from 800 to 1000 and above 1000 ppm in the colours of the lamps. Pointing at a time in any chart SHALL show the values at that time in every chart. A time without readings SHALL be shown as a gap, never as zero.

#### Scenario: Pointing at a time
- **WHEN** a visitor points at 9:30 in the temperature chart
- **THEN** all three charts mark 9:30 and the values at 9:30 are shown

#### Scenario: Gap in the readings
- **WHEN** the box delivered nothing between 2:00 and 3:00
- **THEN** every chart shows a gap between 2:00 and 3:00

#### Scenario: Layout on a desktop
- **WHEN** the dashboard is opened at 1440 pixels width
- **THEN** the CO₂ chart is on the left at the full height of the chart area, and the temperature chart is on the right above the humidity chart

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

### Requirement: Simulated readings are marked
When the shown readings carry the source `simulated`, the dashboard SHALL say "simuliert" ("simulated") next to the room id and SHALL draw the chart lines dashed. Measured readings SHALL get no such word.

#### Scenario: Simulated room
- **WHEN** a room shows readings whose source is `simulated`
- **THEN** the dashboard says "simuliert" next to the room id and every line is dashed

#### Scenario: Measured room
- **WHEN** room `105` shows readings whose source is `sensor`
- **THEN** the identity line reads "Raum 105" without "gemessen" or "simuliert", and the lines are solid

### Requirement: Live values have a fallback
When the live channel cannot be reached, the dashboard SHALL take the current values from the stored readings once a minute and SHALL return to the live channel by itself when it can be reached again.

#### Scenario: Live channel down
- **WHEN** `/mqtt` does not answer while the box keeps delivering
- **THEN** the values are at most about a minute old, and they update live again after `/mqtt` is back

### Requirement: Languages and themes
The dashboard SHALL offer German (default) and English and a light and a dark theme; the first visit SHALL follow the browser's colour scheme, and the visitor's choices SHALL be kept in the browser.

#### Scenario: Switching language
- **WHEN** a visitor switches to English
- **THEN** every label, status sentence, date and number is shown in English, and the choice is kept on the next visit

### Requirement: Desktop first, nothing breaks on a phone
The dashboard SHALL be laid out for desktop browsers from 1280 pixels width and SHALL remain fully usable down to 360 pixels width without horizontal scrolling of the page. In a browser window of at least 1280 × 720 CSS pixels, a room page with readings SHALL show the top bar, the room panel and all three charts without vertical scrolling, and the charts SHALL take the height the room panel leaves. In a lower window the charts SHALL keep a minimum readable height and the page SHALL scroll vertically.

#### Scenario: Laptop window
- **WHEN** a room page with readings is opened in a window of 1440 × 789 pixels at 100 % zoom
- **THEN** the top bar, the room panel and all three charts are visible and the page does not scroll

#### Scenario: Larger window
- **WHEN** the same room page is opened in a window of 1920 × 960 pixels
- **THEN** the charts are taller than in the 1440 × 789 window and the page does not scroll

#### Scenario: Low window
- **WHEN** a room page with readings is opened in a window of 1280 × 600 pixels
- **THEN** the charts keep their minimum height and the page scrolls vertically, not sideways

#### Scenario: Narrow window
- **WHEN** the dashboard is opened at 360 pixels width
- **THEN** room id, lamps, status, values and all three charts are shown one below the other and the page does not scroll sideways

### Requirement: The room is named in one line
The room panel SHALL name the room in one line as "Raum <room id>" (English: "Room <room id>"), with the room id written exactly as on the door sign, followed by the link to the building model of `platform/room-links` where that applies. The line SHALL NOT name the device that took the readings. The room SHALL remain the page's main heading for assistive technology.

#### Scenario: Room 105
- **WHEN** a visitor views room `105` in German
- **THEN** the room panel starts with the line "Raum 105" and the link "Im Gebäude zeigen", and no device name is shown

#### Scenario: English
- **WHEN** a visitor views room `E10` in English
- **THEN** the line reads "Room E10"

### Requirement: Temperature and humidity have their own lamps
Next to the temperature and the humidity value, the dashboard SHALL show one small lamp each, lit green inside the range and amber outside it, with a short text that says the state and its direction. The ranges SHALL be those of § 28 of the Austrian Bundes-Arbeitsstättenverordnung: temperature from 19 to 25 °C (work with low physical load), relative humidity from 40 to 70 % (stated there for rooms with air conditioning, used here as a guide value). The bounds SHALL belong to the range. The value SHALL be compared as shown (temperature with one decimal, humidity without decimals), and SHALL take the ink colour of its lamp. These lamps SHALL NOT change the CO₂ traffic light or the status sentence. An unknown value SHALL leave its lamp off. The state SHALL NOT be expressed by colour alone.

| Value | Lamp | Text (German / English) |
|---|---|---|
| temperature below 19.0 °C | amber | "zu kalt" / "too cold" |
| temperature 19.0 to 25.0 °C | green | "im Bereich" / "in range" |
| temperature above 25.0 °C | amber | "zu warm" / "too warm" |
| humidity below 40 % | amber | "zu trocken" / "too dry" |
| humidity 40 to 70 % | green | "im Bereich" / "in range" |
| humidity above 70 % | amber | "zu feucht" / "too humid" |

#### Scenario: Limits of the temperature
- **WHEN** the temperature is 18.9, 19.0, 25.0 or 25.1 °C
- **THEN** its lamp is amber with "zu kalt", green, green, or amber with "zu warm"

#### Scenario: Dry room with good air
- **WHEN** CO₂ is 426 ppm, temperature 20.2 °C and humidity 28 %
- **THEN** the CO₂ lamp is green with "Luft gut", the temperature lamp is green, and the humidity lamp is amber with "zu trocken"

#### Scenario: No humidity value
- **WHEN** the room's device has delivered no humidity value
- **THEN** humidity is shown as unknown and its lamp is off

### Requirement: The day is summarised next to the values
The room panel SHALL show a summary of the current day, from midnight in the school's local time (Europe/Vienna) until now, whatever time range the charts show. It SHALL contain:

- the time CO₂ was above 1000 ppm today, counted in whole minutes in which the highest stored reading of the shown source is above 1000 ppm, or a text saying it has not been above 1000 ppm today; when today's highest value, including the current reading, is above 1000 ppm, the time SHALL be at least one minute;
- the highest single CO₂ reading of today and the time it was taken, from the stored readings of the shown source;
- the time the room was last aired, estimated from the five-minute history as the start of the latest fall of CO₂ by at least 200 ppm within at most fifteen minutes today, marked as an estimate in its text, or a text saying no airing was detected today.

The summary SHALL be updated at least once a minute. When the room has no reading today, the summary SHALL say so. When the readings are simulated, the summary SHALL be shown like the other values of a simulated room.

#### Scenario: A school day
- **WHEN** room 105 had readings above 1000 ppm in eighty different minutes today, its highest reading today was 1450 ppm at 13:05, and CO₂ fell from 1380 to 1020 ppm between 10:45 and 10:55
- **THEN** the summary says above 1000 ppm for 1 h 20 min, highest value 1450 ppm at 13:05, and last aired at about 10:45, marked as an estimate

#### Scenario: A short spike
- **WHEN** one reading of 1034 ppm at 12:46 is the only reading above 1000 ppm today
- **THEN** the summary says above 1000 ppm for 1 min and highest value 1034 ppm at 12:46

#### Scenario: Early morning
- **WHEN** it is 06:30 and CO₂ has stayed below 1000 ppm since midnight without a fall of 200 ppm
- **THEN** the summary says it has not been above 1000 ppm today and that no airing was detected today, and shows the highest value so far

#### Scenario: Range switched to 7 days
- **WHEN** a visitor switches the charts to 7 days
- **THEN** the summary still covers today only

### Requirement: Room list entries name only what needs attention
Each room in the room list SHALL take a single line at desktop widths when its room id has at most four characters, with its room id and its CO₂ value; with a longer id the state word SHALL wrap below the id rather than be cut off. A room whose air state is "Bald lüften" or "Jetzt lüften" SHALL show that state as visible text. A room with good air SHALL show no visible state word, and its state ("Luft gut") SHALL be available to assistive technology. A room that is live but has no CO₂ value SHALL show "Kein CO₂-Wert" as visible text. In this way the air state is never told by colour alone: a room with a word needs attention, a room without one does not.

#### Scenario: Good air
- **WHEN** room `E11`'s newest message is 1 minute old and carries `co2` = 726
- **THEN** the list shows `E11` with 726 ppm and the green lamp, without a visible state word, and a screen reader announces "Luft gut"

#### Scenario: Air the room soon
- **WHEN** room `E59`'s newest message is 1 minute old and carries `co2` = 860
- **THEN** the list shows `E59` with 860 ppm, the amber lamp and the visible words "Bald lüften"

#### Scenario: Desktop width
- **WHEN** the room list is shown in a window 1440 CSS pixels wide
- **THEN** every room whose id has at most four characters fits on one line, including one with "Jetzt lüften" and a four-digit CO₂ value, and the state word of `UBiolab` wraps below its id without being cut off

### Requirement: Outdated rooms in the list are marked like on the room page
A room in the list whose newest reading is older than five minutes SHALL show the warning symbol and the text "Zuletzt" with the time of that reading, as the room page does, and its CO₂ value SHALL be shown muted and no more prominent than the room id. It SHALL show no lit lamp.

#### Scenario: Box stopped sending
- **WHEN** room `105`'s newest message is from 11:07 and it is now 11:15
- **THEN** the list shows `105` with the warning symbol, "Zuletzt 11:07", no lit lamp and its last CO₂ value muted

### Requirement: Simulated rooms in the list are outlined dashed
A room in the list whose readings are simulated SHALL be drawn with a dashed outline and a room with sensor readings with a solid one, and SHALL NOT carry a visible "simuliert" tag of its own. Whenever the list shows at least one simulated room, one line above the floors SHALL explain that a dashed outline means simulated values. Each simulated room SHALL be announced as simulated to assistive technology.

#### Scenario: Mixed sources
- **WHEN** room `105` sends sensor readings and room `E10` simulated ones
- **THEN** `E10` has a dashed outline, `105` a solid one, the legend line is shown, and a screen reader announces `E10` as simulated

#### Scenario: Only sensor readings
- **WHEN** no room in the list has simulated readings
- **THEN** no legend line is shown

### Requirement: The room list summarises its rooms and says how current it is
Below its title the room list SHALL show the number of rooms and the number of rooms in each of the states "Jetzt lüften", "Bald lüften" and outdated, leaving out states with no room. Each floor heading SHALL show the floor's number of rooms and the same state counts for that floor. The list SHALL say whether it updates live or once a minute; while it updates once a minute it SHALL show the time of its last successful update. The counts and the freshness text SHALL use neutral colours.

#### Scenario: Summary line
- **WHEN** the list shows 107 rooms, of which 11 need airing now, 15 soon and 1 is outdated
- **THEN** the summary reads "107 Räume · 11 jetzt lüften · 15 bald lüften · 1 nicht aktuell"

#### Scenario: Floor without problems
- **WHEN** all 13 rooms of the gym have good air
- **THEN** the gym's heading shows "13 Räume" and no state counts

#### Scenario: Live channel down
- **WHEN** the live channel cannot be reached and the stored readings were last loaded at 11:14
- **THEN** the list says that it updates every minute and shows 11:14 as the time of its last update

### Requirement: A failed room list load is not shown as an empty list
When the live channel cannot be reached and loading the stored readings fails, the room list SHALL say that the values could not be loaded and that it keeps trying, and SHALL NOT say that no room is sending readings. Rooms already shown SHALL stay, with the time of the last successful update. "No room is sending readings" SHALL only be said after the live channel or the stored readings answered without any room.

#### Scenario: Database not reachable on first load
- **WHEN** the live channel cannot be reached and the request for the stored readings fails
- **THEN** the list says the values could not be loaded and that it tries again every minute, and shows no room

#### Scenario: Database fails later
- **WHEN** the list shows rooms from a stored readings load at 11:14 and the next load fails
- **THEN** the rooms stay, and the list still shows 11:14 as the time of its last update

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

### Requirement: A hallway display shows the whole school
The dashboard SHALL offer a display view at `/sensors/?kiosk` for a landscape screen in a corridor, without controls and without needing any interaction. It SHALL show the school-wide room counts as the room list does, the current time and date, and how current its values are. It SHALL page through the floors in building order, one floor per page and a floor with more rooms than fit split into parts, every 15 seconds by default, showing each room with its lamp, room id and CO₂ value and following the room list's rules for state words, outdated and simulated rooms. Independently of the page shown it SHALL list every room of the school whose air state is "Jetzt lüften", then every room with "Bald lüften", each highest CO₂ first. It SHALL show which floor is on screen. The address SHALL allow restricting the display to one floor, choosing the language and the light theme, and setting the page time from 5 to 120 seconds; by default it SHALL be German, dark and show all floors. It SHALL fit the screen without scrolling at 1920 × 1080 and scale to other landscape sizes, and it SHALL reload itself once a night.

#### Scenario: Entrance hall
- **WHEN** a screen opens `/sensors/?kiosk` while 107 rooms send readings, of which 4 need airing now and 7 soon
- **THEN** the display shows "107 Räume · 4 jetzt lüften · 7 bald lüften", the time, the four rooms under "Jetzt lüften" and the seven under "Bald lüften", and the rooms of the basement, then each following floor in turn every 15 seconds

#### Scenario: A floor that does not fit
- **WHEN** the first floor has 29 rooms and one page holds 24 tiles
- **THEN** the first floor is shown on two pages of 15 and 14 rooms, marked as part 1 of 2 and 2 of 2

#### Scenario: Room needs airing on another floor
- **WHEN** the gym page is shown and room `122` on the first floor reaches 1060 ppm
- **THEN** `122` appears under "Jetzt lüften" right away, without waiting for the first floor's page

#### Scenario: One floor only
- **WHEN** a screen on the ground floor opens `/sensors/?kiosk&floor=E`
- **THEN** only the ground floor's rooms are shown, and the attention list still covers the whole school

#### Scenario: Live channel down
- **WHEN** the live channel cannot be reached and the stored readings were last loaded at 11:14
- **THEN** the display says that it updates every minute and shows 11:14, and keeps paging

#### Scenario: Nothing to air
- **WHEN** no room needs airing
- **THEN** the attention list says that all rooms have good air

#### Scenario: Options in the address
- **WHEN** a screen opens `/sensors/?kiosk&lang=en&theme=light&seconds=30`
- **THEN** the display is English, light and turns the page every 30 seconds
