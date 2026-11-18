import { describe, expect, it } from 'vitest';
import { routeFloors, visibleRoutePoints, type RoutePoint } from '../src/nav/route';

function p(floor: RoutePoint['floor']): RoutePoint {
  return { x: 0, y: 0, z: 0, floor };
}

describe('routeFloors', () => {
  it('collapses consecutive points on the same floor into one entry', () => {
    const points = [p('E'), p('E'), p('1'), p('1'), p('2')];
    expect(routeFloors(points)).toEqual(['E', '1', '2']);
  });

  it('a single-floor route has one entry', () => {
    expect(routeFloors([p('T'), p('T')])).toEqual(['T']);
  });
});

describe('visibleRoutePoints', () => {
  const points = [p('U'), p('E'), p('1'), p('2')];

  it('the whole building shows every main-floor point', () => {
    expect(visibleRoutePoints(points, 'full')).toEqual(points);
  });

  it('a floor view shows that floor and everything beneath it, not above', () => {
    expect(visibleRoutePoints(points, '1')).toEqual([p('U'), p('E'), p('1')]);
  });

  it('the ground floor view shows only the basement and ground floor', () => {
    expect(visibleRoutePoints(points, 'E')).toEqual([p('U'), p('E')]);
  });

  it('the top floor shows everything', () => {
    expect(visibleRoutePoints(points, '2')).toEqual(points);
  });

  it('the gym view only shows gym points', () => {
    const withGym = [p('T'), p('T')];
    expect(visibleRoutePoints(withGym, 'T')).toEqual(withGym);
    expect(visibleRoutePoints(points, 'T')).toEqual([]);
  });

  it('the whole building never shows gym points', () => {
    expect(visibleRoutePoints([p('T')], 'full')).toEqual([]);
  });
});
