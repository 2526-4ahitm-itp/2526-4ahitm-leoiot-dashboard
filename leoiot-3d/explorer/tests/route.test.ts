import { describe, expect, it } from 'vitest';
import { FLOOR_WAYPOINTS, GYM_ENTRANCE } from '../src/nav/legacyData';
import { routeTo } from '../src/nav/route';
import { FLOOR_Y, ROOM_POSITIONS } from '../src/nav/room-positions.generated';

function visits(points: { x: number; z: number }[], target: { x: number; z: number }, tolerance = 0.5): boolean {
  return points.some((p) => Math.abs(p.x - target.x) < tolerance && Math.abs(p.z - target.z) < tolerance);
}

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

  // U85/U86 sit on the spur that meets the main corridor at Intersection_three
  // (x ≈ -50.6). The door used to connect straight to whichever real graph
  // node was raw-distance-nearest to it — for these two that was
  // Intersection_two, far across open space, skipping Intersection_three even
  // though it is the real corner. Fixed by snapping the door to the projected
  // point on the nearest edge, connected to that edge's own endpoints at
  // their real sub-segment distance, instead of to both endpoints directly.
  it('U85 and U86 reach their door via Intersection_three, not straight from Intersection_two', () => {
    const three = FLOOR_WAYPOINTS.U!.intersections[2];
    for (const room of ['U85', 'U86']) {
      const result = routeTo(room);
      expect(result.ok, room).toBe(true);
      if (!result.ok) continue;
      expect(result.points.some((p) => Math.abs(p.x - three.x) < 1e-6 && Math.abs(p.z - three.z) < 1e-6), room).toBe(true);
    }
  });
});

describe('routeTo: floor 2, reported defect (231/228 and 230/229)', () => {
  // 228-231 are two "rows" of rooms east of the ring: 227/228/229 open onto
  // the ring corridor (z ≈ -13.9), 230/231 sit directly behind 228/229 on a
  // separate corridor spur (z ≈ -22.7) the SEGMENTS list never had a line
  // for. Routing via that list's "nearest hallway centreline" projected
  // 230/231's door onto the ring instead — almost exactly on top of
  // 229/228's own door — so the path visited that door before doubling back
  // to the real room. Fixed by routing to each room's own centre and letting
  // the real corridor-adjacency graph find its door, rather than first
  // routing to a point computed from the incomplete SEGMENTS list.
  it('route to 231 does not visit 228, and route to 230 does not visit 229', () => {
    const r231 = routeTo('231');
    const r230 = routeTo('230');
    expect(r231.ok).toBe(true);
    expect(r230.ok).toBe(true);
    if (!r231.ok || !r230.ok) return;
    expect(visits(r231.points, ROOM_POSITIONS['228'])).toBe(false);
    expect(visits(r230.points, ROOM_POSITIONS['229'])).toBe(false);
  });

  it('route to 228 does not visit 231, and route to 229 does not visit 230', () => {
    const r228 = routeTo('228');
    const r229 = routeTo('229');
    expect(r228.ok).toBe(true);
    expect(r229.ok).toBe(true);
    if (!r228.ok || !r229.ok) return;
    expect(visits(r228.points, ROOM_POSITIONS['231'])).toBe(false);
    expect(visits(r229.points, ROOM_POSITIONS['230'])).toBe(false);
  });

  it('231 and 230 end at their own centre, reached from the real z ≈ -22.7 corridor spur', () => {
    for (const room of ['230', '231']) {
      const result = routeTo(room);
      expect(result.ok, room).toBe(true);
      if (!result.ok) continue;
      const last = result.points[result.points.length - 1];
      expect(last.x, room).toBeCloseTo(ROOM_POSITIONS[room].x);
      expect(last.z, room).toBeCloseTo(ROOM_POSITIONS[room].z);
      const approach = result.points[result.points.length - 2];
      expect(approach.z, room).toBeCloseTo(-22.729476928710938, 1);
    }
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
