import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { floorOf, roomIdOf } from '../src/core/rooms';

describe('roomIdOf', () => {
  it.each([
    ['134_1', '134'],
    ['134', '134'],
    ['U74.1', 'U74.1'],
    ['1Aula', '1Aula'],
    ['UBiolab', 'UBiolab'],
    ['E581', 'E581'],
    ['T19', 'T19'],
  ])('%s → %s', (name, id) => expect(roomIdOf(name)).toBe(id));

  it.each(['cellar-GLAS_NORMALGLAS_3', 'ground_floor-FARBE__WEI__4', 'ceiling_floor', 'basement', 'Model.obj', 'Würfel', 'Scene 0', ''])(
    '%s is not a room',
    (name) => expect(roomIdOf(name)).toBeNull(),
  );
});

describe('floorOf', () => {
  it.each([
    ['U08', 'U'],
    ['E10', 'E'],
    ['105', '1'],
    ['1Aula', '1'],
    ['251', '2'],
    ['T1', 'T'],
  ])('%s is on %s', (room, floor) => expect(floorOf(room)).toBe(floor));
  it('unknown prefix', () => expect(floorOf('X1')).toBeNull());
});

// The node names in the copied models (design D1, D7)
function roomsIn(file: string): Set<string> {
  const gltf = JSON.parse(readFileSync(new URL(`../models/${file}`, import.meta.url), 'utf8')) as { nodes: { name?: string }[] };
  const ids = gltf.nodes.map((n) => roomIdOf(n.name ?? '')).filter((id): id is string => id !== null);
  return new Set(ids);
}

describe('rooms in the models', () => {
  const count = (rooms: Set<string>, floor: string) => [...rooms].filter((r) => floorOf(r) === floor).length;

  it('cumulative floor models', () => {
    const u = roomsIn('ModelU.gltf');
    const e = roomsIn('ModelE.gltf');
    const f1 = roomsIn('Model1F.gltf');
    const f2 = roomsIn('Model2F.gltf');
    expect([u.size, e.size, f1.size, f2.size]).toEqual([26, 43, 72, 94]);
    expect([count(f2, 'U'), count(f2, 'E'), count(f2, '1'), count(f2, '2')]).toEqual([26, 17, 29, 22]);
    expect(u.has('U74.1') && u.has('U74') && u.has('UBiolab')).toBe(true);
    expect(f1.has('1Aula')).toBe(true);
  });

  it('whole building has every school room and no gym', () => {
    const full = roomsIn('ModelFull.gltf');
    expect(full).toEqual(roomsIn('Model2F.gltf'));
    expect(count(full, 'T')).toBe(0);
  });

  it('gym', () => {
    const t = roomsIn('ModelT.gltf');
    expect(t.size).toBe(13);
    expect(count(t, 'T')).toBe(13);
  });
});
