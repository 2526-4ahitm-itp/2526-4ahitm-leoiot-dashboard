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
For a route that crosses more than one floor, the system SHALL show only the portion of the route on floors already shown — the current floor and everything beneath it, the same stacking rule the floor views themselves follow — and SHALL offer a visible control to advance to the route's next floor. Once the floor shown is the last floor the route crosses, that control SHALL NOT be shown. The newly-revealed portion SHALL draw in with a smooth, brief animation rather than appearing instantly; the portion already shown before advancing SHALL NOT be affected by that animation.

#### Scenario: Advancing through a multi-floor route
- **WHEN** a user activates the "next floor" control while the active route continues onto a floor not yet shown
- **THEN** the view advances to that floor and the route's segment on it draws itself in, without the already-shown portion changing

#### Scenario: No further floor to advance to
- **WHEN** the floor currently shown is the last floor the active route crosses
- **THEN** the "next floor" control is not shown

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

### Requirement: Invalid destination does not start navigation
If a user selects or searches for a room that does not exist, the system SHALL NOT start or display a navigation path, and SHALL show a message that the room cannot be found.

#### Scenario: Selecting a non-existent room
- **WHEN** a user searches for a room id that does not exist in the building
- **THEN** the system does not navigate and shows a message that the room cannot be found
