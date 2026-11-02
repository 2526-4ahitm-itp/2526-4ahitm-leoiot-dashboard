// Corridor navigation (spec model3d/room-navigation), re-implemented to match
// legacy's own behaviour: a greedy walk from waypoint to waypoint that always
// gets closer to the destination, snapping to the nearest hallway centreline
// for the room's door, over legacy's own hand-placed waypoints and segments
// (src/nav/legacyData.ts — read-only reference re-typed as data, never
// imported; the pathfinding itself is written fresh here, not copied).

import { floorOf, type FloorId } from '../core/rooms';
import {
  FLOOR_WAYPOINTS,
  GYM_ENTRANCE,
  GYM_INTERSECTIONS,
  SEGMENTS,
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

const PRIORITY_NAMES = ['Intersection_one', 'Intersection_two', 'intersection_three', 'intersection_four', 'intersection_five'];

/** The first hop from a start point: whichever priority intersection gets closer to the destination, if any. */
function firstHop(intersections: Waypoint[], start: { x: number; z: number }, dest: { x: number; z: number }): Waypoint | null {
  const priority = intersections.filter((i) => PRIORITY_NAMES.some((p) => i.name.includes(p)));
  const currentToDest = dist(start, dest);
  for (const i of priority) {
    if (dist(i, dest) < currentToDest) return i;
  }
  return null;
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

function routeOnGroundFloor(endCenter: { x: number; z: number }, doorPoint: { x: number; z: number }, y: number): WorldPoint[] {
  const floor = FLOOR_WAYPOINTS.E!;
  const start = { x: floor.start.x, y, z: floor.start.z };
  const waypoints = buildFloorWaypoints(floor.start, floor.stairs, floor.intersections, y, doorPoint, 'door_ground', true);

  const points: WorldPoint[] = [start];
  const visited = new Set<string>();
  const hop = firstHop(floor.intersections, floor.start, doorPoint);
  let current: { x: number; z: number } = floor.start;
  if (hop) {
    points.push({ x: hop.x, y, z: hop.z });
    visited.add(hop.name);
    current = hop;
  }

  for (;;) {
    const next = pickNext(waypoints, visited, current, doorPoint);
    if (!next) break;
    visited.add(next.name);
    current = next;
    points.push({ x: next.x, y, z: next.z });
    if (next.isDoor) {
      points.push({ x: endCenter.x, y, z: endCenter.z });
      break;
    }
  }

  if (points.length === 1) {
    points.push({ x: doorPoint.x, y, z: doorPoint.z });
    points.push({ x: endCenter.x, y, z: endCenter.z });
  }
  return points;
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

function routeAcrossFloors(
  targetFloor: FloorId,
  endCenter: { x: number; z: number },
  doorPoint: { x: number; z: number },
  groundY: number,
  targetFloorY: number,
): WorldPoint[] {
  const ground = FLOOR_WAYPOINTS.E!;
  const target = FLOOR_WAYPOINTS[targetFloor]!;
  const points: WorldPoint[] = [{ x: ground.start.x, y: groundY, z: ground.start.z }];

  // Phase 1: ground floor, greedy toward the stairs.
  const groundWaypoints = buildFloorWaypoints(ground.start, ground.stairs, ground.intersections, groundY, doorPoint, 'door_ground', true);
  const visited1 = new Set<string>();
  let current: { x: number; z: number } = ground.start;
  while (dist(current, ground.stairs) > 0.1) {
    const next = pickNext(groundWaypoints, visited1, current, ground.stairs);
    if (!next) break;
    visited1.add(next.name);
    current = next;
    points.push({ x: next.x, y: groundY, z: next.z });
  }

  // Climb.
  points.push({ x: ground.stairs.x, y: groundY, z: ground.stairs.z });
  points.push({ x: target.stairs.x, y: targetFloorY, z: target.stairs.z });

  // Phase 2: target floor, always via its start point, then greedy toward the door.
  points.push({ x: target.start.x, y: targetFloorY, z: target.start.z });
  const targetWaypoints = buildFloorWaypoints(target.start, undefined, target.intersections, targetFloorY, doorPoint, 'door_target', true);
  const visited2 = new Set<string>([target.start.name]);
  current = target.start;
  const hop = firstHop(target.intersections, target.start, doorPoint);
  if (hop) {
    points.push({ x: hop.x, y: targetFloorY, z: hop.z });
    visited2.add(hop.name);
    current = hop;
  }

  const beforeLoop = points.length;
  for (;;) {
    const next = pickNext(targetWaypoints, visited2, current, doorPoint);
    if (!next) break;
    visited2.add(next.name);
    current = next;
    points.push({ x: next.x, y: targetFloorY, z: next.z });
    if (next.isDoor) {
      points.push({ x: endCenter.x, y: targetFloorY, z: endCenter.z });
      break;
    }
  }
  if (points.length === beforeLoop) {
    points.push({ x: doorPoint.x, y: targetFloorY, z: doorPoint.z });
    points.push({ x: endCenter.x, y: targetFloorY, z: endCenter.z });
  }
  return points;
}

/** Every room id a navigation route can be drawn to. */
export function knownRooms(): string[] {
  return Object.keys(ROOM_POSITIONS);
}

/** The corridor route from the building entrance to a room, matching legacy's own navigation behaviour. */
export function routeTo(room: string): RouteResult {
  const pos = ROOM_POSITIONS[room];
  if (!pos) return { ok: false, reason: 'unknown-room' };
  const floor = floorOf(room) ?? pos.floor;
  const endCenter = { x: pos.x, z: pos.z };
  const doorPoint = doorPointFor(floor, endCenter);
  const groundY = FLOOR_Y.E;

  if (floor === 'E') return { ok: true, points: routeOnGroundFloor(endCenter, doorPoint, groundY) };
  if (floor === 'T') return { ok: true, points: routeInGym(room, endCenter, doorPoint, FLOOR_Y.T) };
  return { ok: true, points: routeAcrossFloors(floor, endCenter, doorPoint, groundY, FLOOR_Y[floor]) };
}
