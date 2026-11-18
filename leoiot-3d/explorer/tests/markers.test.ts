import { describe, expect, it } from 'vitest';
import { markerColour, routeMarkers, stairMarkers, turnMarkers } from '../src/nav/markers';
import type { RoutePoint } from '../src/nav/route';

function p(x: number, z: number, floor: RoutePoint['floor'] = 'E'): RoutePoint {
  return { x, y: 0, z, floor };
}

describe('turnMarkers', () => {
  it('walking +X then turning to walk +Z is a right turn', () => {
    const points = [p(-1, 0), p(0, 0), p(0, 1)];
    expect(turnMarkers(points)).toEqual([{ kind: 'turn', direction: 'right', point: points[1], pointIndex: 1 }]);
  });

  it('walking +X then turning to walk -Z is a left turn', () => {
    const points = [p(-1, 0), p(0, 0), p(0, -1)];
    expect(turnMarkers(points)).toEqual([{ kind: 'turn', direction: 'left', point: points[1], pointIndex: 1 }]);
  });

  it('a gentle bend below the threshold is not a turn', () => {
    const points = [p(-10, 0), p(0, 0), p(10, 0.5)];
    expect(turnMarkers(points)).toEqual([]);
  });

  it('continuing straight is not a turn', () => {
    const points = [p(-1, 0), p(0, 0), p(1, 0)];
    expect(turnMarkers(points)).toEqual([]);
  });

  it('a floor change at the bend is a stairs marker, not a turn', () => {
    const points = [p(-1, 0, 'E'), p(0, 0, 'E'), p(0, 1, '1')];
    expect(turnMarkers(points)).toEqual([]);
  });
});

describe('stairMarkers', () => {
  it('marks climbing from the ground floor to floor 1 as up', () => {
    const points = [p(0, 0, 'E'), p(0, 0, '1'), p(5, 0, '1')];
    expect(stairMarkers(points)).toEqual([{ kind: 'stairs', direction: 'up', point: points[0], toFloor: '1', pointIndex: 0 }]);
  });

  it('marks descending from floor 2 to floor 1 as down', () => {
    const points = [p(0, 0, '2'), p(0, 0, '1'), p(5, 0, '1')];
    expect(stairMarkers(points)).toEqual([{ kind: 'stairs', direction: 'down', point: points[0], toFloor: '1', pointIndex: 0 }]);
  });

  it('a route that stays on one floor has no stairs markers', () => {
    const points = [p(0, 0, 'E'), p(5, 0, 'E'), p(10, 0, 'E')];
    expect(stairMarkers(points)).toEqual([]);
  });

  it('the gym has no stairs markers even though it is a FloorId', () => {
    const points = [p(0, 0, 'T'), p(5, 0, 'T')];
    expect(stairMarkers(points)).toEqual([]);
  });
});

describe('routeMarkers', () => {
  it('orders turn and stairs markers together by where they fall along the route', () => {
    // A right turn at index 1, then a stairs-up crossing at index 2 (the point on the departing floor).
    const points = [p(-1, 0, 'E'), p(0, 0, 'E'), p(0, 1, 'E'), p(0, 1, '1'), p(5, 1, '1')];
    const markers = routeMarkers(points);
    expect(markers.map((m) => m.kind)).toEqual(['turn', 'stairs']);
    expect(markers.map((m) => m.pointIndex)).toEqual([1, 2]);
  });
});

describe('markerColour', () => {
  it('gives the same index the same colour every time', () => {
    expect(markerColour(0)).toBe(markerColour(0));
  });

  it('gives different indices (within the palette) different colours', () => {
    expect(markerColour(0)).not.toBe(markerColour(1));
  });

  it('cycles once past the end of the palette', () => {
    const paletteSize = new Set(Array.from({ length: 32 }, (_, i) => markerColour(i))).size;
    expect(markerColour(0)).toBe(markerColour(paletteSize));
  });
});
