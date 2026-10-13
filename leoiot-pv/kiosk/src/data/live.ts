// Live-Kanal (WebSocket): Nachrichten lesen und Verbindung mit Wiederverbindung halten.
import { completeCounters, type Counters, type Power } from '../core/energy';

export type LiveMessage =
  | { kind: 'power'; power: Power; t: number }
  | { kind: 'counters'; counters: Counters; t: number };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Rechnet die Vorzeichen des Live-Kanals in die des Kiosks um (grid > 0 Bezug, battery > 0 entlädt).
 * Im Live-Kanal ist `grid_power_kw` bei Bezug negativ; das zeigt die Bilanz der echten Werte
 * (Verbrauch = Produktion + Bezug + Entladung). Für die Batterie entscheidet dieselbe Bilanz;
 * passt beides gleich gut, gilt wie beim Netz: positiv fließt von der Anlage weg (lädt).
 */
export function livePower(pv: number, load: number, gridRaw: number, batteryRaw: number): Power {
  const grid = gridRaw === 0 ? 0 : -gridRaw;
  const rest = load - pv - grid;
  const discharging = Math.abs(rest - batteryRaw) < Math.abs(rest + batteryRaw);
  const battery = batteryRaw === 0 ? 0 : discharging ? batteryRaw : -batteryRaw;
  return { pv: Math.max(0, pv), load: Math.max(0, load), grid, battery };
}

/** Liest eine Nachricht des Live-Kanals; null bei allem, was keine PV-Daten trägt. */
export function parseLiveMessage(raw: string, receivedAt: number): LiveMessage | null {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(msg) || msg.type !== 'pv' || !isObject(msg.data)) return null;
  const data = msg.data;
  const t = finite(data._ts) ? data._ts : receivedAt;

  // Form A: Momentanleistung in kW
  if (typeof data.pv_power_kw === 'number') {
    const { pv_power_kw: pv, load_power_kw: load, grid_power_kw: grid, battery_power_kw: battery } = data;
    if (!finite(pv) || !finite(load) || !finite(grid) || !finite(battery)) return null;
    return { kind: 'power', power: livePower(pv, load, grid, battery), t };
  }

  // Form B: Tageszähler in kWh, camelCase oder snake_case
  const counters = completeCounters({
    yield: (data.dailyYield ?? data.daily_yield) as number,
    exported: (data.dailyExported ?? data.daily_exported) as number,
    imported: (data.dailyImported ?? data.daily_imported) as number,
    charged: (data.dailyCharged ?? data.daily_charged) as number,
    discharged: (data.dailyDischarged ?? data.daily_discharged) as number,
  });
  return counters === null ? null : { kind: 'counters', counters, t };
}

export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close(): void;
}

export const RECONNECT_MIN_MS = 1000;
export const RECONNECT_MAX_MS = 60_000;
export const SILENCE_MS = 3 * 60_000;

export interface LiveOptions {
  /** Adressen in Reihenfolge; kommt eine Verbindung nicht zustande, ist die nächste dran. */
  urls: string[];
  onMessage(msg: LiveMessage): void;
  onStatus(connected: boolean): void;
  createSocket?: (url: string) => SocketLike;
}

export function createLiveClient(opts: LiveOptions): { start(): void; stop(): void } {
  const create = opts.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  let started = false;
  let stopped = false;
  let socket: SocketLike | null = null;
  let delay = RECONNECT_MIN_MS;
  let urlIndex = 0;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function armSilence(s: SocketLike): void {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      try {
        s.close();
      } catch {
        // egal, die Verbindung gilt trotzdem als geschlossen
      }
      closed(s, true);
    }, SILENCE_MS);
  }

  // Gemeinsamer Teil nach dem Ende einer Verbindung
  function afterClose(): void {
    clearTimeout(silenceTimer);
    opts.onStatus(false);
    reconnectTimer = setTimeout(connect, delay);
    delay = Math.min(delay * 2, RECONNECT_MAX_MS);
  }

  // Pro Socket nur einmal behandeln
  function closed(s: SocketLike, opened: boolean): void {
    if (stopped || socket !== s) return;
    socket = null;
    if (!opened) urlIndex = (urlIndex + 1) % opts.urls.length;
    s.onopen = s.onmessage = s.onclose = s.onerror = null;
    afterClose();
  }

  function connect(): void {
    if (stopped) return;
    let s: SocketLike;
    try {
      s = create(opts.urls[urlIndex]);
    } catch {
      urlIndex = (urlIndex + 1) % opts.urls.length;
      afterClose();
      return;
    }
    socket = s;
    let opened = false;
    s.onopen = () => {
      opened = true;
      opts.onStatus(true);
      armSilence(s);
    };
    s.onmessage = (ev) => {
      armSilence(s);
      delay = RECONNECT_MIN_MS;
      if (typeof ev.data !== 'string') return;
      const msg = parseLiveMessage(ev.data, Date.now());
      if (msg !== null) opts.onMessage(msg);
    };
    s.onclose = () => closed(s, opened);
    s.onerror = () => {
      // es folgt onclose
    };
  }

  return {
    start() {
      if (started) return;
      started = true;
      connect();
    },
    stop() {
      stopped = true;
      clearTimeout(silenceTimer);
      clearTimeout(reconnectTimer);
      const s = socket;
      socket = null;
      if (s) {
        s.onopen = s.onmessage = s.onclose = s.onerror = null;
        s.close();
      }
    },
  };
}
