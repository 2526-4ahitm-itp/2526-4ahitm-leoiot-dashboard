import { describe, expect, it } from 'vitest';
import { checkResult, computeConsumption, PV_TOPIC, REQUIRED_FIELDS, toLine, toMessage } from '../src/core/reading.js';
import { sampleResult } from './helpers.js';

describe('Vollständigkeitsprüfung', () => {
  it('akzeptiert eine vollständige Antwort', () => {
    const r = checkResult(sampleResult());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reading.totalYield).toBe(12345.5);
  });

  for (const field of REQUIRED_FIELDS) {
    it(`meldet fehlenden Wert ${field}`, () => {
      const result = sampleResult();
      delete result[field];
      expect(checkResult(result)).toEqual({ ok: false, missing: field });
    });

    it(`weist ${field} ab, wenn es keine Zahl ist`, () => {
      expect(checkResult(sampleResult({ [field]: 'viel' }))).toEqual({ ok: false, missing: field });
      expect(checkResult(sampleResult({ [field]: null }))).toEqual({ ok: false, missing: field });
      expect(checkResult(sampleResult({ [field]: Number.NaN }))).toEqual({ ok: false, missing: field });
    });
  }

  it('weist eine Antwort ohne Objekt ab', () => {
    expect(checkResult(undefined).ok).toBe(false);
    expect(checkResult('x').ok).toBe(false);
  });
});

describe('consumption', () => {
  it('ist dailyYield minus dailyExported plus dailyImported', () => {
    expect(computeConsumption(20.5, 5.25, 3)).toBe(18.25);
    const r = checkResult(sampleResult());
    if (r.ok) expect(r.reading.consumption).toBe(18.25);
  });
});

describe('Line Protocol', () => {
  it('schreibt genau die Zeile des bisherigen Collectors', () => {
    const r = checkResult(sampleResult());
    if (!r.ok) throw new Error('unerwartet');
    expect(toLine('test-plant', r.reading, 1760443200000)).toBe(
      'solax_stats,plant_id=test-plant daily_yield=20.5,total_yield=12345.5,consumption=18.25,' +
        'daily_charged=4.5,daily_discharged=2.5,daily_imported=3,daily_exported=5.25 1760443200000000000',
    );
  });

  it('übernimmt die Gleitkomma-Schreibweise von JavaScript', () => {
    const r = checkResult(sampleResult({ dailyYield: 0.3, dailyExported: 0.2, dailyImported: 0 }));
    if (!r.ok) throw new Error('unerwartet');
    expect(toLine('p', r.reading, 1000)).toContain('consumption=0.09999999999999998,');
  });
});

describe('Broker-Nachricht', () => {
  it('ist die komplette Cloud-Antwort, nicht reduziert', () => {
    const result = sampleResult();
    expect(JSON.parse(toMessage(result))).toEqual(result);
    expect(JSON.parse(toMessage(result)).extraField).toBe('bleibt erhalten');
  });

  it('nutzt das Thema des Datenvertrags', () => {
    expect(PV_TOPIC).toBe('leoenergy/solax_pv/overall_inverter');
  });
});
