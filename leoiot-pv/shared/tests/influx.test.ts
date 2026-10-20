import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  averagePower,
  earliestQuery,
  parseEarliest,
  parseCsv,
  parseToday,
  parseWeek,
  monotoneRows,
  powerSeries,
  todayQuery,
  validRows,
  weekQuery,
  type CounterRow,
} from '../src/influx';
import type { Counters } from '@leoiot-pv/shared/energy';

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

// Echte Messwerte vom 13. Oktober 2026 (5-Minuten-Stände wie todayQuery sie liefert, Zähler springen kurz zurück)
const REAL_DAY_START = new Date('2026-10-12T22:00:00Z');
const real = (iso: string, yieldV: number, exported: number, imported: number, charged: number, discharged: number): CounterRow => ({
  t: Date.parse(iso),
  counters: { yield: yieldV, exported, imported, charged, discharged },
});
const REAL_ROWS: CounterRow[] = [
  real('2026-10-12T22:09:24.129Z', 0, 0, 2, 0, 0),
  real('2026-10-12T22:14:23.836Z', 0, 0, 5, 0, 0),
  real('2026-10-12T22:19:23.973Z', 0, 0, 7, 0, 0),
  real('2026-10-13T02:34:29.682Z', 0, 0, 134, 0, 0.2),
  real('2026-10-13T02:39:29.937Z', 0, 0, 134, 0, 0.2),
  real('2026-10-13T02:44:29.945Z', 0, 0, 134, 0, 0.2),
  real('2026-10-13T02:49:30.101Z', 0, 0, 131, 0, 0.2),
  real('2026-10-13T02:54:30.187Z', 0, 0, 142, 0, 0.2),
  real('2026-10-13T02:59:36.755Z', 0, 0, 151, 0, 0.2),
  real('2026-10-13T03:04:30.789Z', 0, 0, 151, 0, 0.2),
  real('2026-10-13T03:09:30.545Z', 0, 0, 161, 0, 0.2),
  real('2026-10-13T03:14:30.538Z', 0, 0, 161, 0, 0.2),
  real('2026-10-13T03:19:30.888Z', 0, 0, 157, 0, 0.2),
  real('2026-10-13T03:24:31.382Z', 0, 0, 159, 0, 0.2),
  real('2026-10-13T03:29:31.002Z', 0, 0, 153, 0, 0.2),
  real('2026-10-13T03:34:30.959Z', 0, 0, 161, 0, 0.2),
  real('2026-10-13T03:39:31.107Z', 0, 0, 171, 0, 0.2),
  real('2026-10-13T03:44:31.339Z', 0, 0, 171, 0, 0.2),
];
// Minutenstände um den Rücksprung 134 -> 128 -> 134 (02:43 bis 02:49 UTC)
const REAL_MINUTES: CounterRow[] = [
  real('2026-10-13T02:43:30.522Z', 0, 0, 134, 0, 0.2),
  real('2026-10-13T02:44:29.945Z', 0, 0, 134, 0, 0.2),
  real('2026-10-13T02:45:29.98Z', 0, 0, 128, 0, 0.2),
  real('2026-10-13T02:46:30.633Z', 0, 0, 130, 0, 0.2),
  real('2026-10-13T02:47:30.16Z', 0, 0, 124, 0, 0.1),
  real('2026-10-13T02:48:30.026Z', 0, 0, 134, 0, 0.2),
  real('2026-10-13T02:49:30.101Z', 0, 0, 131, 0, 0.2),
];

describe('Rücksprünge einzelner Zähler (echte Messwerte)', () => {
  it('validRows verwirft nur die Stände vor dem Tagesanfang', () => {
    const valid = validRows(REAL_ROWS, REAL_DAY_START, null);
    expect(valid).toHaveLength(REAL_ROWS.length);
    expect(valid[0].t).toBe(REAL_ROWS[0].t);
  });

  it('Reset in den ersten 30 Minuten gilt weiter als Tagesanfang', () => {
    const rows = [real('2026-10-12T22:05:00Z', 0, 0, 240, 0, 0), real('2026-10-12T22:10:00Z', 0, 0, 1, 0, 0)];
    expect(validRows(rows, REAL_DAY_START, null)).toEqual([rows[1]]);
  });

  it('Rückgang mitten am Tag mit mehr als halbierter Zählersumme gilt als Reset', () => {
    const rows = [
      real('2026-10-13T08:00:00Z', 10, 1, 100, 5, 4),
      real('2026-10-13T08:05:00Z', 10.1, 1, 101, 5, 4),
      real('2026-10-13T08:10:00Z', 1, 0, 2, 0, 0),
      real('2026-10-13T08:15:00Z', 1.1, 0, 2.1, 0, 0),
    ];
    expect(validRows(rows, REAL_DAY_START, null)).toEqual(rows.slice(2));
  });

  it('Leistungskurve hat keinen Lückenpunkt und keine Spitze durch die Rückkehr auf 134', () => {
    const series = powerSeries(REAL_MINUTES, REAL_DAY_START);
    expect(series.every((p) => p.production !== null && p.consumption !== null)).toBe(true);
    const total = series.reduce((acc, p) => acc + (p.consumption ?? 0) * (1 / 60), 0);
    expect(total).toBeLessThan(0.5); // höchstens die 0,1 kWh Entladung, nicht 10 kWh
  });

  it('Leistungskurve über die 5-Minuten-Stände hat keine Lücke im Rücksprungbereich', () => {
    const valid = validRows(REAL_ROWS, REAL_DAY_START, null);
    const series = powerSeries(valid, REAL_DAY_START).filter((p) => p.t > Date.parse('2026-10-13T02:35:00Z'));
    expect(series.every((p) => p.consumption !== null)).toBe(true);
  });

  it('monotoneRows verändert die Eingabe nicht und liefert das laufende Maximum', () => {
    const copy = structuredClone(REAL_MINUTES);
    const out = monotoneRows(REAL_MINUTES);
    expect(REAL_MINUTES).toEqual(copy);
    expect(out).not.toBe(REAL_MINUTES);
    expect(out[2].counters).not.toBe(REAL_MINUTES[2].counters);
    expect(out.map((r) => r.counters.imported)).toEqual([134, 134, 134, 134, 134, 134, 134]);
    expect(out[4].counters.discharged).toBe(0.2);
  });

  it('Tageswerte bleiben der Rohwert des letzten Stands', () => {
    const valid = validRows(REAL_ROWS, REAL_DAY_START, null);
    expect(valid[valid.length - 1].counters.imported).toBe(171);
    const low = [...REAL_ROWS.slice(0, 7)];
    expect(validRows(low, REAL_DAY_START, null)[6].counters.imported).toBe(131);
  });
});

describe('earliestQuery und parseEarliest', () => {
  it('Abfrage nimmt den ersten Produktionswert', () => {
    const q = earliestQuery();
    expect(q).toContain('first()');
    expect(q).toContain('daily_yield');
    expect(q).toContain('solax_stats');
  });

  it('liest den Zeitpunkt aus einer kleinen CSV', () => {
    const csv = [
      ',result,table,_start,_stop,_time,_value,_field,_measurement',
      ',_result,0,2000-01-01T00:00:00Z,2026-10-20T00:00:00Z,2026-01-01T05:30:00Z,0.4,daily_yield,solax_stats',
      '',
    ].join('\n');
    expect(parseEarliest(csv)?.toISOString()).toBe('2026-01-01T05:30:00.000Z');
  });

  it('leere Antwort ergibt null', () => {
    expect(parseEarliest('')).toBeNull();
  });
});
