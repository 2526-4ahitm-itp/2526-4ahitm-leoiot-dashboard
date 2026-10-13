import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLiveClient, livePower, parseLiveMessage, RECONNECT_MAX_MS, RECONNECT_MIN_MS, type SocketLike } from '../src/data/live';

const SPEC = { yield: 746.2, exported: 0, imported: 207, charged: 82.4, discharged: 141.2 };

const FORM_A =
  '{"type":"pv","data":{"pv_power_kw":12.5,"load_power_kw":8,"grid_power_kw":4.5,"battery_power_kw":0,"daily_pv_kwh":50,"_ts":1000}}';

describe('parseLiveMessage', () => {
  it('liest Form A (Momentanleistung)', () => {
    expect(parseLiveMessage(FORM_A, 5)).toEqual({
      kind: 'power',
      power: { pv: 12.5, load: 8, grid: -4.5, battery: 0 },
      t: 1000,
    });
  });

  it('liest Form B in camelCase und snake_case', () => {
    const camel = JSON.stringify({
      type: 'pv',
      data: {
        dailyYield: 746.2,
        dailyExported: 0,
        dailyImported: 207,
        dailyCharged: 82.4,
        dailyDischarged: 141.2,
        _ts: 2000,
      },
    });
    const snake = JSON.stringify({
      type: 'pv',
      data: {
        daily_yield: 746.2,
        daily_exported: 0,
        daily_imported: 207,
        daily_charged: 82.4,
        daily_discharged: 141.2,
        _ts: 2000,
      },
    });
    expect(parseLiveMessage(camel, 5)).toEqual({ kind: 'counters', counters: SPEC, t: 2000 });
    expect(parseLiveMessage(snake, 5)).toEqual({ kind: 'counters', counters: SPEC, t: 2000 });
  });

  it('nimmt ohne _ts die Empfangszeit', () => {
    const raw = '{"type":"pv","data":{"pv_power_kw":1,"load_power_kw":1,"grid_power_kw":0,"battery_power_kw":0}}';
    expect(parseLiveMessage(raw, 777)?.t).toBe(777);
  });

  it('ergibt null bei allem ohne PV-Daten', () => {
    expect(parseLiveMessage('{"type":"hello","wsPort":8090}', 1)).toBeNull();
    expect(parseLiveMessage('kein json', 1)).toBeNull();
    expect(
      parseLiveMessage(
        '{"type":"pv","data":{"pv_power_kw":1,"load_power_kw":1,"battery_power_kw":0,"_ts":1}}',
        1,
      ),
    ).toBeNull();
    expect(
      parseLiveMessage(
        '{"type":"pv","data":{"dailyYield":1,"dailyExported":0,"dailyImported":1,"dailyDischarged":1}}',
        1,
      ),
    ).toBeNull();
    expect(parseLiveMessage('{"type":"pv"}', 1)).toBeNull();
  });
});

describe('livePower', () => {
  it('negatives grid_power_kw ist Bezug (Werte vom 2026-10-07)', () => {
    expect(livePower(0.11, 48.48, -48.37, 0)).toEqual({ pv: 0.11, load: 48.48, grid: 48.37, battery: 0 });
  });

  it('positives grid_power_kw ist Einspeisung', () => {
    expect(livePower(60, 20, 40, 0).grid).toBe(-40);
  });

  it('nimmt das Vorzeichen der Batterie aus der Bilanz', () => {
    // Verbrauch 30 = Produktion 5 + Bezug 10 + Entladung 15
    expect(livePower(5, 30, -10, 15).battery).toBe(15);
    expect(livePower(5, 30, -10, -15).battery).toBe(15);
    // Verbrauch 20 = Produktion 50 - Einspeisung 10 - Ladung 20
    expect(livePower(50, 20, 10, 20).battery).toBe(-20);
    expect(livePower(50, 20, 10, -20).battery).toBe(-20);
  });

  it('ohne klare Bilanz gilt positiv als Laden', () => {
    expect(livePower(10, 10, 0, 5).battery).toBe(-5);
  });

  it('liefert kein negatives Null', () => {
    const p = livePower(1, 1, 0, 0);
    expect(Object.is(p.grid, 0)).toBe(true);
    expect(Object.is(p.battery, 0)).toBe(true);
  });
});

describe('createLiveClient', () => {
  let sockets: SocketLike[];
  let onStatus: ReturnType<typeof vi.fn>;
  let onMessage: ReturnType<typeof vi.fn>;

  let urls: string[];
  const createSocket = (url: string): SocketLike => {
    const s: SocketLike = { onopen: null, onmessage: null, onclose: null, onerror: null, close: vi.fn() };
    sockets.push(s);
    urls.push(url);
    return s;
  };
  const make = (list = ['ws://x/ws']) => createLiveClient({ urls: list, onMessage, onStatus, createSocket });
  const last = (): SocketLike => sockets[sockets.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    urls = [];
    onStatus = vi.fn();
    onMessage = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start erzeugt einen Socket, onopen meldet true', () => {
    const c = make();
    c.start();
    c.start();
    expect(sockets).toHaveLength(1);
    sockets[0].onopen?.();
    expect(onStatus).toHaveBeenCalledWith(true);
    c.stop();
  });

  it('verbindet mit wachsendem Abstand neu', () => {
    const c = make();
    c.start();
    sockets[0].onclose?.();
    expect(onStatus).toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1].onclose?.();
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2].onclose?.();
    vi.advanceTimersByTime(3999);
    expect(sockets).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(4);
    c.stop();
  });

  it('eine Nachricht setzt den Abstand zurück', () => {
    const c = make();
    c.start();
    sockets[0].onclose?.();
    vi.advanceTimersByTime(1000);
    sockets[1].onclose?.();
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);
    last().onopen?.();
    last().onmessage?.({ data: '{"type":"hello"}' });
    last().onclose?.();
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(4);
    c.stop();
  });

  it('begrenzt den Abstand auf 60 Sekunden', () => {
    const c = make();
    c.start();
    for (let i = 0; i < 9; i++) {
      last().onclose?.();
      vi.advanceTimersByTime(60_000);
    }
    expect(sockets).toHaveLength(10);
    last().onclose?.();
    vi.advanceTimersByTime(59_999);
    expect(sockets).toHaveLength(10);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(11);
    c.stop();
  });

  it('schließt bei Stille und verbindet neu', () => {
    const c = make();
    c.start();
    sockets[0].onopen?.();
    vi.advanceTimersByTime(3 * 60_000);
    expect(sockets[0].close).toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    c.stop();
  });

  it('eine Nachricht verschiebt die Stille-Frist', () => {
    const c = make();
    c.start();
    sockets[0].onopen?.();
    vi.advanceTimersByTime(2 * 60_000);
    sockets[0].onmessage?.({ data: '{"type":"hello"}' });
    vi.advanceTimersByTime(60_000);
    expect(sockets[0].close).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith(false);
    c.stop();
  });

  it('reicht PV-Nachrichten weiter, hello nicht', () => {
    const c = make();
    c.start();
    sockets[0].onopen?.();
    sockets[0].onmessage?.({ data: '{"type":"hello"}' });
    expect(onMessage).not.toHaveBeenCalled();
    sockets[0].onmessage?.({ data: FORM_A });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0].kind).toBe('power');
    c.stop();
  });

  it('wechselt die Adresse, wenn keine Verbindung zustande kommt', () => {
    const c = make(['ws://x/kiosk/ws', 'ws://x/ws']);
    c.start();
    last().onclose?.();
    vi.advanceTimersByTime(RECONNECT_MIN_MS);
    expect(urls).toEqual(['ws://x/kiosk/ws', 'ws://x/ws']);
    last().onclose?.();
    vi.advanceTimersByTime(RECONNECT_MIN_MS * 2);
    expect(urls).toEqual(['ws://x/kiosk/ws', 'ws://x/ws', 'ws://x/kiosk/ws']);
    c.stop();
  });

  it('bleibt bei einer Adresse, die schon verbunden war', () => {
    const c = make(['ws://x/kiosk/ws', 'ws://x/ws']);
    c.start();
    last().onclose?.();
    vi.advanceTimersByTime(RECONNECT_MIN_MS);
    last().onopen?.();
    last().onclose?.();
    vi.advanceTimersByTime(RECONNECT_MAX_MS);
    expect(urls).toEqual(['ws://x/kiosk/ws', 'ws://x/ws', 'ws://x/ws']);
    c.stop();
  });

  it('stop schließt und verhindert Wiederverbindung', () => {
    const c = make();
    c.start();
    const s = sockets[0];
    const onclose = s.onclose;
    c.stop();
    expect(s.close).toHaveBeenCalled();
    onclose?.();
    s.onclose?.();
    vi.advanceTimersByTime(5 * 60_000);
    expect(sockets).toHaveLength(1);
  });
});
