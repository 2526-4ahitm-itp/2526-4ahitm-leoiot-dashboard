# Spec Delta

## Purpose

Lets a user pick a destination room in the 3D building explorer and see a route to it, drawn through the building's hand-placed corridor waypoints the same way legacy's own navigation drew one, with visible controls to start and clear that route.

## ADDED Requirements

### Requirement: Routes start at the building entrance
A navigation route SHALL start at the building's main entrance waypoint (the ground floor) or the gym's entrance waypoint (for a gym room), and end at the chosen destination room, independent of the view or room currently shown.

#### Scenario: Starting a route while a different room is selected
- **WHEN** a user starts navigation to a room while viewing or having selected an unrelated room
- **THEN** the displayed path begins at the building entrance (or the gym entrance, for a gym room) and ends at the chosen destination room

### Requirement: Path follows the building's real corridor connections
On floors `U`, `E`, `1` and `2`, the system SHALL compute the shortest navigation path over the explicit waypoint adjacency the project owner described from `waypoints.gltf` (`CORRIDOR_ADJACENCY`/`STAIR_ADJACENCY` in `src/nav/legacyData.ts`), never stepping between two waypoints that aren't directly connected in that data.

#### Scenario: Every destination room on U/E/1/2 reaches its door
- **WHEN** a user navigates to a room on floor `U`, `E`, `1` or `2`
- **THEN** the system renders the shortest path, over only the described connections, ending at that room's door and the room itself

In the gym (`T`), the system SHALL instead walk waypoint to waypoint, always moving to the reachable waypoint that most reduces the remaining distance to the destination, matching legacy's own navigation behaviour — out of scope for the real-adjacency rework above (see `design.md` D7).

Known limitation of the gym's walk, inherited unchanged from legacy: it neither guarantees the shortest route nor guarantees staying clear of every wall, including that for some destinations (gym room `T12`, never named in legacy's own per-room intersection rules) the walk does not reach the room's door at all.

### Requirement: Multi-floor navigation crosses at a stairway
When a route crosses from one floor to another, the system SHALL route the path through the stairs waypoint that connects that pair of floors.

#### Scenario: Crossing floors
- **WHEN** a route goes from one floor to another
- **THEN** the displayed path passes through the connecting stairs waypoint between them

### Requirement: Navigation starts on the floor the route begins on
Starting navigation SHALL show the floor the route itself starts on (the ground floor for a room on `U`, `E`, `1` or `2`; the gym for a gym room), independent of which floor or view was shown beforehand and independent of the destination room's own floor.

#### Scenario: Starting navigation to a room on another floor
- **WHEN** a user starts navigation to a room on floor 2 while the whole building, or any other floor, is shown
- **THEN** the view switches to the ground floor — the floor the route starts on — not to floor 2

### Requirement: A multi-floor route reveals one floor at a time
For a route that crosses more than one floor, the system SHALL show only the portion of the route on floors already shown — the current floor and everything beneath it, the same stacking rule the floor views themselves follow — and SHALL offer a visible control to advance to the route's next floor. Once the floor shown is the last floor the route crosses, that control SHALL NOT be shown. Likewise it SHALL offer a visible control to step back to the floor the route crosses before the one shown, not shown on the route's first floor. The newly-revealed portion SHALL draw in with a smooth, brief animation rather than appearing instantly, growing steadily along the route's own shape rather than visibly twisting or wobbling before settling; the portion already shown before advancing SHALL NOT be affected by that animation.

#### Scenario: Advancing through a multi-floor route
- **WHEN** a user activates the "next floor" control while the active route continues onto a floor not yet shown
- **THEN** the view advances to that floor and the route's segment on it draws itself in, without the already-shown portion changing

#### Scenario: Stepping back a floor
- **WHEN** a user activates the "previous floor" control while a floor after the route's first one is shown
- **THEN** the view returns to the floor the route crosses before it, showing the route as it is on that floor

#### Scenario: No further floor to advance to
- **WHEN** the floor currently shown is the last floor the active route crosses
- **THEN** the "next floor" control is not shown

#### Scenario: The reveal animation doesn't distort the route
- **WHEN** the newly-revealed portion is drawing itself in
- **THEN** it keeps the route's own straight-segment shape throughout the animation, reaching its final shape without visibly twisting or wobbling first

### Requirement: Turn and stairs markers show the way along the route
Wherever the displayed portion of a route bends by more than a small threshold within one floor, the system SHALL show a marker indicating whether to turn left or right. Wherever the displayed portion crosses from one floor to another, the system SHALL show a marker indicating whether to go up or down and naming the floor the stairs lead to. Each marker SHALL be shown as a single, fully coloured dot at its own exact point on the route, hidden behind a wall or other opaque part of the building the same way the route line itself is, rather than always drawing on top of it. Each marker's own colour SHALL match an entry in a legend naming what it means, distinguishing one marker from another by colour even when their points are close together. The legend SHALL group entries into one section per floor, so entries for a floor already shown remain visible, in their own section, as further floors are revealed. Sections SHALL appear in the building's own top-to-bottom floor order (the same order as the floor buttons), not the order the route visits them, so a higher floor's section is never shown below a lower floor's.

#### Scenario: A turn along the corridor
- **WHEN** the displayed route bends by more than a small threshold within one floor
- **THEN** a marker at that exact point shows which way to turn, and a legend entry of the same colour names it

#### Scenario: A stairway crossing
- **WHEN** the displayed route crosses from the current floor to another
- **THEN** a marker at that exact point shows whether to go up or down and names the floor the stairs lead to, and a legend entry of the same colour names it

#### Scenario: Two markers close together are still distinguishable
- **WHEN** two or more markers' points are close enough on screen to be hard to tell apart on their own
- **THEN** each keeps its own distinct colour, matching its own legend entry

#### Scenario: The legend keeps earlier floors in their own section
- **WHEN** a multi-floor route has revealed more than one floor so far
- **THEN** the legend shows one section per revealed floor, each still listing the markers for that floor

#### Scenario: Legend sections follow the building, not the route
- **WHEN** a multi-floor route starts on a lower floor and is revealed upward floor by floor
- **THEN** the legend lists the higher floor's section above the lower floor's, even though the lower floor was revealed first

#### Scenario: A marker behind a wall
- **WHEN** a marker's point lies behind a wall or other opaque part of the building from the camera's current position, the same as a point on the route line itself would
- **THEN** the marker is hidden the same way that point on the route line is, not visible through the wall

### Requirement: Visible controls to start and clear navigation
The explorer SHALL provide a visible, non-hidden control to choose a destination room and start navigation to it, and a visible control to clear the active route, consistent with providing clear navigation/actions without hidden primary controls. A selected room's info panel SHALL also offer a visible control to start navigation to that room directly, as a second way into the same navigation.

#### Scenario: Starting navigation from the visible control
- **WHEN** a user opens the navigation control and picks a destination room
- **THEN** the system starts navigation and displays the resulting path without requiring any hidden menu or gesture

#### Scenario: Starting navigation from the room's info panel
- **WHEN** a user selects a room and activates the "navigate here" control on its info panel
- **THEN** the system starts navigation to that room, the same as choosing it through the search control

#### Scenario: Clearing an active route
- **WHEN** a user activates the clear/cancel control while a route is displayed
- **THEN** the system removes the displayed path and returns to the unguided view

### Requirement: The destination is the selected room
Starting navigation SHALL select the destination room, replacing any other selected room, with its info panel, and it SHALL stay selected while the route is stepped through its floors, its highlight showing once its own floor is shown.

#### Scenario: Navigating while another room is selected
- **WHEN** room `152` is selected and the user starts navigation to `203`
- **THEN** `152` is no longer selected and `203` is selected with its info panel, also while the route's ground floor and floor 1 are shown

### Requirement: Selecting another room ends navigation
Selecting a room other than the active route's destination SHALL clear the active route, the same as the dedicated clear control, and select that room. Selecting the destination itself SHALL keep the route. The room search box SHALL hold the active route's destination however navigation was started, and SHALL be emptied when the route is cleared, whether by the clear control, Reset View or selecting another room.

#### Scenario: Clicking another room during navigation
- **WHEN** a route to `203` is active and the user clicks room `105`
- **THEN** the route, its markers, the legend and the floor step controls are cleared, the search box is emptied, and `105` is selected with its info panel

#### Scenario: Navigating from the info panel fills the search box
- **WHEN** the user selects room `203` and activates "navigate here"
- **THEN** the search box shows `203`

#### Scenario: Clicking the destination during navigation
- **WHEN** a route to `203` is active and the user clicks room `203`
- **THEN** the route stays and `203` is selected with its info panel

### Requirement: Reset View also clears the active route
Activating "Reset View" (`model3d/building-viewer`, "Reset View returns to the start") SHALL also clear any active navigation route, the same as the dedicated clear control, consistent with Reset View returning the explorer to its unguided start state.

#### Scenario: Resetting while a route is active
- **WHEN** a user activates "Reset View" while a navigation route is displayed
- **THEN** the route, its markers and the legend are cleared, in addition to the whole building being shown from the start camera position

### Requirement: Enter starts navigation from the search box
Pressing Enter in the room search box SHALL start navigation to the entered room, the same as activating the "go" control.

#### Scenario: Confirming the search with Enter
- **WHEN** a user types a room id into the search box and presses Enter
- **THEN** the system starts navigation to that room exactly as the "go" control would, including the "room not found" message for a room that does not exist

### Requirement: The destination room's number is shown behind the building
While a route is active, the system SHALL show the destination room's id behind the building model, its characters nearly as tall as the screen (narrowed if they would not fit across it), in a grey slightly brighter than the background, so it never covers the model or any control. Without an active route, the selected room's id SHALL be shown the same way; with neither, nothing is shown. When both exist, the room the user chose last — by selecting it or by starting navigation to it — SHALL be shown.

#### Scenario: Navigating to a room
- **WHEN** a user starts navigation to room `203`
- **THEN** `203` is shown faint behind the building, nearly as tall as the screen, until the route is cleared

#### Scenario: Selecting another room ends the route's number
- **WHEN** a route to `203` is active and the user selects room `105`
- **THEN** the route ends (see "Selecting another room ends navigation") and `105` is shown behind the building

#### Scenario: Selecting a room without a route
- **WHEN** no route is active and a user selects a room
- **THEN** that room's id is shown behind the building until it is deselected

### Requirement: The active route can be printed
While a route is active, the explorer SHALL offer a visible control to print it. The printed route SHALL contain the destination, one section per floor the route crosses in the order the route walks them, each with that floor's turn and stairs markers as numbered steps, ending with the arrival at the destination. Unless the route only passes through a floor's own stairwell between the stairs above and below with nothing else on that floor, each section SHALL also show a picture of that floor seen from directly above, with its walls, each of its rooms labelled by its id, its part of the route and, over each marker, its own step number. The printed route and its markers SHALL print in black, not their on-screen colours. It SHALL cover the whole route, independent of how many floors have been revealed on screen. Printing through the browser's own print command SHALL produce the same printed route.

#### Scenario: Printing a multi-floor route
- **WHEN** a user activates the print control while a route from the ground floor to floor 2 is active, with only the ground floor revealed
- **THEN** the printout shows sections for the ground floor, floor 1 and floor 2 in that order, each with its numbered steps, followed by the arrival at the destination

#### Scenario: A floor's picture only shows that floor
- **WHEN** a floor's section is pictured, and the building model for that floor also carries the floors beneath it
- **THEN** only that floor's own walls and room labels are drawn; the floors beneath show through only where the picture has nothing drawn over them, as on screen

#### Scenario: A floor that's only a stairwell pass-through has no picture
- **WHEN** a route climbs straight from one floor's stairs to the next floor's stairs, at the same stairwell, without visiting anything else on the floor in between
- **THEN** that floor's section shows its title and its one numbered step (the stairs onward) but no picture

#### Scenario: Printing without a route
- **WHEN** no route is active
- **THEN** no print control is shown and the browser's print command prints the page as it is

### Requirement: Invalid destination does not start navigation
If a user selects or searches for a room that does not exist, the system SHALL NOT start or display a navigation path, and SHALL show a message that the room cannot be found.

#### Scenario: Selecting a non-existent room
- **WHEN** a user searches for a room id that does not exist in the building
- **THEN** the system does not navigate and shows a message that the room cannot be found
