# Spec Delta

## Purpose

Describes the bold, high-contrast visual language applied to the 3D building explorer's UI chrome (buttons, panels, overlays, legends, typography), as distinct from the 3D building model's own rendered appearance and from the semantic data colours owned by other model3d capabilities.

## ADDED Requirements

### Requirement: Chrome uses a bold, high-contrast visual style
The explorer's UI chrome — the floor/view buttons, the room info panel, the loading screen, the heatmap toggle buttons and the route legend — SHALL use a bold, high-contrast visual style (strong typography, clear borders or elevation, high-contrast surfaces), applied consistently across all of these elements rather than to only some of them.

#### Scenario: Viewing any chrome element
- **WHEN** a user looks at the floor buttons, the room info panel, the loading screen, a heatmap toggle button or the route legend
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
Every control, panel, button and interaction present in the explorer before the redesign SHALL remain present and behave the same way after the redesign; the redesign SHALL only change visual appearance, not behaviour.

#### Scenario: Using a pre-existing control after the redesign
- **WHEN** a user operates any button, panel or interaction that existed before the redesign
- **THEN** it is still present and produces the same outcome as before
