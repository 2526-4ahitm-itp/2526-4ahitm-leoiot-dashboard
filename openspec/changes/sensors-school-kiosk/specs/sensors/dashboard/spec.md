# Spec Delta

## ADDED Requirements

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
