import { describe, it, expect } from 'vitest';
import { viennaDayStart } from '@leoiot-pv/shared/time';
import { yieldPower } from '../src/core/yieldCurve';

const start = viennaDayStart('2026-04-10');
const csv = (vals: [number, number][]): string =>
  ',result,table,_time,_value,_field\n' +
  vals.map(([m, v]) => `,_result,0,${new Date(start.getTime() + m * 60_000).toISOString()},${v},daily_yield`).join('\n') +
  '\n,_result,1,' + start.toISOString() + ',5,daily_exported\n';

describe('yieldPower', () => {
  it('kW aus Differenzen, erster Stand knapp nach Mitternacht beginnt bei 0', () => {
    const p = yieldPower(csv([[5, 1], [10, 3]]), start);
    expect(p.map((x) => x.production)).toEqual([12, 24]);
    expect(p.every((x) => x.consumption === null)).toBe(true);
  });
  it('Rücksprung gilt als keine Änderung, große Lücke als Lücke', () => {
    const p = yieldPower(csv([[5, 2], [10, 1.5], [60, 4]]), start);
    expect(p.map((x) => x.production)).toEqual([24, 0, null]);
  });
  it('ohne daily_yield: leer', () => {
    expect(yieldPower(',result,table,_time,_value,_field\n', start)).toEqual([]);
  });
});
