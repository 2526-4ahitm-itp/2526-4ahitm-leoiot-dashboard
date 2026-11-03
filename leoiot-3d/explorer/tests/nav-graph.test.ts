import { describe, expect, it } from 'vitest';
import { floorOf } from '../src/core/rooms';
import { FLOOR_WAYPOINTS, GYM_ENTRANCE, GYM_INTERSECTIONS, SEGMENTS } from '../src/nav/legacyData';
import { knownRooms, routeTo } from '../src/nav/route';
import { FLOOR_Y, ROOM_POSITIONS } from '../src/nav/room-positions.generated';

describe('legacy reference data', () => {
  it('every floor with waypoints has a start, stairs and at least one intersection', () => {
    for (const [floor, wp] of Object.entries(FLOOR_WAYPOINTS)) {
      expect(wp!.start, floor).toBeDefined();
      expect(wp!.stairs, floor).toBeDefined();
      expect(wp!.intersections.length, floor).toBeGreaterThan(0);
    }
  });

  it('the gym has an entrance and several intersections', () => {
    expect(GYM_ENTRANCE).toBeDefined();
    expect(GYM_INTERSECTIONS.length).toBeGreaterThan(5);
  });

  it('every segment has a finite, non-degenerate length', () => {
    for (const s of SEGMENTS) {
      const length = s.type === 'H' ? Math.abs(s.x2 - s.x1) : Math.abs(s.z2 - s.z1);
      expect(length, s.id).toBeGreaterThan(0);
    }
  });
});

describe("every room's position is on the floor its id implies", () => {
  it('ROOM_POSITIONS floor matches floorOf(room)', () => {
    for (const [room, pos] of Object.entries(ROOM_POSITIONS)) {
      expect(pos.floor).toBe(floorOf(room));
    }
  });

  it('FLOOR_Y has a value for every floor used', () => {
    for (const pos of Object.values(ROOM_POSITIONS)) {
      expect(Number.isFinite(FLOOR_Y[pos.floor])).toBe(true);
    }
  });
});

describe('routeTo', () => {
  it('rejects an unknown room', () => {
    expect(routeTo('NoSuchRoom')).toEqual({ ok: false, reason: 'unknown-room' });
  });

  // T12 is a known gap in legacy's own gym logic: unlike every other gym room, it's never
  // named in any of the per-intersection allow-lists, so its door is unreachable there too
  // — faithfully reproduced here, not something to "fix" out of a 1:1 port.
  const KNOWN_INCOMPLETE = new Set(['T12']);

  it('produces a route for every room the models define, ending at the room', () => {
    for (const room of knownRooms()) {
      if (KNOWN_INCOMPLETE.has(room)) continue;
      const result = routeTo(room);
      expect(result.ok, room).toBe(true);
      if (!result.ok) continue;
      expect(result.points.length, room).toBeGreaterThanOrEqual(2);
      const last = result.points[result.points.length - 1];
      const pos = ROOM_POSITIONS[room];
      expect(last.x, room).toBeCloseTo(pos.x);
      expect(last.z, room).toBeCloseTo(pos.z);
    }
  });

  it('starts every ground-floor and gym route at the right entrance', () => {
    const e = routeTo('E07');
    expect(e.ok).toBe(true);
    if (e.ok) {
      expect(e.points[0].x).toBeCloseTo(FLOOR_WAYPOINTS.E!.start.x);
      expect(e.points[0].z).toBeCloseTo(FLOOR_WAYPOINTS.E!.start.z);
    }
    const t = routeTo('T1');
    expect(t.ok).toBe(true);
    if (t.ok) {
      expect(t.points[0].x).toBeCloseTo(GYM_ENTRANCE.x);
      expect(t.points[0].z).toBeCloseTo(GYM_ENTRANCE.z);
    }
  });

  it('crosses through the stairs when routing to an upper floor', () => {
    const result = routeTo('105');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stairs = FLOOR_WAYPOINTS['1']!.stairs;
    expect(result.points.some((p) => Math.abs(p.x - stairs.x) < 1e-6 && Math.abs(p.z - stairs.z) < 1e-6)).toBe(true);
  });
});
