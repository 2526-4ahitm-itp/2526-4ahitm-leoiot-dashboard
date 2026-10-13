import { describe, it, expect } from 'vitest';
import type { KioskState, Status } from '../src/data/store';
import type { KioskView } from '../src/data/view';
import { fieldStates, pageState, stateText, type FieldState, type FieldStates } from '../src/ui/fieldState';

const COUNTERS = { yield: 1, exported: 0, imported: 0, charged: 0, discharged: 0 };
const FLOW = { power: { pv: 1, load: 1, grid: 0, battery: 0 }, source: 'live' as const };

function st(todayStatus: Status, weekStatus: Status): KioskState {
  return { todayStatus, weekStatus } as KioskState;
}
function vw(today: boolean, flow: boolean): KioskView {
  return { today: today ? COUNTERS : null, flow: flow ? FLOW : null } as KioskView;
}

describe('fieldStates', () => {
  it('alles lädt', () => {
    expect(fieldStates(st('loading', 'loading'), vw(false, false))).toEqual({
      today: 'loading', week: 'loading', power: 'loading', flow: 'loading',
    });
  });
  it('alles ok', () => {
    expect(fieldStates(st('ok', 'ok'), vw(true, true))).toEqual({
      today: 'ok', week: 'ok', power: 'ok', flow: 'ok',
    });
  });
  it('Fehler heute ohne Live-Werte', () => {
    const s = fieldStates(st('error', 'ok'), vw(false, false));
    expect([s.today, s.power, s.flow]).toEqual(['error', 'error', 'error']);
  });
  it('Fehler heute, aber Live-Werte', () => {
    const s = fieldStates(st('error', 'ok'), vw(false, true));
    expect(s.flow).toBe('ok');
    expect(s.today).toBe('error');
  });
  it('heute ok ohne Leistung', () => {
    expect(fieldStates(st('ok', 'ok'), vw(true, false)).flow).toBe('nopower');
  });
  it('heute leer', () => {
    expect(fieldStates(st('empty', 'ok'), vw(false, false)).flow).toBe('empty');
  });
  it('Woche fehlerhaft, heute ok', () => {
    const s = fieldStates(st('ok', 'error'), vw(true, true));
    expect(s.week).toBe('error');
    expect(s.today).toBe('ok');
  });
  it('ok ohne Tageswerte gilt als leer', () => {
    expect(fieldStates(st('ok', 'ok'), vw(false, false)).today).toBe('empty');
  });
});

describe('stateText', () => {
  it('ok hat keinen Text', () => {
    expect(stateText('ok')).toBeNull();
  });
  it('alle anderen haben Titel, nur loading ohne Erklärung', () => {
    for (const s of ['loading', 'empty', 'error', 'nopower'] as FieldState[]) {
      const t = stateText(s);
      expect(t?.title).not.toBe('');
      expect(t?.detail === '').toBe(s === 'loading');
    }
  });
});

describe('pageState', () => {
  const all = (s: FieldState): FieldStates => ({ today: s, week: s, power: s, flow: s });
  it('vier gleiche Zustände ohne Daten', () => {
    expect(pageState(all('loading'))).toBe('loading');
    expect(pageState(all('error'))).toBe('error');
    expect(pageState(all('empty'))).toBe('empty');
  });
  it('viermal ok ist keine Meldung', () => {
    expect(pageState(all('ok'))).toBeNull();
  });
  it('gemischte Zustände ergeben null', () => {
    expect(pageState({ ...all('error'), flow: 'ok' })).toBeNull();
    expect(pageState({ today: 'error', week: 'empty', power: 'error', flow: 'error' })).toBeNull();
    expect(pageState({ today: 'ok', week: 'ok', power: 'ok', flow: 'nopower' })).toBeNull();
    expect(pageState({ ...all('loading'), flow: 'nopower' })).toBeNull();
  });
});
