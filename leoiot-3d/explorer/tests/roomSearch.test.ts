import { describe, expect, it } from 'vitest';
import { filterRooms } from '../src/core/roomSearch';

const ROOMS = ['E07', 'E08', 'E581', 'E582', '105', '108', 'U74', 'U74.1'];

describe('filterRooms', () => {
  it('returns nothing for an empty query', () => {
    expect(filterRooms('', ROOMS)).toEqual([]);
    expect(filterRooms('   ', ROOMS)).toEqual([]);
  });

  it('matches case-insensitively on a partial id', () => {
    expect(filterRooms('e58', ROOMS)).toEqual(['E581', 'E582']);
  });

  it('puts prefix matches before mid-string matches', () => {
    // "7" is a prefix of none of these but mid-string of several; "u74" is a prefix of two.
    expect(filterRooms('u74', ROOMS)).toEqual(['U74', 'U74.1']);
  });

  it('caps the number of suggestions', () => {
    const many = Array.from({ length: 20 }, (_, i) => `E${i}`);
    expect(filterRooms('e', many)).toHaveLength(8);
  });
});
