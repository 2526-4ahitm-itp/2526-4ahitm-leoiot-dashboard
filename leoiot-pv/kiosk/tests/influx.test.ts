import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  averagePower,
  parseCsv,
  parseToday,
  parseWeek,
  powerSeries,
  todayQuery,
  validRows,
  weekQuery,
  type CounterRow,
} from '../src/core/influx';
import type { Counters } from '../src/core/energy';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}.csv`, import.meta.url), 'utf8');

const DAY_START = new Date('2026-10-06T22:00:00Z'); // 00:00 Wien am 7. Oktober
const YESTERDAY: Counters = { yield: 820.6, exported: 15.4, imported: 240, charged: 118.8, discharged: 150.3 };
const SPEC: Counters = { yield: 746.2, exported: 0, imported: 207, charged: 82.4, discharged: 141.2 };
const ZERO: Counters = { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 };

const MIN = 60_000;
const at = (min: number): number => DAY_START.getTime() + min * MIN;

describe('parseCsv', () => {
  it('leere Antwort ergibt []', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\r\n')).toEqual([]);
  });

  it('trennt Blöcke mit unterschiedlicher Kopfzeile', () => {
    const text = '#datatype,string\r\n,result,a\r\n,_result,1\r\n\r\n,result,b,c\r\n,_result,2,3\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      { result: '_result', a: '1' },
      { result: '_result', b: '2', c: '3' },
    ]);
  });
});

describe('parseToday', () => {
  it('liest die Batterie-Fixture', () => {
    const rows = parseToday(fixture('today-battery'));
    expect(rows).toHaveLength(169);
    expect(rows[0].t).toBe(Date.parse('2026-10-06T22:04:30Z'));
    expect(rows[0].counters).toEqual(YESTERDAY);
    expect(rows[rows.length - 1].t).toBe(Date.parse('2026-10-07T12:02:30Z'));
    expect(rows[rows.length - 1].counters).toEqual(SPEC);
    for (let i = 1; i < rows.length; i++) expect(rows[i].t).toBeGreaterThan(rows[i - 1].t);
  });

  it('leere Antwort ergibt []', () => {
    expect(parseToday(fixture('today-empty'))).toEqual([]);
  });

  it('unvollständiges Fenster entfällt', () => {
    const head = ',result,table,_start,_stop,_time,_value,_field,_measurement,plant_id';
    const line = (time: string, field: string): string =>
      `,_result,0,2026-10-07T00:00:00Z,2026-10-07T22:00:00Z,${time},1,${field},solax_stats,test`;
    const fields = ['daily_yield', 'daily_exported', 'daily_imported', 'daily_charged', 'daily_discharged'];
    const lines = [
      head,
      ...fields.map((f) => line('2026-10-07T08:04:30Z', f)),
      ...fields.slice(0, 4).map((f) => line('2026-10-07T08:09:30Z', f)),
      '',
    ];
    expect(parseToday(lines.join('\r\n'))).toHaveLength(1);
  });
});

describe('validRows', () => {
  it('verzögerter Reset, Tag läuft', () => {
    const rows = parseToday(fixture('today-battery'));
    const valid = validRows(rows, DAY_START, YESTERDAY);
    expect(valid).toHaveLength(168);
    expect(valid[0].t).toBe(Date.parse('2026-10-06T22:09:30Z'));
    expect(validRows(rows, DAY_START, null)).toHaveLength(168);
  });

  it('verzögerter Reset, erst ein Stand da', () => {
    const rows = parseToday(fixture('today-before-reset'));
    expect(validRows(rows, DAY_START, YESTERDAY)).toEqual([]);
    expect(validRows(rows, DAY_START, null)).toHaveLength(1);
  });

  it('behält einen echten Tagesanfang', () => {
    const rows: CounterRow[] = [
      { t: at(4.5), counters: ZERO },
      { t: at(9.5), counters: { ...ZERO, imported: 0.3 } },
    ];
    expect(validRows(rows, DAY_START, YESTERDAY)).toHaveLength(2);
  });

  it('verwirft nach 30 Minuten nichts mehr', () => {
    const rows: CounterRow[] = [{ t: at(40), counters: YESTERDAY }];
    expect(validRows(rows, DAY_START, YESTERDAY)).toHaveLength(1);
  });
});

describe('parseWeek', () => {
  it('liest die Wochen-Fixture', () => {
    const week = parseWeek(fixture('week'));
    expect(Object.keys(week).sort()).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
    expect(week['2026-10-01']).toEqual({ yield: 430 });
    expect(week['2026-10-06']).toEqual(YESTERDAY);
    expect(week['2026-10-07']).toEqual(SPEC);
  });
});

describe('powerSeries', () => {
  it('einfach', () => {
    const rows: CounterRow[] = [
      { t: at(5), counters: ZERO },
      { t: at(10), counters: { ...ZERO, yield: 1, imported: 0.5 } },
    ];
    const s = powerSeries(rows, DAY_START);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ production: 0, consumption: 0 });
    expect(s[1].production).toBeCloseTo(12, 6);
    expect(s[1].consumption).toBeCloseTo(18, 6);
  });

  it('mit Batterie: Entladung steckt im Verbrauch', () => {
    const rows: CounterRow[] = [
      { t: at(5), counters: ZERO },
      { t: at(10), counters: { ...ZERO, discharged: 0.5 } },
    ];
    const s = powerSeries(rows, DAY_START);
    expect(s[1].production).toBe(0);
    expect(s[1].consumption).toBeCloseTo(6, 6);
  });

  it('Lücke und später Beginn', () => {
    const c = (n: number): Counters => ({ ...ZERO, yield: n, imported: n });
    const rows: CounterRow[] = [
      { t: at(5), counters: c(1) },
      { t: at(10), counters: c(2) },
      { t: at(40), counters: c(3) },
    ];
    const s = powerSeries(rows, DAY_START);
    expect(s[2].production).toBeNull();
    expect(s[2].consumption).toBeNull();

    const late: CounterRow[] = [
      { t: at(60), counters: c(1) },
      { t: at(65), counters: c(2) },
      { t: at(70), counters: c(3) },
    ];
    expect(powerSeries(late, DAY_START)).toHaveLength(late.length - 1);
  });

  it('auf der Fixture', () => {
    const rows = validRows(parseToday(fixture('today-battery')), DAY_START, YESTERDAY);
    const s = powerSeries(rows, DAY_START);
    expect(s).toHaveLength(168);
    for (const p of s) {
      expect(p.production === null || p.production >= 0).toBe(true);
      expect(p.consumption === null || p.consumption >= 0).toBe(true);
    }
    expect(Math.max(...s.map((p) => p.production ?? 0))).toBeGreaterThan(50);
    const night = s.find((p) => p.t === Date.parse('2026-10-07T01:04:30Z'));
    expect(night?.production).toBe(0);
    expect(night?.consumption).toBeGreaterThan(0);
  });
});

describe('averagePower', () => {
  const row = (min: number, n: number): CounterRow => ({
    t: at(min),
    counters: {
      yield: 100 + n,
      exported: 10 + (n === 2 ? 0.5 : 0),
      imported: 50,
      charged: 20 + n * 0.5,
      discharged: 5,
    },
  });

  it('mittlere Leistung über zehn Minuten', () => {
    const rows = [row(0, 0), row(5, 1), row(10, 2)];
    const r = averagePower(rows);
    expect(r).not.toBeNull();
    expect(r!.power.pv).toBeCloseTo(12, 6);
    expect(r!.power.grid).toBeCloseTo(-3, 6);
    expect(r!.power.battery).toBeCloseTo(-6, 6);
    expect(r!.power.load).toBeCloseTo(3, 6);
    expect(r!.t).toBe(at(10));
  });

  it('zu wenige oder unpassende Stände ergeben null', () => {
    expect(averagePower([row(0, 0)])).toBeNull();
    expect(averagePower([row(0, 0), row(5, 1)])).toBeNull();
    expect(averagePower([row(0, 0), row(30, 1)])).toBeNull();
  });

  it('auf der Fixture', () => {
    const rows = validRows(parseToday(fixture('today-battery')), DAY_START, YESTERDAY);
    const r = averagePower(rows);
    expect(r).not.toBeNull();
    expect(r!.t).toBe(Date.parse('2026-10-07T12:02:30Z'));
    expect(r!.power.pv).toBeGreaterThan(0);
  });
});

describe('Abfragen', () => {
  const start = new Date('2026-10-06T22:00:00Z');
  const end = new Date('2026-10-07T22:00:00Z');

  it('todayQuery', () => {
    const q = todayQuery(start, end);
    expect(q).toContain('range(start: 2026-10-06T22:00:00.000Z, stop: 2026-10-07T22:00:00.000Z)');
    expect(q).toContain('window(every: 5m)');
    for (const f of ['daily_yield', 'daily_exported', 'daily_imported', 'daily_charged', 'daily_discharged']) {
      expect(q).toContain(f);
    }
    expect(q).not.toContain('"consumption"');
  });

  it('weekQuery', () => {
    const q = weekQuery(start, end);
    expect(q).toContain('timezone.location(name: "Europe/Vienna")');
    expect(q).toContain('aggregateWindow(every: 1d, fn: last, createEmpty: false, timeSrc: "_start")');
  });
});
