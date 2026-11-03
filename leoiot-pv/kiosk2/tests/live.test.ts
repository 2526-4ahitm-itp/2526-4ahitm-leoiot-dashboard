import { describe, expect, it } from 'vitest';
import type { SocketLike } from '@leoiot-pv/shared/live';
import { liveMoment, storedStand } from '../src/core/moments';
import { isDaylight, nextSunrise, sunrise, sunset } from '../src/core/sun';
import { createStore, type Snapshot } from '../src/data/store';
import { msUntilReload } from '../src/ui/reload';
import { syntheticPoints } from './helpers';

// Bezugswerte für 48,267° N, 14,253° O von api.sunrise-sunset.org, abgerufen am 2026-11-03
const REFERENCE: [string, string, string][] = [
  ['2026-03-20', '2026-03-20T05:05:35Z', '2026-03-20T17:15:18Z'],
  ['2026-06-21', '2026-06-21T03:02:07Z', '2026-06-21T19:07:29Z'],
  ['2026-11-03', '2026-11-03T05:51:37Z', '2026-11-03T15:41:28Z'],
  ['2026-12-21', '2026-12-21T06:50:58Z', '2026-12-21T15:11:05Z'],
];

describe('Sonnenstand für Leonding', () => {
  it.each(REFERENCE)('%s auf zwei Minuten genau', (day, rise, set) => {
    const at = new Date(day + 'T12:00:00Z');
    expect(Math.abs(sunrise(at).getTime() - Date.parse(rise))).toBeLessThan(120_000);
    expect(Math.abs(sunset(at).getTime() - Date.parse(set))).toBeLessThan(120_000);
  });

  it('kennt Tag und Nacht und den nächsten Sonnenaufgang', () => {
    expect(isDaylight(new Date('2026-11-03T11:00:00Z'))).toBe(true);
    expect(isDaylight(new Date('2026-11-03T18:00:00Z'))).toBe(false);
    expect(nextSunrise(new Date('2026-11-03T18:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-04');
  });
});

describe('Moment „Gerade jetzt“', () => {
  const noon = new Date('2026-11-03T12:30:00Z');
  it('zeigt die Live-Leistung', () => {
    const m = liveMoment(noon, { kw: 42.3, t: noon.getTime() - 5000 });
    expect([m.kicker, m.value, m.unit]).toEqual(['Gerade jetzt', '42,3', 'kW']);
  });
  it('nennt nach drei Minuten Stille die Zeit des letzten Werts', () => {
    const m = liveMoment(noon, { kw: 42.3, t: noon.getTime() - 8 * 60_000 });
    expect(m.kicker).toBe('Stand 13:22');
    expect(m.value).toBe('42,3');
  });
  it('sagt ohne jeden Live-Wert, dass keiner da ist', () => {
    expect(liveMoment(noon, null).caption).toBe('Gerade keine Live-Daten.');
  });
  it('zeigt am Abend den nächsten Sonnenaufgang statt 0 kW', () => {
    const m = liveMoment(new Date('2026-11-03T18:00:00Z'), { kw: 0, t: Date.parse('2026-11-03T18:00:00Z') });
    expect(m.kicker).toBe('Die Anlage ruht');
    expect(m.value).toMatch(/^0[67]:\d\d$/);
    expect(m.value).not.toBe('0,0');
  });
  it('nennt die Zeit des jüngsten gespeicherten Stands erst ab 15 Minuten Alter', () => {
    expect(storedStand(noon, noon.getTime() - 10 * 60_000)).toBe('');
    expect(storedStand(noon, noon.getTime() - 20 * 60_000)).toBe('Stand\u00a013:10');
  });
});

// Kleine Uhr für den Datenspeicher: Zeitgeber laufen erst, wenn der Test sie auslöst
function harness(nowIso: string, answer: (flux: string) => Promise<string>) {
  let now = new Date(nowIso);
  const timers: { fn: () => void; at: number }[] = [];
  const snaps: Snapshot[] = [];
  const sockets: SocketLike[] = [];
  const store = createStore({
    query: answer,
    now: () => now,
    liveUrls: ['ws://x/ws'],
    createSocket: () => { const s: SocketLike = { onopen: null, onmessage: null, onclose: null, onerror: null, close() {} }; sockets.push(s); return s; },
    setTimer: (fn, ms) => timers.push({ fn, at: now.getTime() + ms }),
    onChange: (s) => snaps.push(s),
  });
  const advance = async (ms: number) => {
    now = new Date(now.getTime() + ms);
    for (const t of timers.splice(0).filter((x) => { if (x.at <= now.getTime()) return true; timers.push(x); return false; })) t.fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { store, snaps, sockets, advance, last: () => snaps[snaps.length - 1] };
}

const csv = (pts: { t: number; value: number }[]) => ',result,table,_time,_value\n' + pts.map((p) => `,_result,0,${new Date(p.t).toISOString()},${p.value}`).join('\n') + '\n';

describe('Datenspeicher', () => {
  it('meldet einen Ausfall und lädt danach von selbst, ohne Neuladen der Seite', async () => {
    let up = false;
    const h = harness('2026-06-10T10:00:00Z', async (flux) => {
      if (!up) throw new Error('down');
      return flux.includes('total_yield') ? csv([{ t: Date.parse('2026-06-10T09:59:00Z'), value: 1000 }]) : csv(syntheticPoints('2026-06-01', 9, () => 10));
    });
    h.store.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(h.last().failed).toBe(true);
    expect(h.last().year).toBeNull();
    up = true;
    await h.advance(31_000);
    expect(h.last().failed).toBe(false);
    expect(h.last().year!.days.length).toBeGreaterThan(5);
  });

  it('nimmt nach Mitternacht den neuen Tag dazu und lässt den 366. Tag weg', async () => {
    const first = '2025-06-11';
    const h = harness('2026-06-10T21:59:00Z', async (flux) => (flux.includes('total_yield') ? csv([{ t: 0, value: 1 }]) : csv(syntheticPoints(first, 366, () => 10))));
    h.store.start();
    await new Promise((r) => setTimeout(r, 0));
    const before = h.last().year!;
    expect(before.days.at(-1)!.key).toBe('2026-06-10');
    await h.advance(5 * 60_000); // 00:04 Wiener Zeit
    await new Promise((r) => setTimeout(r, 0));
    const after = h.last().year!;
    expect(after.days.at(-1)!.key).toBe('2026-06-11');
    expect(after.days[0].key > before.days[0].key).toBe(true);
  });

  it('liest die Live-Leistung aus dem Live-Kanal', async () => {
    const h = harness('2026-06-10T10:00:00Z', async () => '');
    h.store.start();
    h.sockets[0].onopen?.();
    h.sockets[0].onmessage?.({ data: JSON.stringify({ type: 'pv', data: { pv_power_kw: 42.3, load_power_kw: 10, grid_power_kw: 32.3, battery_power_kw: 0 } }) });
    expect(h.last().live?.kw).toBeCloseTo(42.3, 5);
  });
});

describe('Nächtliches Neuladen', () => {
  it('um 03:30 Wiener Zeit', () => {
    expect(msUntilReload(new Date('2026-11-03T02:00:00Z'))).toBe(30 * 60_000);
    expect(msUntilReload(new Date('2026-11-03T03:00:00Z'))).toBe(23.5 * 3_600_000);
  });
});
