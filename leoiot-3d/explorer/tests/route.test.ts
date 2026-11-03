import { describe, expect, it } from 'vitest';
import { FLOOR_WAYPOINTS, GYM_ENTRANCE } from '../src/nav/legacyData';
import { routeTo } from '../src/nav/route';
import { FLOOR_Y } from '../src/nav/room-positions.generated';

describe('routeTo: ground floor', () => {
  it('passes through the Aula start point before reaching the room', () => {
    const result = routeTo('E07');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]).toMatchObject({ x: FLOOR_WAYPOINTS.E!.start.x, z: FLOOR_WAYPOINTS.E!.start.z });
  });
});

describe('routeTo: multi-floor', () => {
  it('climbs via both floors\' stairs waypoints in order (same x/z, different height)', () => {
    const result = routeTo('203');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const groundY = FLOOR_Y.E, targetY = FLOOR_Y['2'];
    const groundIdx = result.points.findIndex((p) => Math.abs(p.y - groundY) < 1e-6 && Math.abs(p.x - FLOOR_WAYPOINTS.E!.stairs.x) < 1e-6);
    const targetIdx = result.points.findIndex((p) => Math.abs(p.y - targetY) < 1e-6 && Math.abs(p.x - FLOOR_WAYPOINTS['2']!.stairs.x) < 1e-6);
    expect(groundIdx).toBeGreaterThanOrEqual(0);
    expect(targetIdx).toBeGreaterThan(groundIdx);
  });

  it('goes via the target floor\'s own start point after climbing', () => {
    const result = routeTo('203');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const start2 = FLOOR_WAYPOINTS['2']!.start;
    expect(result.points.some((p) => Math.abs(p.x - start2.x) < 1e-6 && Math.abs(p.z - start2.z) < 1e-6)).toBe(true);
  });
});

describe('routeTo: real corridor adjacency (model3d-room-navigation design.md D7)', () => {
  // U05/U08 are near the west wing: the only way there is via Intersection_one
  // then Intersection_two, per CORRIDOR_ADJACENCY. A route that reaches Two
  // without visiting One first would mean it jumped a connection that isn't
  // real — exactly the bug this adjacency graph replaced.
  it('reaches Intersection_two only after Intersection_one', () => {
    for (const room of ['U05', 'U08']) {
      const result = routeTo(room);
      expect(result.ok, room).toBe(true);
      if (!result.ok) continue;
      const one = FLOOR_WAYPOINTS.U!.intersections[0];
      const two = FLOOR_WAYPOINTS.U!.intersections[1];
      const oneIdx = result.points.findIndex((p) => Math.abs(p.x - one.x) < 1e-6 && Math.abs(p.z - one.z) < 1e-6);
      const twoIdx = result.points.findIndex((p) => Math.abs(p.x - two.x) < 1e-6 && Math.abs(p.z - two.z) < 1e-6);
      expect(oneIdx, room).toBeGreaterThanOrEqual(0);
      expect(twoIdx, room).toBeGreaterThan(oneIdx);
    }
  });

  it('a room near the east wing reaches it via Intersection_five/four without needing one/two', () => {
    const result = routeTo('U84');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const four = FLOOR_WAYPOINTS.U!.intersections[3];
    expect(result.points.some((p) => Math.abs(p.x - four.x) < 1e-6 && Math.abs(p.z - four.z) < 1e-6)).toBe(true);
  });
});

describe('routeTo: gym', () => {
  it('starts at the gym entrance for every gym room', () => {
    for (const room of ['T1', 'T2', 'T3', 'T4', 'T6', 'T19']) {
      const result = routeTo(room);
      expect(result.ok, room).toBe(true);
      if (!result.ok) continue;
      expect(result.points[0].x, room).toBeCloseTo(GYM_ENTRANCE.x);
      expect(result.points[0].z, room).toBeCloseTo(GYM_ENTRANCE.z);
    }
  });
});
