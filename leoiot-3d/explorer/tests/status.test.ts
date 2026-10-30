import { describe, expect, it } from 'vitest';
import { co2Status } from '../src/core/status';

describe('co2Status (FR-07, AC-04)', () => {
  it.each([
    [0, 'green'],
    [599, 'green'],
    [599.9, 'green'],
    [600, 'yellow'],
    [1200, 'yellow'],
    [1200.1, 'red'],
    [1201, 'red'],
    [2600, 'red'],
  ])('%d ppm is %s', (ppm, status) => expect(co2Status(ppm)).toBe(status));
});
