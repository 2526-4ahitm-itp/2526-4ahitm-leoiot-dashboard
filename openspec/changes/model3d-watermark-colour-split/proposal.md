# Proposal

## Why

The selected-room watermark (`model3d/visual-design`, "Selecting a room shows its number as a giant watermark behind the model") currently renders in a single near-background tone and carries no information about the room's climate. A user looking at the watermark has to also open the room info panel to learn the temperature and CO2 status; showing that status directly in the watermark's colour saves that step and uses space that is otherwise purely decorative.

## What Changes

- The watermark's text is split into two colours down a vertical line fixed at the horizontal centre of the screen (not the centre of the room id's own text) — the left half shows the colour the temperature heatmap scale would give the selected room's current reading, the right half shows the colour the CO2 heatmap scale would give it.
- A side with no current reading for that quantity — no reading at all, or a reading stale by the same 5-minute rule the heatmap already uses — shows a fixed generic colour instead of a scale colour: green (`STATUS_COLOUR.green`, `#4caf50`) on the temperature side, yellow (`STATUS_COLOUR.yellow`, `#ffd54f`) on the CO2 side.
- This applies whenever a room is selected, regardless of whether a heatmap overlay is currently toggled on — the watermark's colouring is not gated by `Controls`' heatmap state, consistent with how the watermark already shows independently of it today.
- Everything else about the watermark (sizing/refit, fade in/out, occlusion behind the model, monospaced square typeface) is unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `model3d/visual-design`: the requirement "Selecting a room shows its number as a giant watermark behind the model" changes from a single fixed near-background colour to a two-colour split (temperature-scale colour | CO2-scale colour), centred on the screen, with a defined generic-colour fallback per side when that side has no current reading.

## Impact

- `leoiot-3d/explorer/src/ui/watermark.ts`: `RoomWatermark` needs the selected room's current temperature/CO2 cell colours (or the fallback) to paint the split, and needs to repaint when a live reading changes while the room stays selected, not only on `show()`.
- `leoiot-3d/explorer/src/ui/styles.css`: `.room-watermark`'s single `color: var(--watermark)` rule is replaced by a two-colour rendering fixed to the viewport's own centre line (e.g. a full-viewport gradient clipped to the text), not to the text node's own bounding box.
- `leoiot-3d/explorer/src/app.ts`: the call site that drives `RoomWatermark.show()`/update already has access to `this.store.get(this.selected)` (the same reading used for the info panel and heatmap); it needs to also pass this watermark's two colours through on every render while a room is selected, not just on selection change.
- No change to `core/colours.ts` or `core/heatmap.ts` scale definitions themselves — only a new consumer of their existing exported functions/constants.
