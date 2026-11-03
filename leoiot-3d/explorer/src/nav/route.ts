// Corridor navigation (spec model3d/room-navigation). The gym (T) still
// matches legacy's own greedy-walk behaviour (src/nav/legacyData.ts —
// read-only reference re-typed as data, never imported). The main floors
// (U/E/1/2) instead do a real shortest-path search over an explicit
// waypoint adjacency graph described directly by the project owner from
// `waypoints.gltf` — two earlier attempts to *infer* which waypoints
// connect (nearest-unconstrained-waypoint, then proximity-to-hallway-segment)
// each produced at least one real connection wrong, including routes that
// skipped a real intermediate waypoint entirely.

import { floorOf, type FloorId } from '../core/rooms';
import {
  CORRIDOR_ADJACENCY,
  FLOOR_WAYPOINTS,
  GYM_ENTRANCE,
  GYM_INTERSECTIONS,
  SEGMENTS,
  STAIR_ADJACENCY,
  type Segment,
  type Waypoint,
} from './legacyData';
import { FLOOR_Y, ROOM_POSITIONS } from './room-positions.generated';

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export type RouteResult = { ok: true; points: WorldPoint[] } | { ok: false; reason: 'unknown-room' };

interface RouteWaypoint extends Waypoint {
  y: number;
  isDoor?: boolean;
  isHallway?: boolean;
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function segmentScopeMatches(seg: Segment, floor: FloorId): boolean {
  if (seg.floors === 'all') return true;
  if (seg.floors === 'upper') return floor !== 'U' && floor !== 'T';
  if (seg.floors === 'U') return floor === 'U';
  if (seg.floors === 'T') return floor === 'T';
  return false;
}

/** Snaps a room's centre to the nearest point on the hallway centreline it actually opens onto. */
function doorPointFor(floor: FloorId, endCenter: { x: number; z: number }): { x: number; z: number } {
  const activeSegs = SEGMENTS.filter((s) => segmentScopeMatches(s, floor));
  let minDist = Infinity;
  let point = { x: 0, z: 0 };
  for (const seg of activeSegs) {
    let px: number, pz: number;
    if (seg.type === 'H') {
      const xMin = Math.min(seg.x1, seg.x2), xMax = Math.max(seg.x1, seg.x2);
      px = Math.max(xMin, Math.min(xMax, endCenter.x));
      pz = seg.z1;
    } else {
      const zMin = Math.min(seg.z1, seg.z2), zMax = Math.max(seg.z1, seg.z2);
      px = seg.x1;
      pz = Math.max(zMin, Math.min(zMax, endCenter.z));
    }
    const d = dist(endCenter, { x: px, z: pz });
    if (d < minDist) {
      minDist = d;
      point = { x: px, z: pz };
    }
  }
  return point;
}

/** One greedy step: among the unvisited waypoints that get closer to `dest`, the nearest one. */
function pickNext(
  waypoints: RouteWaypoint[],
  visited: Set<string>,
  current: { x: number; z: number },
  dest: { x: number; z: number },
  filter?: (wp: RouteWaypoint) => boolean,
): RouteWaypoint | null {
  let best: RouteWaypoint | null = null;
  let bestScore = Infinity;
  const currentToDest = dist(current, dest);
  for (const wp of waypoints) {
    if (visited.has(wp.name)) continue;
    if (filter && !filter(wp)) continue;
    const remaining = dist(wp, dest);
    if (remaining >= currentToDest) continue;
    const distToWP = dist(wp, current);
    if (distToWP < bestScore) {
      bestScore = distToWP;
      best = wp;
    }
  }
  return best;
}

function buildFloorWaypoints(
  start: Waypoint | undefined,
  stairs: Waypoint | undefined,
  intersections: Waypoint[],
  y: number,
  doorPoint: { x: number; z: number },
  doorName: string,
  includeStart: boolean,
): RouteWaypoint[] {
  const out: RouteWaypoint[] = [];
  if (start && includeStart) out.push({ ...start, y });
  for (const i of intersections) out.push({ ...i, y, isHallway: true });
  if (stairs) out.push({ ...stairs, y, isHallway: true });
  out.push({ name: doorName, x: doorPoint.x, y, z: doorPoint.z, isDoor: true });
  return out;
}

// --- Main floors (U/E/1/2): real shortest-path search over the explicit ---
// --- waypoint adjacency graph (CORRIDOR_ADJACENCY/STAIR_ADJACENCY). -------

const CLIMB_COST = 8;

interface GraphNode {
  floor: FloorId;
  name: string;
  x: number;
  z: number;
}

const MAIN_FLOORS: FloorId[] = ['U', 'E', '1', '2'];

function buildGraph(): { nodes: Map<string, GraphNode>; edges: Map<string, Map<string, number>> } {
  const nodes = new Map<string, GraphNode>();
  for (const floor of MAIN_FLOORS) {
    const fw = FLOOR_WAYPOINTS[floor]!;
    for (const wp of [fw.start, fw.stairs, ...fw.intersections]) nodes.set(wp.name, { floor, name: wp.name, x: wp.x, z: wp.z });
  }
  const edges = new Map<string, Map<string, number>>();
  function addEdge(a: string, b: string, cost: number): void {
    if (!nodes.has(a) || !nodes.has(b)) return;
    if (!edges.has(a)) edges.set(a, new Map());
    if (!edges.has(b)) edges.set(b, new Map());
    edges.get(a)!.set(b, cost);
    edges.get(b)!.set(a, cost);
  }
  for (const [a, b] of CORRIDOR_ADJACENCY) addEdge(a, b, dist(nodes.get(a)!, nodes.get(b)!));
  for (const [lo, hi] of STAIR_ADJACENCY) {
    const a = FLOOR_WAYPOINTS[lo]!.stairs, b = FLOOR_WAYPOINTS[hi]!.stairs;
    addEdge(a.name, b.name, dist(a, b) + CLIMB_COST);
  }
  return { nodes, edges };
}

const GRAPH = buildGraph();
const DOOR_NODE = '__door__';

/** Dijkstra from a named graph node to a room's door, snapped onto its two nearest graph nodes on its own floor. */
/** Nearest point on the segment a-b to p, clamped to the segment, with that point and its distance. */
function projectOntoLine(
  p: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
): { point: { x: number; z: number }; distance: number } {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, z: a.z + t * dz };
  return { point, distance: dist(p, point) };
}

function shortestPathToDoor(startName: string, doorPoint: { x: number; z: number }, doorFloor: FloorId): GraphNode[] | null {
  const nodes = new Map(GRAPH.nodes);
  nodes.set(DOOR_NODE, { floor: doorFloor, name: DOOR_NODE, x: doorPoint.x, z: doorPoint.z });
  const edges = new Map<string, Map<string, number>>();
  for (const [k, m] of GRAPH.edges) edges.set(k, new Map(m));

  // Snap the door onto the nearest *real* corridor edge on its floor, at the point where
  // it actually meets that edge — not by connecting it directly to both of the edge's
  // endpoints at their raw straight-line distance. That previously left a shortcut: going
  // straight from an endpoint to the door is always at least as short as going the long
  // way around via the other endpoint first (triangle inequality), so Dijkstra could skip
  // the real intermediate waypoint entirely and cut across open space to reach it (the
  // U85/U86 defect — the door connected straight to Intersection_two, skipping
  // Intersection_three, even though Intersection_three was "the nearer edge endpoint").
  let nearestEdge: [GraphNode, GraphNode] | null = null;
  let nearestEdgeDist = Infinity;
  let nearestProjection: { x: number; z: number } | null = null;
  const seen = new Set<string>();
  for (const [a, neighbours] of GRAPH.edges) {
    const nodeA = nodes.get(a);
    if (!nodeA || nodeA.floor !== doorFloor) continue;
    for (const b of neighbours.keys()) {
      const pairKey = [a, b].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const nodeB = nodes.get(b);
      if (!nodeB || nodeB.floor !== doorFloor) continue;
      const { point, distance } = projectOntoLine(doorPoint, nodeA, nodeB);
      if (distance < nearestEdgeDist) {
        nearestEdgeDist = distance;
        nearestEdge = [nodeA, nodeB];
        nearestProjection = point;
      }
    }
  }

  edges.set(DOOR_NODE, new Map());
  function connect(a: string, b: string, cost: number): void {
    if (!edges.has(a)) edges.set(a, new Map());
    if (!edges.has(b)) edges.set(b, new Map());
    edges.get(a)!.set(b, cost);
    edges.get(b)!.set(a, cost);
  }
  if (nearestEdge && nearestProjection) {
    const [a, b] = nearestEdge;
    const APPROACH_NODE = '__approach__';
    nodes.set(APPROACH_NODE, { floor: doorFloor, name: APPROACH_NODE, x: nearestProjection.x, z: nearestProjection.z });
    connect(APPROACH_NODE, a.name, dist(nearestProjection, a));
    connect(APPROACH_NODE, b.name, dist(nearestProjection, b));
    connect(APPROACH_NODE, DOOR_NODE, nearestEdgeDist);
  } else {
    const endpoints = [...nodes.values()].filter((n) => n.floor === doorFloor).sort((x, y) => dist(doorPoint, x) - dist(doorPoint, y)).slice(0, 2);
    for (const n of endpoints) connect(DOOR_NODE, n.name, dist(doorPoint, n));
  }

  const distTo = new Map<string, number>([[startName, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  for (;;) {
    let u: string | null = null, best = Infinity;
    for (const [name, d] of distTo) {
      if (!visited.has(name) && d < best) { best = d; u = name; }
    }
    if (u === null || u === DOOR_NODE) break;
    visited.add(u);
    for (const [v, cost] of edges.get(u) ?? []) {
      const alt = best + cost;
      if (alt < (distTo.get(v) ?? Infinity)) {
        distTo.set(v, alt);
        prev.set(v, u);
      }
    }
  }
  if (!distTo.has(DOOR_NODE)) return null;
  const names: string[] = [DOOR_NODE];
  let cur = DOOR_NODE;
  while (cur !== startName) {
    const p = prev.get(cur);
    if (!p) return null;
    names.push(p);
    cur = p;
  }
  names.reverse();
  return names.map((n) => nodes.get(n)!);
}

function routeOnMainFloors(floor: FloorId, endCenter: { x: number; z: number }): WorldPoint[] {
  const startName = FLOOR_WAYPOINTS.E!.start.name;
  // Snap directly onto the room's own centre, not `doorPointFor`'s point on
  // legacy's hand-picked SEGMENTS list — that list has no line near the
  // corridor spur serving rooms like 228-231 (z ≈ -22.7), so it projected
  // them onto the ring corridor instead, right next to a *different* room's
  // own door (the reported defect: route to 231 visited 228's door first,
  // and 230 visited 229's). shortestPathToDoor's own edge-projection against
  // the real CORRIDOR_ADJACENCY graph already finds the correct nearby
  // corridor point; routing to the room's centre directly lets it do that
  // instead of first visiting a wrong, pre-computed point.
  const path = shortestPathToDoor(startName, endCenter, floor);
  if (!path) {
    // Shouldn't happen — the graph is fully connected — but never draw nothing.
    const start = FLOOR_WAYPOINTS.E!.start;
    return [
      { x: start.x, y: FLOOR_Y.E, z: start.z },
      { x: endCenter.x, y: FLOOR_Y[floor], z: endCenter.z },
    ];
  }
  return path.map((n): WorldPoint => ({ x: n.x, y: FLOOR_Y[n.floor], z: n.z }));
}

// Legacy's hand-tuned gym routing: which intersections are even considered
// depends on the destination room and, for a couple of rooms, on which
// intersection was visited immediately before — kept exactly as it was.
function gymIntersectionAllowed(wp: RouteWaypoint, room: string, lastName: string | null): boolean {
  if (/intersection_one/i.test(lastName ?? '')) {
    if (room !== 'T19' && !/intersection_(two|three|thirteen)/i.test(wp.name)) return false;
  }
  if (/intersection_(eleven|twelve)/i.test(wp.name) && room !== 'T4') return false;
  if (/intersection_(nine|ten)/i.test(wp.name) && room !== 'T1') return false;
  if (/intersection_thirteen/i.test(wp.name) && room !== 'T6' && room !== 'T3' && room !== 'T4') return false;
  if (/intersection_seven/i.test(wp.name) && room !== 'T11' && room !== 'T10' && room !== 'T13') return false;
  if (/intersection_eight/i.test(wp.name) && room !== 'T10' && room !== 'T13') return false;
  if (/intersection_six/i.test(wp.name) && room !== 'T6') return false;
  return true;
}

function routeInGym(room: string, endCenter: { x: number; z: number }, doorPoint: { x: number; z: number }, y: number): WorldPoint[] {
  const waypoints = buildFloorWaypoints(GYM_ENTRANCE, undefined, GYM_INTERSECTIONS, y, doorPoint, 'door_gym', true);
  const points: WorldPoint[] = [{ x: GYM_ENTRANCE.x, y, z: GYM_ENTRANCE.z }];
  const visited = new Set<string>([GYM_ENTRANCE.name]);
  let current: { x: number; z: number } = GYM_ENTRANCE;
  let lastName: string | null = GYM_ENTRANCE.name;

  if (room !== 'T2') {
    const intOne = GYM_INTERSECTIONS.find((i) => i.name.toLowerCase().includes('intersection_one'));
    if (intOne) points.push({ x: intOne.x, y, z: intOne.z });
  }
  if (room === 'T6') {
    const intThirteen = GYM_INTERSECTIONS.find((i) => /intersection_thirteen/i.test(i.name));
    if (intThirteen) {
      points.push({ x: intThirteen.x, y, z: intThirteen.z });
      visited.add(intThirteen.name);
      current = intThirteen;
      lastName = intThirteen.name;
    }
  }

  for (;;) {
    if (lastName && /intersection_(nine|ten|eleven|twelve)/i.test(lastName)) {
      points.push({ x: doorPoint.x, y, z: doorPoint.z });
      points.push({ x: endCenter.x, y, z: endCenter.z });
      break;
    }
    const next = pickNext(waypoints, visited, current, doorPoint, (wp) => gymIntersectionAllowed(wp, room, lastName));
    if (!next) break;
    visited.add(next.name);
    current = next;
    lastName = next.name;
    points.push({ x: next.x, y, z: next.z });
    if (next.isDoor) {
      points.push({ x: endCenter.x, y, z: endCenter.z });
      break;
    }
  }

  if (points.length <= 1) {
    points.push({ x: doorPoint.x, y, z: doorPoint.z });
    points.push({ x: endCenter.x, y, z: endCenter.z });
  }
  return points;
}

/** Every room id a navigation route can be drawn to. */
export function knownRooms(): string[] {
  return Object.keys(ROOM_POSITIONS);
}

/** The corridor route from the building entrance to a room. */
export function routeTo(room: string): RouteResult {
  const pos = ROOM_POSITIONS[room];
  if (!pos) return { ok: false, reason: 'unknown-room' };
  const floor = floorOf(room) ?? pos.floor;
  const endCenter = { x: pos.x, z: pos.z };

  // The gym still uses legacy's own hand-tuned, SEGMENTS-based door point and
  // greedy walk (intentionally out of scope for this fix — see route.ts top
  // comment); the main floors route straight to the room's centre instead.
  if (floor === 'T') return { ok: true, points: routeInGym(room, endCenter, doorPointFor(floor, endCenter), FLOOR_Y.T) };
  return { ok: true, points: routeOnMainFloors(floor, endCenter) };
}
