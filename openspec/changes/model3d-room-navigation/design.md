# Design

## Context

See `proposal.md` for the motivation and `specs/model3d/room-navigation/spec.md` for the required behaviour. Facts that shape this design, found by reading `legacy/frontend/logic.js` (read-only reference, never imported):

- Legacy actually contains **two** separate pathfinding implementations. `graph`/`graphEdges`/`findShortestPath` (logic.js:1189-1280) is a proper Dijkstra shortest path over a hand-measured hallway-centerline graph that cannot leave the corridors — but it is dead code, never called. The function wired to the "GO" button, `window.startNavigation` (logic.js:1340+), instead walks a *different*, sparser per-floor waypoint set (`start`/`stairs`/intersection points loaded from `waypoints.gltf`) with a greedy "closest waypoint that reduces remaining distance" heuristic. That greedy heuristic is what produces the reported bugs: for floors where the sparse waypoints don't fully cover a corridor bend, the greedy choice can draw a straight hop that crosses a wall, and it has no guarantee of finding the shortest connected route.
- Legacy's UI (`legacy/frontend/index.html`): a collapsible `#nav-system` panel (desktop: inline, mobile: a drawer opened by a 🧭 toggle button with an overlay) containing a room-search text input with a suggestions dropdown and a "GO" button — re-implemented as `src/ui/navigation.ts` (D4), not copied.
- Legacy always routes from one fixed point — the ground-floor entrance ("Entrance"/groundStart) — to the destination room, crossing floors via a stairway node when needed. There is no live user position; this is route-drawing on a static model, not real-time wayfinding.
- `leoiot-3d/explorer`'s existing architecture (`model3d-building-explorer`): `App` holds `view`/`selected` state and a `render()` that recolours rooms and rebuilds labels; `Viewer` owns the three.js scene, camera, picking and `CSS2DObject` labels; `Controls` is the always-visible button bar (FR-11); room ids map to floors by their first character (`core/rooms.ts`); each floor's `Model` exposes `rooms: Map<id, Mesh[]>` and `centres: Map<id, Vector3>`.

## Goals / Non-Goals

**Goals:**
- A path from the building entrance (or the gym entrance) to any room, matching legacy's own navigation behaviour — the project owner explicitly chose this over a from-scratch, geometrically-guaranteed-correct re-implementation, after that re-implementation went through several iterations (see Decisions below) without producing a route the owner found acceptable, each attempt blocked by this agent's inability to visually verify a 3D route against the real building.
- Visible controls (search + go, clear) restoring the FR-11 behaviour that was lost.
- Routing logic re-implemented fresh in `leoiot-3d/`; routing *data* (legacy's hand-placed waypoints and hallway segments) re-typed from legacy's reference files, not invented.

**Non-Goals:**
- Live user positioning (GPS/AR); routes always start at the entrance, as in legacy.
- Turn-by-turn instructions, voice guidance, or distance/time estimates.
- A shortest-path or provably-wall-free guarantee — see D1; this is a known, accepted trade-off of matching legacy, not an oversight.

## Decisions

### D1: Match legacy's own greedy waypoint walk, not a from-scratch graph search
Three earlier approaches were built and each failed to produce an acceptable result once actually checked:
1. A corridor graph derived purely from the building models' own geometry (floor slab minus rooms minus walls) — provably can't cross a labelled room, but authoring the walls/doorways pass correctly (which material counts as a wall, bridging doors the wall pass over-blocked, placing the entrance/stairs) took several rounds of the project owner reporting a screenshot of something still wrong, each round fixed blind (no way for this agent to render or view the 3D scene directly) and re-checked by the owner.
2. A small hand-placed ring/wing/Aula waypoint graph, built from legacy's own *unused* `graphNodes`/`graphEdges` dead code — systematically checked against every room's real bounding box in this project's models and found to cross real rooms on nearly every floor, not just the one case first reported; abandoned once that was confirmed, not guessed.
3. A revived, bug-fixed version of (1) — still not accepted by the owner, who after repeated iteration asked directly to implement legacy's actual navigation (`window.startNavigation` in `legacy/frontend/logic.js`) rather than continue iterating on a different approach.

This decision implements that request: the exact greedy "always move to the reachable waypoint that most reduces the remaining distance to the destination" algorithm legacy used, over legacy's own hand-placed `start`/`stairs`/intersection waypoints and hallway segments, including its per-room gym special cases (which intersections room `T6`, `T19`, etc. are each allowed to pass through). This is why the spec's "stays within walkable space" and "shortest valid route" requirements were replaced: this algorithm does not guarantee either, and visibly doesn't for at least one room (`T12`) — the same trade-off legacy always had, now explicitly chosen rather than treated as a bug to fix.

### D2: Waypoint and segment data is re-typed from legacy's reference files, not re-derived
`src/nav/legacyData.ts` holds the real coordinates from `legacy/frontend/waypoints.gltf`, `waypoints_t.gltf` and the `segments` array in `legacy/frontend/logic.js` as plain TypeScript data — read as a reference and copied as *data* (the same category of exception already made for the building models themselves, `model3d-building-explorer` D1), not as code. The pathfinding that walks this data (`src/nav/route.ts`) is written fresh, matching legacy's behaviour, not its source.
*Why these coordinates now, after D2 of an earlier version of this document rejected them?* They're legacy's *actual*, validated-in-production waypoint positions (used by the deployed `window.startNavigation`, unlike the unused `graphNodes` graph that approach 2 above turned out to rely on) — real measurements against the model, not a draft that was never wired up.

### D3: Each floor's own start/stairs/intersections; one stairs waypoint for every climb
Each floor (`U`, `E`, `1`, `2`) has its own `start`, `stairs` and named intersections; the gym (`T`) has its own entrance and intersections. A route to a room on another floor always goes via the ground floor's `stairs` waypoint then the target floor's `stairs` waypoint (same x/z on every floor in legacy's own data — one real stair core, not per-wing stairs), then that floor's `start`, then the greedy walk to the door. `App.navigate` switches the displayed floor to the destination's floor as soon as navigation starts (matching legacy, which also switched immediately, not progressively as the path is walked).

### D4: New modules, wired like the existing `Controls`/`App`/`Viewer` split
- `src/nav/legacyData.ts`: the re-typed waypoints and segments (D2).
- `src/nav/route.ts`: the greedy walk (D1), producing an ordered list of world positions; also exports `knownRooms()`.
- `scripts/generate-room-positions.mjs` → `src/nav/room-positions.generated.ts`: each room's real (x, z) centre and each floor's walking height, read from the models — the one piece of this feature still derived from geometry, since legacy's own per-room door-snapping needs a real room centre to snap from.
- `Viewer.showRoute(points)/clearRoute()`: a straight-segment tube (not legacy's smoothed `CatmullRomCurve3` — kept from an earlier iteration since a smoothed curve reads as "vague" and can bow away from the waypoints it's meant to pass through; the project owner did not ask for this part to also match legacy 1:1).
- `src/ui/navigation.ts`: the `Navigation` UI component (search input with filtered suggestions, "Go" and "Clear"), modelled on the existing `Controls`/`InfoPanel` pattern rather than legacy's inline `onclick` HTML attributes.
- `App` gains `navigate(room)`/`clearRoute()`, wiring `Navigation`'s callbacks the same way `Controls`/`panel` are wired, and calling `Viewer.showRoute`/`clearRoute`.

### D5: Only an unknown room is rejected before a route is drawn
A room id that doesn't exist fails fast with a user-visible message. A room that exists but that the greedy walk can't fully reach (`T12`) is *not* separately detected or rejected — matching legacy, which had no such check either; the route is simply drawn as far as the walk gets.

### D6 (superseded by D7 for U/E/1/2): matched legacy's own distance scoring exactly
A first fix tried re-scoring the greedy step by remaining distance to the destination instead of legacy's physical step-distance. It was reverted: the project owner reported it had the *rooms* backwards (`U83` was fine, `U84` was the actual problem), and on closer inspection the real defect wasn't the scoring at all — D1's greedy walk has no concept of which waypoints are actually adjacent, so it can step straight from `start` to `Intersection_two` by raw distance even though `Intersection_one` sits physically between them. No distance-based scoring fixes that; only real adjacency does (D7).

### D7: U/E/1/2 use a real shortest-path search over explicit waypoint adjacency, not the greedy walk
Two attempts to *infer* which waypoints connect — nearest-unconstrained-waypoint (the original D1 walk) and nearest-point-on-a-shared-hallway-segment — each produced at least one real connection wrong when checked (by hand-computing distances, then confirmed against the real building by the project owner). The project owner instead described every direct connection by inspecting `waypoints.gltf` directly (`CORRIDOR_ADJACENCY`/`STAIR_ADJACENCY` in `src/nav/legacyData.ts`). `src/nav/route.ts` builds a graph from exactly those edges — real distances as weights, no inferred ones — and runs Dijkstra from `E_start` to a room's door for every room on `U`/`E`/`1`/`2`. The gym (`T`) is explicitly out of scope for this change and still uses D1's greedy walk with its per-room intersection rules, unchanged.

A room's door isn't one of the described waypoints, so it has to be inserted into the graph: it snaps onto the nearest *real edge* (projected onto the line between two already-connected waypoints), not the nearest node by raw distance — the first version of this snapping step connected a door straight to `U_stairs` because it was physically close, reproducing the exact "jumps over a real waypoint" bug this change exists to fix, just at the last hop instead of a middle one.

This also means D1's "shortest valid route" and "wall-free" limitations (D6 above) no longer apply to the main floors: a real shortest-path search over real edges is both shortest (within the described graph) and can't skip a connection that isn't there. They still apply to the gym.

## Risks / Trade-offs

- [D7 only covers U/E/1/2; the gym still has D1's greedy-walk limitations, including that `T12` never reaches its own door] → explicitly out of scope per the project owner ("let's ignore the gym for now"); revisit the same way (describe its real adjacency) when asked.
- [The greedy walk doesn't guarantee a wall-free or shortest route — the exact bug class this change was originally opened to fix] → accepted explicitly by the project owner after three stricter alternatives were built and rejected, for the gym only now that D7 covers the main floors; `tests/nav-graph.test.ts` tracks the one known incomplete case (`T12`) so a regression that silently creates more is caught.
- [Legacy's data has only one real stair core per floor pair, even though the project owner separately confirmed floor 1 has more than one real staircase] → inherited as-is, per D1; a room on a wing with its own staircase takes a longer route via the one legacy modelled instead of the nearer one, not a wrong route.
- [Re-typing legacy's exact coordinates is a closer dependency on legacy than this project's own rule prefers] → scoped deliberately to *data* (point positions, hallway centrelines — physical facts about the building), never legacy's code; `src/nav/route.ts` is an independent implementation.
