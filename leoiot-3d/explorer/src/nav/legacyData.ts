// Corridor waypoints and hallway segments, re-typed from legacy's own
// hand-placed reference data (`legacy/frontend/waypoints.gltf`,
// `legacy/frontend/waypoints_t.gltf` and the `segments` array in
// `legacy/frontend/logic.js` — read-only reference, never imported). These
// are physical facts someone measured against the real building (point
// positions, hallway centrelines), not legacy code; the pathfinding that
// uses them (src/nav/route.ts) is re-implemented, matching legacy's own
// behaviour, not legacy's source.

import type { FloorId } from '../core/rooms';

export interface Waypoint {
  name: string;
  x: number;
  z: number;
}

/** Per-floor start point, stairs point, and named intersections (exact
 * names/casing kept as in the source — some floors use "Intersection_x",
 * others "intersection_x", which matters: the pathfinding's priority check
 * is case-sensitive, the same as legacy's). */
export interface FloorWaypoints {
  start: Waypoint;
  stairs: Waypoint;
  intersections: Waypoint[];
}

const U: FloorWaypoints = {
  start: { name: 'U_start', x: 3.4782865047454834, z: -7.978066444396973 },
  stairs: { name: 'U_stairs', x: -1.8453720808029175, z: -13.099599838256836 },
  intersections: [
    { name: 'U_Intersection_one', x: -13.190995216369629, z: 5.304161071777344 },
    { name: 'U_Intersection_two', x: -41.28909683227539, z: 5.304161071777344 },
    { name: 'U_Intersection_three', x: -41.28909683227539, z: -52.026973724365234 },
    { name: 'U_Intersection_four', x: 16.351804733276367, z: -52.026973724365234 },
    { name: 'U_Intersection_five', x: 16.351804733276367, z: -22.75361442565918 },
  ],
};

const E: FloorWaypoints = {
  start: { name: 'E_start', x: 3.4782865047454834, z: -7.978066444396973 },
  stairs: { name: 'E_stairs', x: -1.8453720808029175, z: -13.099599838256836 },
  intersections: [
    { name: 'E_Intersection_one', x: -11.736422538757324, z: 5.304161071777344 },
    { name: 'E_Intersection_two', x: 17.55052947998047, z: -22.729476928710938 },
    { name: 'E_intersection_three', x: 27.582738876342773, z: -22.729476928710938 },
    { name: 'E_intersection_four', x: 38.71512985229492, z: -22.729476928710938 },
    { name: 'E_intersection_five', x: 52.764888763427734, z: -22.729476928710938 },
  ],
};

const F1: FloorWaypoints = {
  start: { name: '1_start', x: 3.4782865047454834, z: -7.978066444396973 },
  stairs: { name: '1_stairs', x: -1.8453720808029175, z: -13.099599838256836 },
  intersections: [
    { name: '1_Intersection_one', x: -11.535295486450195, z: 5.304161071777344 },
    { name: '1_Intersection_two', x: 16.477096557617188, z: -22.35126495361328 },
    { name: '1_intersection_three', x: 27.582738876342773, z: -22.729476928710938 },
    { name: '1_intersection_four', x: 38.71512985229492, z: -22.729476928710938 },
    { name: '1_intersection_five', x: 52.764888763427734, z: -22.729476928710938 },
  ],
};

const F2: FloorWaypoints = {
  start: { name: '2_start', x: 3.4782865047454834, z: -7.978066444396973 },
  stairs: { name: '2_stairs', x: -1.8453720808029175, z: -13.099599838256836 },
  intersections: [
    { name: '2_Intersection_one', x: -11.535295486450195, z: 5.304161071777344 },
    { name: '2_Intersection_two', x: 16.477096557617188, z: -22.35126495361328 },
    { name: '2_intersection_three', x: 27.582738876342773, z: -22.729476928710938 },
    { name: '2_intersection_four', x: 38.71512985229492, z: -22.729476928710938 },
    { name: '2_intersection_five', x: 52.764888763427734, z: -22.729476928710938 },
  ],
};

export const FLOOR_WAYPOINTS: Partial<Record<FloorId, FloorWaypoints>> = { U, E, '1': F1, '2': F2 };

/**
 * Which waypoints directly connect to which, within a floor — described
 * explicitly by the project owner from inspecting `waypoints.gltf` directly,
 * after two earlier attempts to infer this (nearest-unconstrained-waypoint,
 * then proximity-to-hallway-segment) each got at least one real connection
 * wrong. Every pair is walkable both directions. U's intersections form a
 * full ring (`start` branches to both ends); E/1/2 have `start` branching to
 * `Intersection_one` and `Intersection_two` separately, with `two` then
 * chaining on to `three`/`four`/`five`.
 */
export const CORRIDOR_ADJACENCY: Array<[string, string]> = [
  // U (basement)
  [U.intersections[0].name, U.intersections[1].name],
  [U.intersections[0].name, U.start.name],
  [U.intersections[1].name, U.intersections[2].name],
  [U.intersections[2].name, U.intersections[3].name],
  [U.intersections[3].name, U.intersections[4].name],
  [U.intersections[4].name, U.start.name],
  [U.start.name, U.stairs.name],
  // E (ground floor)
  [E.stairs.name, E.start.name],
  [E.start.name, E.intersections[0].name],
  [E.start.name, E.intersections[1].name],
  [E.intersections[1].name, E.intersections[2].name],
  [E.intersections[2].name, E.intersections[3].name],
  [E.intersections[3].name, E.intersections[4].name],
  // Floor 1
  [F1.stairs.name, F1.start.name],
  [F1.start.name, F1.intersections[0].name],
  [F1.start.name, F1.intersections[1].name],
  [F1.intersections[1].name, F1.intersections[2].name],
  [F1.intersections[2].name, F1.intersections[3].name],
  [F1.intersections[3].name, F1.intersections[4].name],
  // Floor 2
  [F2.stairs.name, F2.start.name],
  [F2.start.name, F2.intersections[0].name],
  [F2.start.name, F2.intersections[1].name],
  [F2.intersections[1].name, F2.intersections[2].name],
  [F2.intersections[2].name, F2.intersections[3].name],
  [F2.intersections[3].name, F2.intersections[4].name],
];

/** Cross-floor stairway connections: the same (x, z) on every floor, only the height differs. */
export const STAIR_ADJACENCY: Array<[FloorId, FloorId]> = [
  ['U', 'E'],
  ['E', '1'],
  ['1', '2'],
];

export const GYM_ENTRANCE: Waypoint = { name: 'T_entrance', x: -41.442623138427734, z: 3.064432382583618 };
export const GYM_INTERSECTIONS: Waypoint[] = [
  { name: 'T_intersection_one', x: -27.68085479736328, z: 3.064432382583618 },
  { name: 'T_intersection_two', x: -4.422519683837891, z: 3.064432382583618 },
  { name: 'T_intersection_three', x: 4.158327102661133, z: 3.064432382583618 },
  { name: 'T_intersection_four', x: 28.12099266052246, z: 3.064432382583618 },
  { name: 'T_intersection_six', x: -32.90348815917969, z: -6.062680244445801 },
  { name: 'T_intersection_seven', x: -4.422519683837891, z: -5.384678363800049 },
  { name: 'T_intersection_eight', x: -0.6097948551177979, z: -5.384678363800049 },
  { name: 'T_intersection_nine', x: 28.538820266723633, z: -12.597213745117188 },
  { name: 'T_intersection_ten', x: 4.428435325622559, z: -12.597213745117188 },
  { name: 'T_intersection_eleven', x: -4.871358871459961, z: -12.597213745117188 },
  { name: 'T_intersection_twelve', x: -28.123226165771484, z: -12.597213745117188 },
  { name: 'T_intersection_thirteen', x: -28.16862678527832, z: -5.384678363800049 },
];

export type SegmentScope = 'all' | 'upper' | 'U' | 'T';

export interface Segment {
  id: string;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
  type: 'H' | 'V';
  floors: SegmentScope;
}

/** Hallway centrelines, used only to snap a room's centre to the nearest point
 * on the corridor it actually opens onto (its "door point"). */
export const SEGMENTS: Segment[] = [
  // Ring (courtyard perimeter) — every floor
  { id: 'RingN', x1: -11.15, x2: 16.2, z1: -13.9, z2: -13.9, type: 'H', floors: 'all' },
  { id: 'RingS', x1: -11.15, x2: 16.2, z1: 5.1, z2: 5.1, type: 'H', floors: 'all' },
  { id: 'RingW', x1: -11.15, x2: -11.15, z1: -13.9, z2: 5.1, type: 'V', floors: 'all' },
  { id: 'RingE', x1: 16.2, x2: 16.2, z1: -13.9, z2: 5.1, type: 'V', floors: 'all' },
  // Wing corridors — every floor
  { id: 'WestW', x1: -70.0, x2: -11.15, z1: 5.1, z2: 5.1, type: 'H', floors: 'all' },
  { id: 'EastW', x1: 16.2, x2: 70.0, z1: -13.9, z2: -13.9, type: 'H', floors: 'all' },
  { id: 'NorthW', x1: 16.2, x2: 16.2, z1: -70.0, z2: -13.9, type: 'V', floors: 'all' },
  { id: 'South1', x1: -11.15, x2: -11.15, z1: 5.1, z2: 70.0, type: 'V', floors: 'all' },
  { id: 'South2', x1: 16.2, x2: 16.2, z1: 5.1, z2: 70.0, type: 'V', floors: 'all' },
  // Aula cross corridors — upper floors (ground + 1F + 2F; not basement, not gym)
  { id: 'AulaEW', x1: -11.15, x2: 16.2, z1: -4.4, z2: -4.4, type: 'H', floors: 'upper' },
  { id: 'AulaNS', x1: 5.5, x2: 5.5, z1: -13.9, z2: 5.1, type: 'V', floors: 'upper' },
  // Basement-only north extension
  { id: 'U_WestN', x1: -41.45, x2: -41.45, z1: -51.0, z2: 5.1, type: 'V', floors: 'U' },
  { id: 'U_TopH', x1: -57.9, x2: 16.2, z1: -52.0, z2: -52.0, type: 'H', floors: 'U' },
  // Gym corridor
  { id: 'GymHall', x1: -41.44, x2: 28.12, z1: 3.06, z2: 3.06, type: 'H', floors: 'T' },
];
