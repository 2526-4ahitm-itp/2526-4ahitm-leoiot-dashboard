# Spec Delta

## Purpose

Lets a user pick a destination room in the 3D building explorer and see a route to it, drawn through the building's hand-placed corridor waypoints the same way legacy's own navigation drew one, with visible controls to start and clear that route.

## ADDED Requirements

### Requirement: Routes start at the building entrance
A navigation route SHALL start at the building's main entrance waypoint (the ground floor) or the gym's entrance waypoint (for a gym room), and end at the chosen destination room, independent of the view or room currently shown.

#### Scenario: Starting a route while a different room is selected
- **WHEN** a user starts navigation to a room while viewing or having selected an unrelated room
- **THEN** the displayed path begins at the building entrance (or the gym entrance, for a gym room) and ends at the chosen destination room

### Requirement: Path follows the hand-placed corridor waypoints
The system SHALL compute a navigation path by walking the building's hand-placed corridor waypoints and hallway segments (`src/nav/legacyData.ts`), always moving to the reachable waypoint that most reduces the remaining distance to the destination, matching legacy's own navigation behaviour.

#### Scenario: Every destination room with a resolvable route reaches its door
- **WHEN** a user navigates to a room whose destination waypoints are reachable by this walk
- **THEN** the system renders a path ending at that room's door and the room itself

Known limitation, inherited unchanged from legacy: this greedy walk neither guarantees the shortest route nor guarantees staying clear of every wall — the same data and the same algorithm legacy used, including that for some destinations (for example gym room `T12`, never named in legacy's own per-room intersection rules) the walk does not reach the room's door at all.

### Requirement: Multi-floor navigation crosses at a stairway
When the destination room is on a different floor than the current view, the system SHALL route the path through the stairs waypoint that connects the two floors, and SHALL switch the displayed floor to the destination's floor as soon as navigation starts.

#### Scenario: Navigating to a room on another floor
- **WHEN** a user starts navigation to a room on a floor different from the one currently shown
- **THEN** the view switches to the destination room's floor immediately, and the displayed path passes through the connecting stairs waypoint

### Requirement: Visible controls to start and clear navigation
The explorer SHALL provide a visible, non-hidden control to choose a destination room and start navigation to it, and a visible control to clear the active route, consistent with providing clear navigation/actions without hidden primary controls.

#### Scenario: Starting navigation from the visible control
- **WHEN** a user opens the navigation control and picks a destination room
- **THEN** the system starts navigation and displays the resulting path without requiring any hidden menu or gesture

#### Scenario: Clearing an active route
- **WHEN** a user activates the clear/cancel control while a route is displayed
- **THEN** the system removes the displayed path and returns to the unguided view

### Requirement: Invalid destination does not start navigation
If a user selects or searches for a room that does not exist, the system SHALL NOT start or display a navigation path, and SHALL show a message that the room cannot be found.

#### Scenario: Selecting a non-existent room
- **WHEN** a user searches for a room id that does not exist in the building
- **THEN** the system does not navigate and shows a message that the room cannot be found
