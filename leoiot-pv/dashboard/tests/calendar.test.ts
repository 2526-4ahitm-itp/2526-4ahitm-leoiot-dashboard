import { describe, it, expect } from 'vitest';
import { dayDisabled, monthGrid, monthMatrix, moveCell, shiftMonth, weekdayIndex, yearList } from '../src/core/calendar';

describe('monthMatrix', () => {
  it('Oktober 2026: Montag zuerst, ISO-Wochen 40 bis 44', () => {
    const m = monthMatrix(2026, 10, null, null);
    expect(m.map((w) => w.week)).toEqual([40, 41, 42, 43, 44]);
    expect(m[0].days[0].key).toBe('2026-09-28');
    expect(m[0].days[0].inMonth).toBe(false);
    expect(m[0].days[3].key).toBe('2026-10-01');
    expect(m[4].days[6].key).toBe('2026-11-01');
    expect(m.every((w) => w.days.length === 7)).toBe(true);
  });
  it('Jahreswechsel: 2027-01 beginnt in Woche 53 von 2026', () => {
    expect(monthMatrix(2027, 1, null, null)[0].week).toBe(53);
  });
  it('Tage vor min und nach max sind gesperrt', () => {
    const m = monthMatrix(2026, 10, '2026-10-03', '2026-10-07');
    const flat = m.flatMap((w) => w.days);
    expect(flat.filter((d) => !d.disabled).map((d) => d.key)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
  });
  it('Februar im Schaltjahr hat 29 Tage', () => {
    expect(monthMatrix(2024, 2, null, null).flatMap((w) => w.days).filter((d) => d.inMonth)).toHaveLength(29);
  });
});

describe('monthGrid und yearList', () => {
  it('Monate außerhalb von min und max gesperrt', () => {
    const g = monthGrid(2026, '2026-03-25', '2026-10-07');
    expect(g.filter((c) => !c.disabled).map((c) => c.month)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(g[0].key).toBe('2026-01-01');
  });
  it('Jahre vom frühesten bis zum aktuellen', () => {
    expect(yearList('2024-05-01', '2026-10-07')).toEqual([2024, 2025, 2026]);
    expect(yearList(null, '2026-10-07')).toEqual([2026]);
  });
});

describe('moveCell', () => {
  it('Tag: Pfeile, Wochenanfang und -ende, Monat', () => {
    const f = (k: string) => moveCell('day', '2026-10-07', k, '2026-03-25', '2026-10-07');
    expect(f('ArrowLeft')).toBe('2026-10-06');
    expect(f('ArrowUp')).toBe('2026-09-30');
    expect(f('Home')).toBe('2026-10-05');
    expect(f('ArrowRight')).toBe('2026-10-07'); // an max gestutzt
    expect(f('End')).toBe('2026-10-07');
    expect(f('PageUp')).toBe('2026-09-07');
    expect(f('a')).toBeNull();
  });
  it('Tag: unten an min gestutzt, Monatsende wird gekürzt', () => {
    expect(moveCell('day', '2026-03-26', 'ArrowUp', '2026-03-25', null)).toBe('2026-03-25');
    expect(shiftMonth('2026-03-31', 1)).toBe('2026-04-30');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
  });
  it('Monat: ±1, ±3, Zeilenanfang, Jahr', () => {
    const f = (k: string) => moveCell('month', '2026-05-01', k, '2026-03-25', '2026-10-07');
    expect(f('ArrowLeft')).toBe('2026-04-01');
    expect(f('ArrowDown')).toBe('2026-08-01');
    expect(f('ArrowUp')).toBe('2026-03-01'); // Februar gesperrt: auf März gestutzt
    expect(f('Home')).toBe('2026-04-01');
    expect(f('End')).toBe('2026-06-01');
    expect(f('PageDown')).toBe('2026-10-01');
  });
  it('Jahr', () => {
    expect(moveCell('year', '2025-01-01', 'ArrowRight', '2024-01-01', '2026-10-07', 2024)).toBe('2026-01-01');
    expect(moveCell('year', '2025-01-01', 'ArrowLeft', '2025-02-01', '2026-10-07', 2025)).toBe('2025-01-01');
  });
});

describe('Hilfen', () => {
  it('weekdayIndex und dayDisabled', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0);
    expect(weekdayIndex('2026-10-11')).toBe(6);
    expect(dayDisabled('2026-10-08', null, '2026-10-07')).toBe(true);
    expect(dayDisabled('2026-10-08', null, null)).toBe(false);
  });
});
