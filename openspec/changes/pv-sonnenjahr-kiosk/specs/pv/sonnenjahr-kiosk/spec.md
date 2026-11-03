# Spec Delta

## Purpose

Describes the second PV kiosk "Unser Sonnenjahr": a looping full-screen film for visitors walking past a screen in the school, without sound and without operation, that shows the past year of the school's PV readings as a mountain landscape. On-screen texts are German and are quoted here as they appear.

## ADDED Requirements

### Requirement: The film is reached at `/kiosk2/`
The film SHALL be served at the address `/kiosk2/` of the LeoIoT host. `/kiosk2` SHALL redirect to `/kiosk2/`. The address SHALL NOT redirect to `/kiosk/` any more.

#### Scenario: Opening the address
- **WHEN** a browser opens `/kiosk2/` or `/kiosk2`
- **THEN** it shows the film and its address bar shows `/kiosk2/`

#### Scenario: Main kiosk unchanged
- **WHEN** a browser opens `/kiosk/`
- **THEN** it shows the main kiosk as before

### Requirement: Each part of the film answers one question
Each part of the film SHALL answer one question for a stated audience, without anyone operating the screen:

| Part | Question | For whom |
|---|---|---|
| Zeitraffer | How much power did the roof make over the past year, day by day and hour by hour? | visitors walking past, students |
| Bester Tag | Which was the best day of the year, and how much did it give? | visitors, students |
| Meilenstein | How quickly does the total grow? | visitors, students |
| Gerade jetzt | Is the system working at this moment, and how much does it deliver? | visitors, students, building services passing by |
| Seit Beginn | How much has the system produced in its lifetime? | visitors |
| CO₂ | What does that mean for the climate? | visitors |

Looking up individual values is the job of the dashboard in `pv/dashboard`; the film shows no tables and no controls.

#### Scenario: A part stands alone
- **WHEN** a person looks at the screen for ten seconds at an arbitrary moment of the loop
- **THEN** the screen names the plant, shows a date or "Heute", and shows at least one value with its unit

### Requirement: One loop without a cut
The film SHALL run as a loop of 90 to 110 seconds that repeats without end. The last picture of a loop SHALL lead into the first one without a visible jump: no element appears, disappears or changes its position abruptly at the seam. The film SHALL play no sound and SHALL need no input.

#### Scenario: Seam of the loop
- **WHEN** the pictures 0.1 seconds before and 0.1 seconds after the start of a loop are compared
- **THEN** both show the same scene without a mountain ridge and with the same date

#### Scenario: Long run
- **WHEN** the film runs for 24 hours
- **THEN** it is still running, without anyone operating it, and it has not stopped on one picture

### Requirement: The landscape is made of the readings
Every day of the last 365 days that has readings SHALL be shown as one mountain ridge, the oldest farthest away and the most recent in front. Along a ridge, as seen on the screen, the left end SHALL be morning and the right end evening. The height of a ridge at a time of day SHALL be proportional to the PV power at that time, derived from the stored production of that day as specified in `platform/data-contract` (a daily field is read as its highest value so far that day). All ridges SHALL use the same height scale, so that a higher ridge always means more power.

If fewer than 365 days have readings, the film SHALL show the days that have them.

#### Scenario: Strong and weak day
- **WHEN** one day produced twice as much power at noon as another
- **THEN** its ridge is about twice as high at its middle

#### Scenario: Counter steps back during a day
- **WHEN** the stored production of a day falls back for some minutes and rises again
- **THEN** the ridge shows no dip and no spike for those minutes

### Requirement: Missing readings are not mountains of zero
A day without readings SHALL leave a visible gap in the landscape instead of a flat ridge. A day with readings for only part of its hours SHALL have a ridge only for those hours. The film SHALL NOT invent values for missing times.

#### Scenario: Collector down for two days
- **WHEN** there are no readings for two days in July
- **THEN** the landscape has a gap of two ridges at that place, and the counter does not grow while the film passes those days

### Requirement: The first day explains the landscape by drawing it
At the start of each loop a point of light SHALL move along the first ridge from morning to evening within about five seconds. The ridge SHALL rise under the point of light as it moves, and next to the point SHALL stand the time of day and the power at that time, for example "27,4 kW" and "09:00 Uhr". The labels "6 Uhr", "12 Uhr" and "18 Uhr" SHALL stand at the foot of the newest ridge while days are being drawn. The following days SHALL be drawn faster until the film turns into a time-lapse; from then on whole days SHALL rise at once instead of being drawn, and the point of light SHALL be hidden. No explanatory sentence SHALL describe what a mountain means.

#### Scenario: First seconds
- **WHEN** the loop has run for two seconds
- **THEN** the left part of the first ridge exists, the right part does not yet, and the point of light with time and power stands at the edge between the two

#### Scenario: Time-lapse
- **WHEN** the film passes more than two days per second
- **THEN** no point of light sweeps back and forth over the ridges, and new ridges rise as a whole

### Requirement: Plant, date and counter are always visible
While days are being shown, the screen SHALL show "Solaranlage der HTL Leonding", the date of the day being drawn and a counter "kWh erzeugt". The counter SHALL show the lifetime production of the plant at the moment being drawn: the stored lifetime yield of the most recent reading minus the production of the days after that moment. During the large moments the date and the counter MAY give way, but the name of the plant SHALL stay.

#### Scenario: Counter at the end of the time-lapse
- **WHEN** the time-lapse arrives at today
- **THEN** the counter shows the stored lifetime yield of the most recent reading

#### Scenario: Counter during the year
- **WHEN** the film shows 1 July and the days from 2 July to today produced 30 000 kWh
- **THEN** the counter shows the lifetime yield of the most recent reading minus 30 000 kWh

### Requirement: Months are named in the landscape
When the first day of a month rises, its name SHALL appear next to that ridge for two to three seconds and then fade.

#### Scenario: Month in the time-lapse
- **WHEN** the ridge of 1 August rises during the time-lapse
- **THEN** "August" stands next to it for at least two seconds

### Requirement: The best day is shown on its summit
The day with the highest production in the shown period SHALL be drawn slowly with the point of light, and after it has been drawn the film SHALL mark its highest point with a dot, the label "Bester Tag", its date and its production in kWh. The rest of the landscape SHALL step back while the mark is shown. The mark SHALL appear only once the ridge has reached its full height.

#### Scenario: Best day
- **WHEN** 11 June produced 477 kWh and no other day produced more
- **THEN** the film shows "Bester Tag", "11. Juni" and "477 kWh" with the dot on the highest point of that ridge

### Requirement: Milestones of the counter
Whenever the counter passes a multiple of 10 000 kWh during the time-lapse, the counter SHALL light up and a note such as "160 000 kWh erreicht" SHALL be shown for at least two seconds, and the ridge of that day SHALL light up with it. A milestone that would coincide with the best day SHALL be left out.

#### Scenario: Passing 160 000 kWh
- **WHEN** the counter goes from 159 870 kWh to 160 230 kWh between two ridges
- **THEN** "160 000 kWh erreicht" appears and the newest ridge lights up

### Requirement: Values of single days stand on visible summits
During the time-lapse the film SHALL from time to time show the production of a single day, for example "393 kWh" and "an diesem Tag", with a dot on that day's highest point. The dot SHALL sit on the summit of the ridge it names, and the label SHALL be shown only while that summit is not hidden behind a nearer ridge.

#### Scenario: Summit behind a nearer ridge
- **WHEN** a newer ridge in front rises higher than the named summit
- **THEN** the label is not shown

### Requirement: The large moments
After the time-lapse has arrived at today, the film SHALL show in this order, each as a large number with a short sentence:

- "Gerade jetzt": the current PV power from the live channel in kW, for example "42,3 kW" with "kommen in diesem Moment von unserem Dach.", while the point of light stands on today's ridge at the current time of day.
- "Seit Beginn": the stored lifetime yield in kWh with "Sonnenstrom hat diese Schule selbst erzeugt."
- "Das bedeutet": the avoided CO₂ in tonnes with "CO₂-Äquivalent, rund, die wir nicht ausgestoßen haben." and its source.

Then the film SHALL show "Und morgen wächst der nächste Berg." and run the year backwards to the start of the loop: the date and the counter count back, the ridges sink back into the fog.

#### Scenario: Order of the moments
- **WHEN** the time-lapse reaches today at 13:30 with 42.3 kW live power
- **THEN** "Gerade jetzt" with "42,3 kW" follows, then "Seit Beginn", then "Das bedeutet", then the closing sentence

### Requirement: Avoided CO₂ uses a stated factor
The avoided CO₂ SHALL be the stored lifetime yield multiplied by 169 g CO₂-equivalent per kWh, shown in tonnes with one decimal and with the word "rund". The source SHALL be visible on the screen as "Faktor 169 g/kWh, nach Umweltbundesamt REP-0948". The factor is the Austrian electricity supply (209 g) minus the upstream emissions of photovoltaics (40 g), both from table 4 of the report "Harmonisierte österreichische direkte und vorgelagerte THG-Emissionsfaktoren" (Umweltbundesamt, Wien 2025); it assumes that PV power replaces the average Austrian mix.

#### Scenario: CO₂ moment
- **WHEN** the lifetime yield is 186 420 kWh
- **THEN** the film shows "31,5 t" with the source line

### Requirement: Evening and night
Between sunset and sunrise in Leonding, computed by the film itself without any foreign server, the moment "Gerade jetzt" SHALL show the next sunrise, for example "06:51 Uhr" with "Dann kommt die Sonne zurück auf unser Dach." under the heading "Die Anlage ruht", instead of a power of zero. During the moments the scene SHALL darken; sky, fog and mountains SHALL darken together so that no edge appears at the horizon.

#### Scenario: Visitor in the evening
- **WHEN** the film reaches its moments at 19:00 in November
- **THEN** it shows "Die Anlage ruht" and the time of the next sunrise, not "0,0 kW"

### Requirement: Outdated and missing data are visible
If the live channel has delivered nothing for three minutes, "Gerade jetzt" SHALL show the last value with the time it was received, for example "Stand 14:02", or, without any live value, the words "Gerade keine Live-Daten". If the most recent stored reading is older than fifteen minutes, the screen SHALL show the time of that reading next to the counter. If no stored readings can be loaded, the screen SHALL show one message in words instead of an empty landscape, keep the name of the plant visible and keep trying by itself.

#### Scenario: Data source unreachable at start
- **WHEN** the data source does not answer when the film starts
- **THEN** the screen shows a message in words, and the landscape appears as soon as the source answers, without anyone reloading the page

#### Scenario: Live channel silent
- **WHEN** the last live value arrived at 14:02 and it is 14:10
- **THEN** "Gerade jetzt" shows that value together with "Stand 14:02"

### Requirement: New days arrive by themselves
The film SHALL take up new readings of today at least every five minutes and SHALL start a new day after midnight Vienna time without anyone reloading the page; the oldest day then leaves the landscape.

#### Scenario: Day change
- **WHEN** Vienna time changes from 23:59 to 00:00
- **THEN** within the next loop the film ends its time-lapse with the new day, and the day 366 days ago is no longer shown

### Requirement: Texts stay long enough to read
Every text that appears SHALL stay visible for at least 1.5 seconds, each large moment for at least six seconds, and the closing sentence for at least three seconds.

#### Scenario: Measured durations
- **WHEN** the visible time of every text over one loop is measured
- **THEN** no text is shown for less than 1.5 seconds

### Requirement: Readable from a distance
On a screen of 1920 × 1080 pixels no text SHALL be smaller than 18 pixels, and the large numbers SHALL be at least 15 % of the screen height. Every text SHALL have a contrast of at least 4.5:1 to the picture behind it at the moment it is shown. Font sizes SHALL grow with the screen size.

#### Scenario: Smallest text
- **WHEN** the film is displayed at 1920 × 1080 pixels
- **THEN** the smallest text, the source line included, measures at least 18 pixels

#### Scenario: Text over the bright sky
- **WHEN** a large moment is shown while the sky behind it is bright
- **THEN** the number and its sentence keep a contrast of at least 4.5:1

### Requirement: Screen sizes and full screen
The film SHALL fill the screen without scrolling and without overlapping texts on screens from 1280 × 720 to 3840 × 2160 pixels. Changing to or from full screen SHALL resize the picture at once, without a bar or an empty area.

#### Scenario: Switching to full screen
- **WHEN** the browser switches to full screen while the film runs
- **THEN** the picture fills the whole screen at the next frame

### Requirement: Smooth on the screen it runs on
The film SHALL move without visible stutter on the screen in the school. On a device that cannot keep up, it SHALL lower its rendering detail by itself instead of slowing down or stopping, and it SHALL NOT flash anything more than three times per second.

#### Scenario: Slow device
- **WHEN** the device renders fewer than 40 pictures per second for several seconds
- **THEN** the film lowers its resolution and keeps its timing, so the loop still lasts as long as on a fast device

### Requirement: Consistent with the other PV views
The production of a day SHALL be computed as in the other PV views, so that the film's value for a day matches the dashboard's value for the same day. The names "Produktion" and "kWh erzeugt" refer to production only.

#### Scenario: Same day in film and dashboard
- **WHEN** the film shows "393 kWh" for 20 May
- **THEN** the dashboard's day view for 20 May shows 393 kWh as production

### Requirement: No credentials in the browser or the repository
No content delivered to the browser by the film and no tracked file of the film SHALL contain a token, a password or a login.

#### Scenario: Delivered files
- **WHEN** all files delivered under `/kiosk2/` are searched for the database token
- **THEN** there is no match

### Requirement: Works without the internet
The film SHALL NOT load any file from a foreign server at run time; its typefaces and libraries SHALL be delivered with it.

#### Scenario: No internet access
- **WHEN** the screen reaches only the school network with the LeoIoT host
- **THEN** the film loads completely, in its own typefaces, and shows the data
