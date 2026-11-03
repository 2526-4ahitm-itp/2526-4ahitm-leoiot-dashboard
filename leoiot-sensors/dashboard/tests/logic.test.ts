import { describe, expect, it } from 'vitest';
import { parseAnnotatedCsv } from '../src/core/csv';
import { historyQuery, latestQuery } from '../src/core/flux';
import { makeFormat } from '../src/core/format';
import { texts, LANGS } from '../src/core/i18n';
import { liveTopic, liveUrl, parseLiveMessage } from '../src/core/live';
import { rangeBounds } from '../src/core/ranges';
import { applyLive, EMPTY_SNAPSHOT, parseHistory, parseLatest, type Snapshot } from '../src/core/snapshot';
import { deriveRoomView } from '../src/core/view';
import { startFeed } from '../src/data/feed';
import { fixture, FakeMqtt, FakeTimers, vienna } from './helpers';

const snap = (co2: number | undefined, at: number, extra: Partial<Snapshot['samples']> = {}, source: 'sensor' | 'simulated' = 'sensor'): Snapshot => ({
  samples: { ...(co2 === undefined ? {} : { co2: { value: co2, at } }), ...extra },
  source,
  devices: ['nili3'],
  at,
});
const view = (s: Snapshot, now: number) => deriveRoomView({ snapshot: s, series24h: null, now, status: 'ok' });

describe('room view', () => {
  const at = vienna('10:41');
  it.each([[799, 'good'], [800, 'soon'], [1000, 'soon'], [1001, 'bad']] as const)('%d ppm lights %s', (ppm, air) => {
    expect(view(snap(ppm, at), at + 1000)).toMatchObject({ state: 'live', air });
  });
  it('above the limit since 9:55', () => {
    const series = Array.from({ length: 20 }, (_, i) => ({ t: vienna('09:00') + i * 5 * 60_000, co2: i < 11 ? 600 : 830 }));
    const v = deriveRoomView({ snapshot: snap(868, at), series24h: series, now: at, status: 'ok' });
    expect(v.air).toBe('soon');
    expect(makeFormat('de').time(v.since!.at)).toBe('09:55');
  });
  it('box stops sending: outdated after more than five minutes, values kept, no lamp', () => {
    const last = vienna('10:29');
    const v = view(snap(868, last, { humidity: { value: 40, at: last } }), vienna('10:41'));
    expect(v).toMatchObject({ state: 'stale', air: null });
    expect(v.values.co2).toBe(868);
    expect(view(snap(868, last), last + 5 * 60_000).state).toBe('live');
    expect(view(snap(868, last), last + 5 * 60_000 + 1).state).toBe('stale');
  });
  it('box sends again: back to normal', () => {
    const old = snap(868, vienna('10:29'));
    expect(view(old, vienna('10:41')).state).toBe('stale');
    const fresh = applyLive(old, { room: '105', device: 'nili3', source: 'sensor', ts: vienna('10:41'), co2: 640 });
    expect(view(fresh, vienna('10:41'))).toMatchObject({ state: 'live', air: 'good' });
  });
  it('no CO2 in the last five minutes: no lamp', () => {
    const v = view(snap(undefined, at, { temperature: { value: 21, at }, humidity: { value: 40, at } }), at);
    expect(v).toMatchObject({ state: 'live', air: null, noCo2: true });
    const old = view({ ...snap(900, at - 6 * 60_000, { temperature: { value: 21, at } }), at }, at);
    expect(old).toMatchObject({ state: 'live', air: null, noCo2: true });
  });
  it('unknown quantity is null, never zero', () => {
    expect(view(snap(700, at), at).values).toEqual({ co2: 700, temperature: null, humidity: null });
  });
  it('simulated readings are marked', () => {
    expect(view(snap(700, at, {}, 'simulated'), at).source).toBe('simulated');
  });
  it('no data and invalid room', () => {
    expect(deriveRoomView({ snapshot: EMPTY_SNAPSHOT, series24h: null, now: at, status: 'ok' }).state).toBe('nodata');
    expect(deriveRoomView({ snapshot: EMPTY_SNAPSHOT, series24h: null, now: at, status: 'invalid' }).state).toBe('nodata');
    expect(deriveRoomView({ snapshot: EMPTY_SNAPSHOT, series24h: null, now: at, status: 'loading' }).state).toBe('loading');
  });
});

describe('queries and recorded answers', () => {
  it('latest values from a recorded answer', () => {
    const s = parseLatest(parseAnnotatedCsv(fixture('latest105.csv')));
    expect(s.source).toBe('sensor');
    expect(s.devices).toEqual(['nili3']);
    expect(s.samples.co2?.value).toBe(1070);
    expect(s.samples.temperature?.value).toBe(21.5);
  });
  it('the newest reading decides the source; empty answer is no data', () => {
    expect(parseLatest(parseAnnotatedCsv(fixture('latestE10.csv'))).source).toBe('simulated');
    expect(parseLatest(parseAnnotatedCsv(fixture('latestX99.csv'))).at).toBeNull();
  });
  it('history keeps gaps as null, never zero', () => {
    const pts = parseHistory(parseAnnotatedCsv(fixture('history24h.csv')));
    expect(pts.length).toBe(100);
    const gap = pts.filter((p) => p.t >= Date.parse('2026-11-03T01:45:00Z') && p.t <= Date.parse('2026-11-03T02:35:00Z'));
    expect(gap.length).toBe(11);
    expect(gap.every((p) => p.co2 === null && p.temperature === null && p.humidity === null)).toBe(true);
    expect(pts.some((p) => p.co2 === 0)).toBe(false);
  });
  it('window size per range and the stated range', () => {
    const now = vienna('10:41');
    expect(historyQuery('105', 'sensor', '24h', now)).toContain('every: 5m, fn: mean, createEmpty: true');
    expect(historyQuery('105', 'sensor', '7d', now)).toContain('every: 30m, fn: mean, createEmpty: true');
    const { start, end } = rangeBounds('7d', now);
    const f = makeFormat('de');
    expect(f.window(start, end)).toBe('16.10., 10:41 – 23.10., 10:41');
  });
  it('refuses rooms and sources that could break out of the query', () => {
    expect(() => latestQuery('105" or true')).toThrow();
    expect(() => historyQuery('a/b', 'sensor', '24h', 0)).toThrow();
    expect(() => historyQuery('105', 'x" or true' as never, '24h', 0)).toThrow();
    expect(latestQuery('E10')).toContain('r.room == "E10"');
  });
});

describe('live messages and fallback', () => {
  it('parses the contract message, ignores unknown fields, never turns a missing value into zero', () => {
    const m = parseLiveMessage(JSON.stringify({ room: '105', device: 'nili3', source: 'sensor', ts: 5, co2: 868, extra: 1, humidity: 'x' }), '105');
    expect(m).toEqual({ room: '105', device: 'nili3', source: 'sensor', ts: 5, co2: 868 });
    expect(parseLiveMessage('{"room":"106","source":"sensor","ts":5}', '105')).toBeNull();
    expect(parseLiveMessage('nope', '105')).toBeNull();
  });
  it('topic and address', () => {
    expect(liveTopic('E10')).toBe('leoiot/room-climate/E10');
    expect(() => liveTopic('#')).toThrow();
    expect(liveUrl({ protocol: 'https:', host: 'h.example' })).toBe('wss://h.example/mqtt');
    expect(liveUrl({ protocol: 'http:', host: 'localhost:8092' })).toBe('ws://localhost:8092/mqtt');
  });
  it('polls once a minute while the channel is down and stops when it is back', async () => {
    const mqtt = new FakeMqtt();
    const timers = new FakeTimers();
    let polls = 0;
    const modes: string[] = [];
    const feed = startFeed({ room: '105', connect: () => mqtt, poll: async () => void polls++, onReading: () => {}, onMode: (m) => modes.push(m), timers });
    await Promise.resolve();
    mqtt.emit('connect');
    expect(modes).toEqual(['live']);
    expect(mqtt.subscribed).toEqual(['leoiot/room-climate/105']);
    mqtt.emit('close');
    expect(feed.mode()).toBe('fallback');
    expect(polls).toBe(1);
    timers.advance(120_000);
    expect(polls).toBe(3);
    mqtt.emit('connect');
    expect(feed.mode()).toBe('live');
    timers.advance(120_000);
    expect(polls).toBe(3);
    feed.stop();
  });
  it('falls back when the first connection never completes', async () => {
    const timers = new FakeTimers();
    let polls = 0;
    const feed = startFeed({ room: '105', connect: () => new FakeMqtt(), poll: async () => void polls++, onReading: () => {}, onMode: () => {}, timers });
    await Promise.resolve();
    timers.advance(9000);
    expect(feed.mode()).toBe('fallback');
    expect(polls).toBe(1);
  });
});

describe('texts', () => {
  it('German and English have the same keys', () => {
    const [de, en] = LANGS.map((l) => Object.keys(texts(l)).sort());
    expect(en).toEqual(de);
  });
  it('status sentences', () => {
    expect([texts('de').statusGood, texts('de').statusSoon, texts('de').statusBad]).toEqual(['Luft gut', 'Bald lüften', 'Jetzt lüften']);
    expect([texts('en').statusGood, texts('en').statusSoon, texts('en').statusBad]).toEqual(['Air is fine', 'Air the room soon', 'Air the room now']);
  });
  it('numbers follow the language', () => {
    expect(makeFormat('de').number(21.5, 1)).toBe('21,5');
    expect(makeFormat('en').number(21.5, 1)).toBe('21.5');
  });
});
