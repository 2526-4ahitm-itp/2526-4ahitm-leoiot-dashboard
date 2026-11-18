# Spec Delta

## MODIFIED Requirements

### Requirement: Selecting a room shows its number as a giant watermark behind the model
When a room is selected, the explorer SHALL show that room's number as very large, bold text in a square/blocky (monospaced) typeface, positioned behind the 3D building model and sized to reach the full height of the screen. The text SHALL be split into two halves by a vertical line fixed at the horizontal centre of the screen — not at the centre of the room id's own text — with the left half coloured by the temperature heatmap scale's colour for the room's current temperature reading and the right half coloured by the CO2 heatmap scale's colour for the room's current CO2 reading, each exactly as the heatmap overlay would colour that room for that quantity. A side with no current reading — no reading has ever arrived, or the latest reading is stale by the same 5-minute rule the heatmap uses — SHALL instead show a fixed generic colour for that side: green on the temperature side, yellow on the CO2 side. This colouring applies whenever a room is selected, independently of whether any heatmap overlay is toggled on. The watermark SHALL fade in when a room is selected and fade out when deselected, rather than appearing or disappearing instantly. The watermark SHALL be occluded by the building model wherever the model is opaque, so it reads as sitting behind the model rather than drawn on top of it, and SHALL NOT be shown while no room is selected.

#### Scenario: Selecting a room with current readings
- **WHEN** a user selects a room that has a current (non-stale) temperature reading and a current CO2 reading
- **THEN** that room's number fades in as giant bold text in a square typeface behind the model, reaching the top and bottom of the screen, its left half coloured by the temperature heatmap scale and its right half coloured by the CO2 heatmap scale, split exactly at the screen's horizontal centre regardless of where the room id's own characters fall around it

#### Scenario: Selecting a room with no data on one side
- **WHEN** a user selects a room that has no reading, or only a stale reading (older than 5 minutes), for temperature or for CO2
- **THEN** the side with no current reading shows the generic fallback colour for that side — green for temperature, yellow for CO2 — instead of a heatmap-scale colour

#### Scenario: Selecting a room with no data on both sides
- **WHEN** a user selects a room that has no current reading for either temperature or CO2
- **THEN** the watermark shows the generic green on its left half and the generic yellow on its right half

#### Scenario: A live reading arrives while the room stays selected
- **WHEN** a new temperature or CO2 reading arrives for the currently selected room
- **THEN** the corresponding half of the watermark updates to reflect the new reading's colour (or reverts to the generic fallback colour if the existing reading has since gone stale), without needing the room to be reselected

#### Scenario: The colour split is independent of the heatmap overlay
- **WHEN** a room is selected and no heatmap overlay (temperature or CO2) is currently toggled on
- **THEN** the watermark still shows its two-colour split, the same as it would with a heatmap overlay active

#### Scenario: Deselecting
- **WHEN** a user deselects the room (closing the info panel, clicking elsewhere, or switching to a heatmap)
- **THEN** the watermark fades out and is no longer shown
