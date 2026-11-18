# Design

## Context

`RoomWatermark` (`leoiot-3d/explorer/src/ui/watermark.ts`) is a single `<div>` with one text node, shown/hidden/resized by `App.render()` (`app.ts`) whenever `this.selected` changes or the window resizes. Its colour today is one static CSS custom property, `--watermark`, set once in `styles.css` and never touched from TypeScript.

The colours this change needs already exist and are already computed per-room every render: `App.render()` (`app.ts:186-198`) calls `cell(kind, this.store.get(room), now)` from `core/heatmap.ts` for every room on the current floor, which returns a `Cell` carrying a `colour` (from `temperatureColour`/`co2Colour` in `core/colours.ts`) for a current reading, or `{ kind: 'none' }` for no reading, or `STALE_COLOUR` for a stale one. The selected room's own cells are not currently kept around after that loop — only used to set the 3D model's material colour.

See proposal.md - Why / What Changes for the motivation and scope; see the modified requirement in `specs/model3d/visual-design/spec.md` for the exact behaviour.

Note: this requirement currently lives only in the as-yet-unarchived `model3d-design-overhaul` change (`openspec/changes/model3d-design-overhaul/specs/model3d/visual-design/spec.md`); that change is fully implemented on this branch (all 67 tasks done) but not yet merged into `openspec/specs/`. This delta is written against that pending text, the same relationship it will have once archived.

## Goals / Non-Goals

**Goals:**
- Reuse the exact same colour-producing functions the heatmap already uses (`temperatureColour`, `co2Colour`, `STALE_COLOUR` check via `freshness()`), so the watermark can never show a colour the heatmap itself wouldn't for the same reading — one source of truth for "what colour does this reading map to."
- Make the split boundary a property of the viewport, not of the rendered text, so it stays exactly screen-centred regardless of room id length, `refit()`'s font-size scaling, or kerning.
- Recompute the watermark's colours on every render while a room stays selected (not only on `show()`), so a live reading update is reflected without requiring reselection.

**Non-Goals:**
- Changing `core/colours.ts` or `core/heatmap.ts` scale definitions — this only adds a second consumer of their existing exports.
- Changing the watermark's size/refit/fade/occlusion behaviour (`model3d/visual-design` - "The watermark fits room ids of any length on screen" is untouched).
- Archiving `model3d-design-overhaul` — out of scope for this change; it is referenced as-is.

## Decisions

- **Compute the two colours in `app.ts`, pass them into `RoomWatermark`, rather than having `RoomWatermark` read `RoomStore` itself.** `App` already has `this.store` and already computes the equivalent per-room cell for the heatmap loop; giving `RoomWatermark` its own store reference would duplicate that dependency and the freshness/fallback logic for no real benefit. Alternative considered: let `RoomWatermark` pull from the store directly — rejected, it would need its own copy of the "none/stale → fallback" branching already written once for the heatmap path.
- **`RoomWatermark.show(room, temperatureColour, co2Colour)` takes the two resolved colours (already defaulted to the generic fallback by the caller), not a `Reading` or `Cell`.** Keeps `RoomWatermark` a pure presentation component with no knowledge of the heatmap/status domain, consistent with its current role (it only knows about a room id string today). A new `RoomWatermark.update(temperatureColour, co2Colour)` (or folding this into `show`, called every render) handles the "reading changed while still selected" case; `hide()` is unaffected.
- **The fallback-vs-scale decision (no reading / stale → generic colour; otherwise scale colour) is computed once, in `app.ts`, from the same `cell()` call already available conceptually from `core/heatmap.ts`.** Using `cell('temperature', reading, now)` / `cell('co2', reading, now)` directly (not a new helper) for the selected room specifically — `kind === 'current'` uses `colour`, anything else (`'none'` or `'stale'`) uses the generic fallback. This mirrors exactly how the heatmap loop already treats the same three cases, just inverted for the "no data" and "stale" branches (heatmap shows `STALE_COLOUR`/no colour; here both collapse to the one fixed fallback per side, per the proposal's answered open question).
- **The two generic fallback colours are the existing `STATUS_COLOUR.green`/`STATUS_COLOUR.yellow` from `core/colours.ts`, not new constants.** Avoids a second definition of "green"/"yellow" existing only for this feature.
- **The split is rendered as a `linear-gradient(to right, <temp> 50%, <co2> 50%)` background on `.room-watermark` itself (already a `position: fixed; inset: 0` full-viewport box per `styles.css`), clipped to the text via `background-clip: text` (`color: transparent` on the clipped text, with `-webkit-background-clip: text` for the stroke to follow).** Because the gradient is defined on the full-viewport box, its 50% stop is the viewport's own horizontal centre, not the text's bounding-box centre — satisfying "exactly down the middle of the screen, not the middle of the word" without measuring the text at all. Alternative considered: split the room id string into two `<span>`s styled individually — rejected, the split point would then be the midpoint between characters (and would misplace for odd-length ids, or ids where `refit()` has scaled/centred the text), which is the exact problem being asked to avoid.
- **The `-webkit-text-stroke` (used today for boldness, per `model3d-design-overhaul`'s design.md) keeps a single colour rather than also splitting.** Splitting the stroke the same way doubles the gradient/clip complexity for a few pixels of outline; the stroke colour is set to whichever colour currently style the majority of visual weight is simplest as the temperature-side colour when either side's fallback, OR — simpler still — drop the stroke to a neutral dark tone so it stays legible against either half. This is flagged as an implementation detail to confirm visually once built (see Open Questions), not a spec-level concern (the spec only requires the two fill halves).
- **Recomputation happens unconditionally on every `App.render()` while `this.selected !== null`**, the same place `panel.show()` and the heatmap loop already recompute per-render from `this.store`. No new dirty-checking/memoisation: `RoomWatermark.show()`/`update()` setting the same two colour strings again is a cheap no-op visually, and `App.render()` already runs at most once per animation frame (`schedule()`), so this adds no new throttling concern.

## Risks / Trade-offs

- [`background-clip: text` plus a simultaneous `-webkit-text-stroke` is a combination worth visually verifying once implemented — some browsers render the stroke on top of (not clipped by) the gradient fill, which could make the stroke's single colour visually dominate over the split] → Verify in a real browser after implementing, the same way the original watermark's sizing was verified with a browser automation tool per `model3d-design-overhaul`'s design.md; adjust the stroke approach then if it looks wrong, without needing a spec change.
- [Reusing `cell()` ties the watermark's "stale" cutoff to the heatmap's 5-minute `freshness()` window; if that window ever changes for the heatmap, the watermark silently follows] → Acceptable per the proposal ("the same 5-minute rule the heatmap already uses") — this is the intended single source of truth, not an accidental coupling.
- [`STATUS_COLOUR.green` is not a colour that otherwise appears anywhere in the temperature scale (`core/colours.ts` `TEMPERATURE` stops are blue→pink, no green) — a user could misread "green on the temperature side" as "good temperature" by analogy with the CO2 scale's own green] → Accepted as the explicitly chosen fallback (confirmed with the user); no mitigation beyond what the spec already states (it's a "no data" signal, not a scale value).

## Open Questions

- Exact treatment of `-webkit-text-stroke`'s single colour against the two-colour fill (see Risks) — resolve visually during implementation; does not change the spec, approach, or task breakdown.
