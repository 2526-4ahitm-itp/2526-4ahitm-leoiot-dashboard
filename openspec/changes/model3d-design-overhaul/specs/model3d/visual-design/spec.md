# Spec Delta

## Purpose

Describes the bold, high-contrast visual language and the grouped control layout applied to the 3D building explorer's UI chrome (buttons, panels, overlays, legends, typography), as distinct from the 3D building model's own rendered appearance and from the semantic data colours owned by other model3d capabilities.

## ADDED Requirements

### Requirement: Chrome uses a bold, high-contrast visual style
The explorer's UI chrome — the floor stepper, the room info panel, the loading screen, the heatmap toggle buttons and the route legend — SHALL use a bold, high-contrast visual style (strong typography, clear borders or elevation, high-contrast surfaces), applied consistently across all of these elements rather than to only some of them.

#### Scenario: Viewing any chrome element
- **WHEN** a user looks at the floor stepper, the room info panel, the loading screen, a heatmap toggle button or the route legend
- **THEN** each one shows the same bold, high-contrast visual style

### Requirement: The 3D building model's appearance is unchanged
The redesign SHALL NOT change the building model's own rendered appearance: materials, textures, lighting and camera behaviour SHALL look exactly as they did before the redesign.

#### Scenario: Comparing the model before and after
- **WHEN** the building model is viewed after the chrome redesign
- **THEN** its materials, textures and lighting are visually unchanged from before the redesign

### Requirement: Semantic data colours are preserved exactly
The redesign SHALL NOT change the temperature heatmap colour scale, the CO₂ heatmap colour scale, or the route legend markers' semantic colours defined by `model3d/room-heatmap` and `model3d/room-navigation`. Only the chrome surrounding these elements (panel backgrounds, borders, button states, typography, spacing) SHALL change.

#### Scenario: Heatmap colours after the redesign
- **WHEN** a room is coloured by the temperature or CO₂ heatmap after the chrome redesign
- **THEN** its colour matches the same colour scale defined before the redesign

#### Scenario: Route legend colours after the redesign
- **WHEN** a route marker and its legend entry are shown after the chrome redesign
- **THEN** the marker's colour and its legend entry's colour are unchanged from before the redesign

### Requirement: No existing feature is removed
Every control, panel, button and interaction present in the explorer before the redesign SHALL remain present and behave the same way after the redesign; the redesign SHALL only change visual appearance and layout, not behaviour.

#### Scenario: Using a pre-existing control after the redesign
- **WHEN** a user operates any button, panel or interaction that existed before the redesign
- **THEN** it is still present and produces the same outcome as before

### Requirement: Floor switching is bare, captioned arrows
The explorer SHALL offer floor switching as bare arrow buttons — up, down, and a right-pointing arrow to the gym — each on its own, not grouped into a panel, moving one floor at a time in the same order and with the same limits as the up/down arrow keys, rather than one named button per floor. Each arrow SHALL be captioned with the name of the floor or view it leads to; an arrow with no valid destination (disabled) SHALL NOT show a caption naming one. While the gym is the current view, a left-pointing arrow captioned with the overview SHALL also be shown, as the way back to it; it SHALL NOT be shown otherwise.

#### Scenario: Stepping down through the floors
- **WHEN** a user repeatedly activates the down arrow from the whole-building view
- **THEN** each floor is shown one at a time, top to bottom, the same as repeatedly pressing the down arrow key would

#### Scenario: An arrow's caption names its destination
- **WHEN** a floor is shown and the down arrow would lead to another floor
- **THEN** the down arrow's caption names that floor, not the floor currently shown

#### Scenario: No floor beyond the ends
- **WHEN** the top floor or the basement is shown
- **THEN** the arrow that would go further in that direction is disabled, not merely ignored when activated, and shows no destination caption

#### Scenario: The arrows do nothing in the gym
- **WHEN** the gym is shown
- **THEN** both the up and down arrows are disabled, consistent with the arrow keys not changing the view there either

#### Scenario: Going to the gym
- **WHEN** a user activates the gym arrow (captioned "Gym")
- **THEN** the gym view is shown, the same as choosing it did before this change

#### Scenario: Going back from the gym
- **WHEN** the gym is shown and a user activates the left-pointing arrow
- **THEN** the whole-building view is shown

#### Scenario: The back arrow only appears in the gym
- **WHEN** any view other than the gym is shown
- **THEN** no left-pointing back arrow is shown

### Requirement: Primary controls are grouped by purpose, not scattered
The explorer's always-visible primary controls SHALL be grouped by purpose rather than scattered across many separate floating panels: the up arrow, the down arrow and the Gym button each float on their own, not grouped into a panel together or with anything else; Reset View, the heatmap overlay toggles and room search are grouped together into a single fixed dock, divided into clearly labelled groups (View, Overlays, Search). None of the explorer's always-visible controls SHALL be positioned where a contextual overlay (the room info panel, the route legend) can cover them.

#### Scenario: Viewing the primary controls
- **WHEN** a user looks at the explorer's primary controls
- **THEN** the up arrow, the down arrow and the Gym button are each shown bare, with no surrounding panel, and a separate dock is shown containing a View group, an Overlays group and a Search group, each visually distinguished from the others

#### Scenario: An always-visible control stays reachable during a route
- **WHEN** a route is active and its legend is shown, and the gym arrow's position coincides with the legend's
- **THEN** the gym arrow remains fully visible and clickable, drawn on top of the legend rather than hidden beneath it

### Requirement: Contextual overlays stay separate from the dock
The room info panel and the route legend — shown only when a room is selected or a route is active — are contextual results, not primary controls, and SHALL remain outside the dock in their own floating positions.

#### Scenario: Selecting a room while the dock is shown
- **WHEN** a user selects a room while the dock is visible
- **THEN** the room info panel appears in its own position, separate from the dock, and the dock's groups are unaffected

### Requirement: The search control stays visible and non-hidden
Consolidating search into the dock's Search group SHALL NOT make it a hidden control: the group's toggle SHALL remain visible at all times, and the destination popover it opens SHALL NOT overlap or be obscured by any other always-visible control (such as "Next floor"), consistent with `model3d/room-navigation` ("Visible controls to start and clear navigation").

#### Scenario: Opening the search popover
- **WHEN** a user activates the Search group's toggle
- **THEN** the search popover opens fully visible, without requiring a hidden gesture

#### Scenario: Search popover while a route is active
- **WHEN** a user starts navigation to a room from the search popover
- **THEN** the popover closes and the "Next floor" control (when shown) is fully visible, not obscured by the popover

### Requirement: Selecting a room shows its number as a giant watermark behind the model
When a room is selected, the explorer SHALL show that room's number as very large, bold text in a square/blocky (monospaced) typeface, positioned behind the 3D building model and sized to reach the full height of the screen, in a colour close enough to the page background to read as a tonal mark rather than a loud colour. It SHALL fade in when a room is selected and fade out when deselected, rather than appearing or disappearing instantly. The watermark SHALL be occluded by the building model wherever the model is opaque, so it reads as sitting behind the model rather than drawn on top of it, and SHALL NOT be shown while no room is selected.

#### Scenario: Selecting a room
- **WHEN** a user selects a room
- **THEN** that room's number fades in as giant bold text in a square typeface behind the model, reaching the top and bottom of the screen, in a shade close to the background, visible where the model doesn't cover it and hidden where the model does

#### Scenario: Deselecting
- **WHEN** a user deselects the room (closing the info panel, clicking elsewhere, or switching to a heatmap)
- **THEN** the watermark fades out and is no longer shown

### Requirement: The watermark fits room ids of any length on screen
A room id too long to show at the watermark's usual size SHALL be shrunk just enough to stay fully within the screen width, rather than overflowing off-screen or being cut off.

#### Scenario: Selecting a room with a long id
- **WHEN** a user selects a room whose id is long enough that the watermark's usual size would run off the edges of the screen
- **THEN** the watermark's text size is reduced so the whole id stays on screen, still legible

#### Scenario: Selecting a room with a short id
- **WHEN** a user selects a room whose id is short
- **THEN** the watermark keeps its usual full size, not shrunk unnecessarily

#### Scenario: The model's own appearance is unaffected
- **WHEN** the watermark is shown or hidden
- **THEN** the building model's materials, textures and lighting are unchanged, consistent with "The 3D building model's appearance is unchanged"
