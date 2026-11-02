# Spec Delta

## Purpose

Describes the 3D building explorer as a viewer: where it is reached, how the building model is loaded and shown, and how a user moves between the whole building, the floors and the gym. What the explorer shows about a room's climate is specified in `model3d/room-climate-view` and `model3d/room-heatmap`.

## ADDED Requirements

### Requirement: The explorer is reached at `/3d/`
The 3D building explorer SHALL be served at the address `/3d/` of the LeoIoT host. The address `/3d` without a trailing slash SHALL lead to `/3d/`. The explorer SHALL need no credentials, no token and no configuration of its own, and SHALL deliver no credential to the browser.

#### Scenario: Opening the address
- **WHEN** a browser opens `/3d/` or `/3d`
- **THEN** it shows the 3D building explorer

#### Scenario: Health check
- **WHEN** the container is asked for `/healthz`
- **THEN** it answers with status 200

#### Scenario: Nothing secret in the page
- **WHEN** every file the explorer delivers to the browser is searched
- **THEN** none contains a token, password or user name

### Requirement: The models are loaded before the explorer can be used
On opening, the explorer SHALL load all building models (the whole building, the four cumulative floor models and the gym) and SHALL show a loading screen that covers the view until all of them are loaded. After loading, switching between views SHALL NOT load a model again. If a model cannot be loaded, the explorer SHALL replace the loading screen with an error message that names the failure and offers to try again, instead of loading forever.

#### Scenario: First visit
- **WHEN** a user opens the explorer
- **THEN** a loading screen is shown until every model is loaded, and then the whole building appears

#### Scenario: Switching after loading
- **WHEN** all models are loaded and the user switches from floor 1 to the gym and back
- **THEN** each view appears without a new download

#### Scenario: Model fails to load
- **WHEN** one model file cannot be fetched
- **THEN** the explorer shows an error message with a way to try again, and no endless loading screen

### Requirement: Start view shows the whole building
After loading, the explorer SHALL show the whole school building, including the roof slab and without the gym, from a fixed start camera position.

#### Scenario: Start view
- **WHEN** loading has finished
- **THEN** the whole building is shown from the start camera position and no floor button is marked as selected

### Requirement: Floor views show a floor with the floors beneath it
The explorer SHALL offer always visible buttons for the views basement (`U`), ground floor (`E`), floor 1 (`1`) and floor 2 (`2`). Selecting a floor SHALL show that floor and every floor beneath it, and no floor above it. The selected view SHALL be marked.

| Button | Shows |
|---|---|
| Basement | basement |
| Ground floor | basement, ground floor |
| Floor 1 | basement, ground floor, floor 1 |
| Floor 2 | basement, ground floor, floor 1, floor 2 |

#### Scenario: Selecting floor 1
- **WHEN** the user selects "Floor 1"
- **THEN** the basement, the ground floor and floor 1 are shown, floor 2 and the roof are not, and "Floor 1" is marked as selected

#### Scenario: Selecting the basement
- **WHEN** the user selects "Basement"
- **THEN** only the basement is shown

### Requirement: The gym is shown on its own
The explorer SHALL offer an always visible button "Gym" that shows the gym building alone, without the school building.

#### Scenario: Selecting the gym
- **WHEN** the user selects "Gym"
- **THEN** only the gym and its rooms are shown

### Requirement: Reset View returns to the start
The explorer SHALL offer an always visible button "Reset View" that shows the whole building again and puts the camera back to the start position.

#### Scenario: Reset after moving around
- **WHEN** the user has rotated and zoomed the camera on floor 2 and selects "Reset View"
- **THEN** the whole building is shown from the start camera position

### Requirement: The camera is moved by the user
In every view the user SHALL be able to rotate the camera around the building, zoom and pan with mouse or touch.

#### Scenario: Rotating
- **WHEN** the user drags with the primary mouse button
- **THEN** the camera rotates around the building

### Requirement: The layout does not break on small screens
The explorer is designed for desktop screens. On a screen 360 px wide its controls SHALL stay visible and usable, and the page SHALL NOT scroll horizontally.

#### Scenario: Phone width
- **WHEN** the explorer is opened at 360 × 740 px
- **THEN** all view buttons and the heatmap buttons are reachable without horizontal scrolling

### Requirement: The interface is in English, with all texts in one place
The explorer SHALL show its interface in English. Every text it shows SHALL come from one place in the code, so that a second language can be added without searching the code for texts. German is not part of this capability yet.

#### Scenario: Looking for a label
- **WHEN** a developer wants to change the label "Reset View"
- **THEN** they change it in the one module that holds all texts, and nowhere else
