# Spec Delta

## ADDED Requirements

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
