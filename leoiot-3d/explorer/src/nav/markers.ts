// Visual cues along a route: a left/right marker where the corridor bends
// enough to matter, and an up/down marker where the route crosses to another
// floor via the stairs (spec model3d/room-navigation). Each marker is shown
// as a small coloured dot on the route itself, with the same-coloured
// explanation in a side legend — `pointIndex` orders them along the route so
// the legend lists them, and colours them, in the order you'd walk past them.

import { FLOOR_ORDER, type FloorId } from '../core/rooms';
import type { RoutePoint } from './route';

export type TurnDirection = 'left' | 'right';
export type StairDirection = 'up' | 'down';

export interface TurnMarker {
  readonly kind: 'turn';
  readonly direction: TurnDirection;
  readonly point: RoutePoint;
  /** Index of `point` in the route's own point list, for ordering/colouring markers along the route. */
  readonly pointIndex: number;
}

export interface StairMarker {
  readonly kind: 'stairs';
  readonly direction: StairDirection;
  readonly point: RoutePoint;
  /** The floor the stairs lead to. */
  readonly toFloor: FloorId;
  readonly pointIndex: number;
}

export type RouteMarker = TurnMarker | StairMarker;

// Below this angle (degrees) between the incoming and outgoing direction, a bend is too gentle to call out.
const TURN_THRESHOLD_DEG = 25;

function angleBetweenDeg(ax: number, az: number, bx: number, bz: number): number {
  const magA = Math.hypot(ax, az), magB = Math.hypot(bx, bz);
  if (magA === 0 || magB === 0) return 0;
  const cos = (ax * bx + az * bz) / (magA * magB);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * A left/right marker at every interior point where the corridor bends by
 * more than a small threshold, within a single floor — a floor change is a
 * stairs marker instead (see {@link stairMarkers}), never a turn.
 *
 * Direction is relative to the walker, not the screen: with "in" the
 * incoming and "out" the outgoing direction and "up" = +Y, the walker's own
 * right-hand direction is `in × up`, so `out` has turned right exactly when
 * `dot(out, in × up) > 0` — which works out to `inX·outZ − inZ·outX > 0`.
 */
export function turnMarkers(points: readonly RoutePoint[]): TurnMarker[] {
  const out: TurnMarker[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], cur = points[i], next = points[i + 1];
    if (prev.floor !== cur.floor || cur.floor !== next.floor) continue;
    const inX = cur.x - prev.x, inZ = cur.z - prev.z;
    const outX = next.x - cur.x, outZ = next.z - cur.z;
    if (angleBetweenDeg(inX, inZ, outX, outZ) < TURN_THRESHOLD_DEG) continue;
    const cross = inX * outZ - inZ * outX;
    out.push({ kind: 'turn', direction: cross > 0 ? 'right' : 'left', point: cur, pointIndex: i });
  }
  return out;
}

/** An up/down marker at every point where the route crosses from one floor to the next. */
export function stairMarkers(points: readonly RoutePoint[]): StairMarker[] {
  const out: StairMarker[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const cur = points[i], next = points[i + 1];
    if (cur.floor === next.floor) continue;
    const fromIdx = FLOOR_ORDER.indexOf(cur.floor as (typeof FLOOR_ORDER)[number]);
    const toIdx = FLOOR_ORDER.indexOf(next.floor as (typeof FLOOR_ORDER)[number]);
    if (fromIdx === -1 || toIdx === -1) continue; // the gym has no floor crossing
    out.push({ kind: 'stairs', direction: toIdx < fromIdx ? 'up' : 'down', point: cur, toFloor: next.floor, pointIndex: i });
  }
  return out;
}

/** All markers of a route, in the order you'd walk past them. */
export function routeMarkers(points: readonly RoutePoint[]): RouteMarker[] {
  return [...turnMarkers(points), ...stairMarkers(points)].sort((a, b) => a.pointIndex - b.pointIndex);
}

// A categorical palette distinct from the route's own colour (`#2ecc71` in
// `scene/viewer.ts`), cycled by position along the route.
const MARKER_COLOURS = ['#3498db', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#f1c40f', '#e84393', '#74b9ff'];

/** The colour a marker is drawn in, stable for a given position along the route. */
export function markerColour(index: number): string {
  return MARKER_COLOURS[index % MARKER_COLOURS.length];
}
