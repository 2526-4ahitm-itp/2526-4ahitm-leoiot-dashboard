# Spec Delta

## Purpose

Describes the temperature and CO₂ heatmaps of the 3D building explorer: which rooms they colour, the colour scales, the value labels and how rooms without current data appear. Rooms, live values and their age are those of `model3d/room-climate-view`.

## ADDED Requirements

### Requirement: Two heatmaps for the selected floor
The explorer SHALL offer always visible buttons "Temperature" and "CO2". A heatmap SHALL colour only the rooms of the selected floor (basement, ground floor, floor 1 or floor 2), not the rooms of the floors beneath it. At most one heatmap SHALL be shown at a time; selecting the other one replaces it, and selecting the shown one again switches it off. In the whole-building view and the gym view the heatmap buttons SHALL be disabled and no heatmap SHALL be shown.

#### Scenario: CO₂ heatmap on floor 1
- **WHEN** floor 1 is shown and the user selects "CO2"
- **THEN** every room of floor 1 is coloured and labelled, and the rooms of the basement and ground floor keep their normal look

#### Scenario: Switching heatmaps
- **WHEN** the temperature heatmap is shown and the user selects "CO2"
- **THEN** the temperature heatmap disappears and the CO₂ heatmap is shown

#### Scenario: Switching a heatmap off
- **WHEN** the CO₂ heatmap is shown and the user selects "CO2" again
- **THEN** no heatmap is shown

#### Scenario: Whole building and gym
- **WHEN** the whole building or the gym is shown
- **THEN** both heatmap buttons are disabled

### Requirement: A heatmap follows the floor
When a heatmap is shown and the user selects another floor, the same heatmap SHALL be shown for the newly selected floor. When the user selects the whole building, the gym or "Reset View", the heatmap SHALL be switched off.

#### Scenario: Changing floors
- **WHEN** the temperature heatmap is shown on floor 1 and the user selects "Floor 2"
- **THEN** the temperature heatmap is shown for the rooms of floor 2 only

#### Scenario: Going to the gym
- **WHEN** the CO₂ heatmap is shown on the ground floor and the user selects "Gym"
- **THEN** no heatmap is shown and both heatmap buttons are disabled

### Requirement: Temperature colours and labels
In the temperature heatmap a room with a current temperature SHALL be coloured on a continuous scale from blue `#8da1d6` at 20 °C or below to red `#d68d8d` at 25 °C or above, linear in between, and SHALL carry a label with its temperature to one decimal followed by `°C` (for example `21.3°C`).

#### Scenario: Scale ends
- **WHEN** rooms have 18.0 °C, 20.0 °C, 25.0 °C and 27.5 °C
- **THEN** the first two are `#8da1d6`, the last two `#d68d8d`

#### Scenario: Middle of the scale
- **WHEN** a room has 22.5 °C
- **THEN** its colour lies halfway between `#8da1d6` and `#d68d8d`, and its label reads `22.5°C`

### Requirement: CO₂ colours and labels
In the CO₂ heatmap a room with a current CO₂ value SHALL be coloured on a continuous scale without jumps, with green at 400 ppm or below, yellow at 600 ppm, red at 1200 ppm and a deeper red at 2000 ppm or above, linear between these stops. Its label SHALL show the value in ppm (for example `850 ppm`) together with the FR-07 status symbol of `model3d/room-climate-view`, because the colour alone does not show on which side of a limit a value lies.

#### Scenario: Continuous colour
- **WHEN** two rooms have 400 ppm and 599 ppm
- **THEN** their colours differ visibly

#### Scenario: Status at a limit
- **WHEN** two rooms have 1200 ppm and 1201 ppm
- **THEN** their colours are almost the same, the first label carries the yellow status symbol and the second the red one

#### Scenario: Above the scale
- **WHEN** a room has 2600 ppm
- **THEN** it has the colour of 2000 ppm and its label reads `2600 ppm` with the red status symbol

### Requirement: Rooms without current data in a heatmap
In a heatmap, a room without data for the heatmap's quantity SHALL keep its normal look and carry the label "No data". A room whose value is stale SHALL be grey and carry a warning symbol with its last value.

#### Scenario: Room without a message
- **WHEN** the CO₂ heatmap is shown on floor 1 and no message for room `106` has been received
- **THEN** room `106` is not coloured and is labelled "No data"

#### Scenario: Room with temperature only
- **WHEN** the CO₂ heatmap is shown and room `107`'s newest message carries only `temperature`
- **THEN** room `107` is labelled "No data" in the CO₂ heatmap

#### Scenario: Stale room
- **WHEN** the temperature heatmap is shown and room `105`'s newest message is 8 minutes old with 21.3 °C
- **THEN** room `105` is grey and labelled with the warning symbol and `21.3°C`

### Requirement: Heatmaps update live
A shown heatmap SHALL update a room's colour and label when a newer message for that room arrives, and when its value turns stale, without any action of the user.

#### Scenario: New reading
- **WHEN** the CO₂ heatmap shows room `105` at 850 ppm and a newer message with 1300 ppm arrives
- **THEN** room `105` changes to the colour of 1300 ppm and its label to `1300 ppm` with the red status symbol
