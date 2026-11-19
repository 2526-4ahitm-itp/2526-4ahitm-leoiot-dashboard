import { describe, expect, it } from 'vitest';
import { compareRoomIds, floorOf, groupByFloor } from '../src/core/floors';

describe('floor of a room (first character)', () => {
  it.each([
    ['105', '1'],
    ['1Aula', '1'],
    ['E10', 'E'],
    ['U74.1', 'U'],
    ['UBiolab', 'U'],
    ['215', '2'],
    ['T2', 'T'],
    ['X99', null],
    ['', null],
  ])('%s is on floor %s', (id, floor) => {
    expect(floorOf(id)).toBe(floor);
  });
});

describe('order of room ids', () => {
  it('digit runs compare as numbers', () => {
    expect(['T10', 'T2', 'T1'].sort(compareRoomIds)).toEqual(['T1', 'T2', 'T10']);
    expect(['E10', 'E5'].sort(compareRoomIds)).toEqual(['E5', 'E10']);
    expect(['U74.1', 'U74', 'U8'].sort(compareRoomIds)).toEqual(['U8', 'U74', 'U74.1']);
    expect(['105', '1Aula', '99'].sort(compareRoomIds)).toEqual(['1Aula', '99', '105']);
  });
  it('is a total order for equal numbers written differently', () => {
    expect(compareRoomIds('E07', 'E7')).not.toBe(0);
    expect(compareRoomIds('E7', 'E7')).toBe(0);
  });
});

describe('grouping by floor', () => {
  it('floors in building order, unknown floor last, empty floors left out, rooms sorted', () => {
    const groups = groupByFloor(['X99', 'T10', 'T2', '105', 'E10', '1Aula', 'U74.1', '215']);
    expect(groups.map((g) => g.floor)).toEqual(['U', 'E', '1', '2', 'T', null]);
    expect(groups.find((g) => g.floor === '1')!.rooms).toEqual(['1Aula', '105']);
    expect(groups.find((g) => g.floor === 'T')!.rooms).toEqual(['T2', 'T10']);
    expect(groups.at(-1)).toEqual({ floor: null, rooms: ['X99'] });
  });
  it('no rooms, no groups', () => {
    expect(groupByFloor([])).toEqual([]);
  });
});
