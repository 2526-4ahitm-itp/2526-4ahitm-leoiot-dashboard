# Proposal

## Why

The explorer's structure (walls, roof, floor slabs) is opaque, so a drawn route is mostly hidden from the default camera angle once it runs under the building's own roof — an earlier attempt to fix this by fading the structure itself was tried and reverted (it didn't look good). Without seeing the route directly, the explorer needs another way to say "go this way": markers at the turns and stairs, and a view that starts where the route starts and walks forward with it, rather than jumping straight to the destination and leaving everything in between invisible.

## What Changes

- Navigating to a room now shows the floor the route *starts* on (the ground floor, or the gym for a gym room) instead of jumping straight to the destination's floor.
- For a route that crosses more than one floor, only the portion on floors already shown is drawn — the current floor and everything beneath it, the same stacking rule the floor views already use — and a new "Next floor ↑" control (in the navigation panel, next to "Clear") advances to the route's next floor, revealing that floor's segment. The control disappears once the destination's own floor is reached.
- A small coloured dot marks every point the route's corridor bends enough to matter, or crosses to another floor, directly on the route itself — not offset from it. A fixed legend on the right lists the same-coloured explanation for each ("Left"/"Right", or "up"/"down" naming the floor the stairs lead to), so it's never ambiguous which dot a legend row is about even when several sit close together. Only markers for floors currently on screen are shown, consistent with the progressive floor reveal above, and a marker keeps its colour as more of the route is revealed.
- The existing up/down arrow-key floor switching (`model3d-floor-arrow-keys`) and the floor buttons both work exactly as before, and now also correctly reveal/hide a route's segments as they move between floors, since route display is driven by whichever floor is currently shown, however it got there.
- Not in this change: any attempt to make the structure itself see-through again, the shape/colour of the route tube, or the corridor waypoint graph.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None in `openspec/specs/`. The requirements this change adds or changes — which floor navigation starts on, the progressive multi-floor reveal with its "next floor" control, and the turn/stairs markers — belong to `model3d/room-navigation`, whose requirements are still in the open change `model3d-room-navigation` and not yet merged into the spec tree. That change's delta spec (`openspec/changes/model3d-room-navigation/specs/model3d/room-navigation/spec.md`) is edited directly as part of this pull request — including rewording its existing "Multi-floor navigation crosses at a stairway" requirement, which previously said the view switches to the *destination's* floor; that's no longer true — the same way `pv-sonnenjahr-kiosk` amended the still-open `pv-main-kiosk` delta.

## Impact

- `leoiot-3d/explorer/src/nav/route.ts`: route points are now tagged with the floor they're on (`RoutePoint`); new `routeFloors` (the ordered floor sequence of a route) and `isFloorVisible`/`visibleRoutePoints` (which floors, and which points, are on screen for a given view).
- `leoiot-3d/explorer/src/nav/markers.ts` (new): pure functions computing turn and stairs markers from a route's points, each ordered by its position along the route (`pointIndex`) and coloured from a small fixed palette (`routeMarkers`, `markerColour`).
- `leoiot-3d/explorer/src/ui/routeLegend.ts` (new): `RouteLegend`, a fixed right-hand panel listing the active route's markers, coloured to match their dots.
- `leoiot-3d/explorer/src/core/rooms.ts`: `FLOOR_ORDER`, the floor buttons' top-to-bottom order, now lives here as the one shared source of truth (previously duplicated between `ui/controls.ts` and `app.ts`).
- `leoiot-3d/explorer/src/app.ts`: tracks the active route and its floor sequence; starts navigation on the route's first floor; `render()` now also draws the currently-visible portion of the route, a coloured dot at each visible marker, and the matching legend, and shows/hides the "next floor" control.
- `leoiot-3d/explorer/src/main.ts`: wires up `RouteLegend` alongside the other UI pieces.
- `leoiot-3d/explorer/src/ui/navigation.ts`, `src/ui/strings.ts`, `src/ui/styles.css`: the "Next floor" button, the route-dot style, and the legend's own styles.
- `openspec/changes/model3d-room-navigation/specs/model3d/room-navigation/spec.md`: requirement changes described above.
- No change to the `platform` data contract, `leoiot-sensors/`, or `leoiot-pv/`.
