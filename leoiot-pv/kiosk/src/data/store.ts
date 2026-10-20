// Zustand des Kiosks: Abrufe, Wiederholungen, Tageswechsel und Live-Daten.
import { completeCounters, type PartialCounters, type Power } from '@leoiot-pv/shared/energy';
import { parseToday, parseWeek, todayQuery, validRows, weekQuery, type CounterRow } from '@leoiot-pv/shared/influx';
import { SLOT_MS, addDays, dayRange, weekRange } from '@leoiot-pv/shared/time';
import type { LiveMessage } from '@leoiot-pv/shared/live';

export type Status = 'loading' | 'ok' | 'empty' | 'error';

export interface KioskState {
  dayKey: string; // heutiger Wiener Tag
  dayStart: number; // ms
  dayEnd: number; // ms
  weekKeys: string[]; // sieben Tage, der letzte ist heute
  rows: CounterRow[]; // bereinigte Zählerstände von heute, aufsteigend
  todayStatus: Status;
  week: Record<string, PartialCounters>;
  weekStatus: Status;
  lastDataAt: number | null; // Messzeit des jüngsten Zählerstands
  livePower: { power: Power; t: number } | null;
  liveConnected: boolean;
}

export const TODAY_MS = 60_000; // Abruf heute
export const WEEK_MS = 5 * 60_000; // Abruf Woche
export const TODAY_RETRY_MS = 15_000; // solange heute nicht 'ok' ist
export const WEEK_RETRY_MS = 30_000; // solange die Woche nicht 'ok' ist
export const DAY_CHECK_MS = 10_000; // Prüfung auf Tageswechsel
export const EARLY_MS = 15 * 60_000; // Tagesanfang, in dem ein noch nicht zurückgesetzter Zähler als 0 gilt

export interface KioskDeps {
  query(flux: string): Promise<string>; // liefert CSV, wirft bei Fehler
  now(): number;
}

export interface Kiosk {
  getState(): KioskState;
  subscribe(listener: (state: KioskState) => void): () => void;
  start(): void;
  stop(): void;
  handleLive(msg: LiveMessage): void;
  setLiveConnected(connected: boolean): void;
}

export function createKiosk(deps: KioskDeps): Kiosk {
  const listeners = new Set<(state: KioskState) => void>();
  let rawRows: CounterRow[] = [];
  let stopped = false;
  let todayTimer: ReturnType<typeof setTimeout> | undefined;
  let weekTimer: ReturnType<typeof setTimeout> | undefined;
  let dayTimer: ReturnType<typeof setInterval> | undefined;

  function dayFields(): Pick<KioskState, 'dayKey' | 'dayStart' | 'dayEnd' | 'weekKeys'> {
    const at = new Date(deps.now());
    const day = dayRange(at);
    return {
      dayKey: day.key,
      dayStart: day.start.getTime(),
      dayEnd: day.end.getTime(),
      weekKeys: weekRange(at).keys,
    };
  }

  let state: KioskState = {
    ...dayFields(),
    rows: [],
    todayStatus: 'loading',
    week: {},
    weekStatus: 'loading',
    lastDataAt: null,
    livePower: null,
    liveConnected: false,
  };

  // Neues Zustandsobjekt bilden und Abonnenten benachrichtigen
  function update(patch: Partial<KioskState>): void {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l(state);
  }

  // Bereinigte Zeilen und Messzeit aus rawRows und Vortag
  function recompute(week: Record<string, PartialCounters> = state.week): Pick<KioskState, 'rows' | 'lastDataAt'> {
    const yesterday = completeCounters(week[addDays(state.dayKey, -1)]);
    let rows = validRows(rawRows, new Date(state.dayStart), yesterday);
    if (rawRows.length > 0 && rows.length === 0 && deps.now() < state.dayStart + EARLY_MS) {
      // Die Quelle lebt, der Zähler ist nur noch nicht zurückgesetzt
      rows = [{ t: state.dayStart, counters: { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 } }];
    }
    const lastDataAt = rawRows.length > 0 ? Math.max(...rawRows.map((r) => r.t)) : state.lastDataAt;
    return { rows, lastDataAt };
  }

  async function loadToday(): Promise<void> {
    const key = state.dayKey;
    let csv: string | null = null;
    try {
      csv = await deps.query(todayQuery(new Date(state.dayStart), new Date(state.dayEnd)));
    } catch {
      csv = null;
    }
    if (stopped || state.dayKey !== key) return;
    if (csv === null) {
      if (rawRows.length === 0) update({ todayStatus: 'error' });
    } else {
      const parsed = parseToday(csv);
      if (parsed.length === 0) {
        if (rawRows.length === 0) update({ todayStatus: 'empty' });
      } else {
        const maxT = parsed[parsed.length - 1].t;
        // Jüngere Stände vom Live-Kanal behalten; je 5-Minuten-Fenster zählt der jüngste Stand
        const merged = [...parsed];
        for (const r of rawRows) {
          if (r.t <= maxT) continue;
          const last = merged[merged.length - 1];
          if (Math.floor(last.t / SLOT_MS) === Math.floor(r.t / SLOT_MS)) merged[merged.length - 1] = r;
          else merged.push(r);
        }
        rawRows = merged;
        const r = recompute();
        update({ ...r, todayStatus: r.rows.length > 0 ? 'ok' : 'empty' });
      }
    }
    clearTimeout(todayTimer);
    todayTimer = setTimeout(() => void loadToday(), state.todayStatus === 'ok' ? TODAY_MS : TODAY_RETRY_MS);
  }

  async function loadWeek(): Promise<void> {
    const key = state.dayKey;
    let csv: string | null = null;
    try {
      const range = weekRange(new Date(deps.now()));
      csv = await deps.query(weekQuery(range.start, new Date(state.dayEnd)));
    } catch {
      csv = null;
    }
    if (stopped || state.dayKey !== key) return;
    if (csv === null) {
      if (Object.keys(state.week).length === 0) update({ weekStatus: 'error' });
    } else {
      const parsed = parseWeek(csv);
      if (Object.keys(parsed).length === 0) {
        if (Object.keys(state.week).length === 0) update({ weekStatus: 'empty' });
      } else {
        // Der Vortag kann sich geändert haben
        const r = recompute(parsed);
        const patch: Partial<KioskState> = { ...r, week: parsed, weekStatus: 'ok' };
        if (state.todayStatus !== 'loading' && state.todayStatus !== 'error') {
          patch.todayStatus = r.rows.length > 0 ? 'ok' : 'empty';
        }
        update(patch);
      }
    }
    clearTimeout(weekTimer);
    weekTimer = setTimeout(() => void loadWeek(), state.weekStatus === 'ok' ? WEEK_MS : WEEK_RETRY_MS);
  }

  function checkDay(): void {
    if (dayRange(new Date(deps.now())).key === state.dayKey) return;
    rawRows = [];
    update({ ...dayFields(), rows: [], todayStatus: 'loading', livePower: null });
    clearTimeout(todayTimer);
    clearTimeout(weekTimer);
    void loadToday();
    void loadWeek();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      stopped = false;
      void loadToday();
      void loadWeek();
      clearInterval(dayTimer);
      dayTimer = setInterval(checkDay, DAY_CHECK_MS);
    },
    stop() {
      stopped = true;
      clearTimeout(todayTimer);
      clearTimeout(weekTimer);
      clearInterval(dayTimer);
    },
    handleLive(msg) {
      if (msg.kind === 'power') {
        if (state.livePower === null || msg.t >= state.livePower.t) {
          update({ livePower: { power: msg.power, t: msg.t } });
        }
        return;
      }
      if (msg.t < state.dayStart || msg.t >= state.dayEnd) return;
      if (rawRows.some((r) => r.t > msg.t)) return;
      const row: CounterRow = { t: msg.t, counters: msg.counters };
      const last = rawRows[rawRows.length - 1];
      if (last && Math.floor(last.t / SLOT_MS) === Math.floor(msg.t / SLOT_MS)) {
        rawRows = [...rawRows.slice(0, -1), row];
      } else {
        rawRows = [...rawRows, row];
      }
      const r = recompute();
      update({ ...r, todayStatus: r.rows.length > 0 ? 'ok' : state.todayStatus });
    },
    setLiveConnected(connected) {
      if (state.liveConnected === connected) return;
      update({ liveConnected: connected });
    },
  };
}
