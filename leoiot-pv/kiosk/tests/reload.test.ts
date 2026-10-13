import { describe, it, expect } from 'vitest';
import { msUntilReload } from '../src/ui/reload';

const H = 3_600_000;
const ms = (t: string): number => msUntilReload(new Date(t));

describe('msUntilReload', () => {
  it('nach Mitternacht bis 03:30', () => {
    expect(ms('2026-10-07T00:00:00+02:00')).toBe(3.5 * H);
  });
  it('kurz vor 03:30', () => {
    expect(ms('2026-10-07T03:29:00+02:00')).toBe(60_000);
  });
  it('genau 03:30 erst am nächsten Tag', () => {
    expect(ms('2026-10-07T03:30:00+02:00')).toBe(24 * H);
  });
  it('mittags', () => {
    expect(ms('2026-10-07T12:00:00+02:00')).toBe(15.5 * H);
  });
  it('immer positiv', () => {
    for (const t of ['2026-10-07T23:59:59+02:00', '2026-03-29T12:00:00+02:00', '2026-10-25T01:30:00+02:00']) {
      expect(ms(t)).toBeGreaterThan(0);
    }
  });
});
