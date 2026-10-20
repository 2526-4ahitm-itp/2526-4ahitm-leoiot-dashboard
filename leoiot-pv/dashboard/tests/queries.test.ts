import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadDayCurve, loadDayTotals, loadEarliest } from '../src/data/queries';

const fixture = (name: string): string =>
  readFileSync(new URL(`../../shared/tests/fixtures/${name}.csv`, import.meta.url), 'utf8');

describe('loadDayTotals', () => {
  it('eine Abfrage über alle Tage, Auswertung je Wiener Tag', async () => {
    const query = vi.fn(async (_flux: string) => fixture('week'));
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
    const out = await loadDayTotals(query, days);
    expect(query).toHaveBeenCalledTimes(1);
    const flux = query.mock.calls[0][0];
    expect(flux).toContain('2026-09-30T22:00:00.000Z');
    expect(flux).toContain('2026-10-07T22:00:00.000Z');
    expect(Object.keys(out).sort()).toEqual(days);
    expect(out['2026-10-02'].charged).toBe(96);
  });
  it('ohne Tage keine Abfrage', async () => {
    const query = vi.fn(async (_flux: string) => '');
    expect(await loadDayTotals(query, [])).toEqual({});
    expect(query).not.toHaveBeenCalled();
  });
});

describe('loadEarliest', () => {
  it('Wiener Tag des frühesten Werts', async () => {
    const csv = [
      ',result,table,_time,_value,_field',
      ',_result,0,2025-12-31T23:30:00Z,0.2,daily_yield',
      '',
    ].join('\n');
    expect(await loadEarliest(async () => csv)).toBe('2026-01-01');
  });
  it('leere Antwort ergibt null', async () => {
    expect(await loadEarliest(async () => '')).toBeNull();
  });
});

describe('loadDayCurve', () => {
  it('Zählerstände, Leistung und Fensteranzahl eines Tages', async () => {
    const query = vi.fn(async (_flux: string) => fixture('today-battery'));
    const out = await loadDayCurve(query, '2026-10-07', null);
    expect(out.rows.length).toBeGreaterThan(100);
    expect(out.power.length).toBeGreaterThan(100);
    expect(out.slots).toBe(288);
    const flux = query.mock.calls[0][0];
    expect(flux).toContain('2026-10-06T22:00:00.000Z');
    expect(flux).toContain('2026-10-07T22:00:00.000Z');
  });
  it('Umstellungstage: 300 Fenster am 25.10.2026, 276 am 29.3.2026', async () => {
    expect((await loadDayCurve(async () => '', '2026-10-25', null)).slots).toBe(300);
    expect((await loadDayCurve(async () => '', '2026-03-29', null)).slots).toBe(276);
  });
  it('leere Antwort ergibt leere Reihen', async () => {
    const out = await loadDayCurve(async () => fixture('today-empty'), '2026-10-07', null);
    expect(out.rows).toEqual([]);
    expect(out.power).toEqual([]);
  });
});
