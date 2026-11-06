# Proposal

## Why

Switching floors in the explorer only works by clicking one of the always-visible floor buttons. A keyboard shortcut for the same action — the up/down arrow keys — makes moving through the building faster for anyone using a keyboard, and is a near-zero-cost addition given the floor buttons already encode a single, obvious top-to-bottom order.

## What Changes

- ↑/↓ move one floor up/down, in the same top-to-bottom order as the floor buttons (Floor 2 → Floor 1 → Ground floor → Basement).
- The whole-building view (the start/"Reset View" state) is connected to the top of that order: ArrowDown from it enters Floor 2, the top floor, instead of doing nothing. Pressing ArrowUp at Floor 2, or at the whole-building view, is a no-op (already at the top).
- Pressing ArrowDown at Basement (the bottom) is a no-op (already at the bottom).
- The gym view is not part of this order (it is a separate wing, not stacked with the floors) — the arrow keys do nothing while it's shown.
- The arrow keys are ignored while focus is in a text input (the room-search box), so they don't fight with normal text-field behaviour.
- Not in this change: any other keyboard shortcut (heatmap toggle, reset, navigation), and no visible change to the floor buttons themselves.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None in `openspec/specs/`. The requirement this change adds — keyboard floor switching — belongs to `model3d/building-viewer`, whose requirements are still in the open change `model3d-building-explorer` and not yet merged into the spec tree. That change's delta spec (`openspec/changes/model3d-building-explorer/specs/model3d/building-viewer/spec.md`) is edited directly as part of this pull request to add the new requirement, the same way `pv-sonnenjahr-kiosk` amended the still-open `pv-main-kiosk` delta, and `model3d-navigation-fine-tune` amended the still-open `model3d-room-navigation` delta.

## Impact

- `leoiot-3d/explorer/src/app.ts`: a `keydown` listener on `window`, reusing `App.setView` (no new state, no change to any existing method's signature).
- `leoiot-3d/explorer/src/ui/controls.ts`: exports its existing `FLOOR_BUTTONS` order (top to bottom) instead of keeping it module-private, so `app.ts` reuses the exact same order the floor buttons already use — one source of truth, not a second copy.
- `openspec/changes/model3d-building-explorer/specs/model3d/building-viewer/spec.md`: one new ADDED requirement for the keyboard shortcut.
- No change to the `platform` data contract, `leoiot-sensors/`, or `leoiot-pv/`.
