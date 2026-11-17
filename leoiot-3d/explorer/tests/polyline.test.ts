import { describe, expect, it } from 'vitest';
import { polylineLength, polylinePrefix } from '../src/core/polyline';

const straight = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
  { x: 10, y: 0, z: 10 },
];

describe('polylineLength', () => {
  it('sums the length of each segment', () => {
    expect(polylineLength(straight)).toBeCloseTo(20);
  });

  it('is zero for a single point or no points', () => {
    expect(polylineLength([{ x: 1, y: 2, z: 3 }])).toBe(0);
    expect(polylineLength([])).toBe(0);
  });
});

describe('polylinePrefix', () => {
  it('returns just the first point at length 0', () => {
    expect(polylinePrefix(straight, 0)).toEqual([straight[0]]);
  });

  it('interpolates a point mid-segment', () => {
    expect(polylinePrefix(straight, 5)).toEqual([straight[0], { x: 5, y: 0, z: 0 }]);
  });

  it('includes a full segment exactly at its length, without duplicating the endpoint', () => {
    expect(polylinePrefix(straight, 10)).toEqual([straight[0], straight[1]]);
  });

  it('continues into the next segment past the first corner', () => {
    expect(polylinePrefix(straight, 15)).toEqual([straight[0], straight[1], { x: 10, y: 0, z: 5 }]);
  });

  it('clamps to the full polyline when length exceeds the total', () => {
    expect(polylinePrefix(straight, 1000)).toEqual(straight);
  });

  it('is empty for an empty polyline', () => {
    expect(polylinePrefix([], 5)).toEqual([]);
  });
});
