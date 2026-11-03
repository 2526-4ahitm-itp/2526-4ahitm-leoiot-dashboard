// Hält die Daten des Films aktuell: Jahr beim Start, heute alle fünf Minuten, Gesamtertrag jede Minute, Live-Leistung laufend.
import { createLiveClient, type LiveMessage, type SocketLike } from '@leoiot-pv/shared/live';
import { addDays, dayRange, viennaDayStart } from '@leoiot-pv/shared/time';
import { buildYear, parseYield, type Year, type YieldPoint } from '../core/yearData';
import { totalQuery, yieldQuery } from './queries';

export const DAYS = 365;
export const TODAY_EVERY_MS = 5 * 60_000;
export const TOTAL_EVERY_MS = 60_000;
export const RETRY_MS = 30_000;

export interface Snapshot {
  year: Year | null;
  total: number | null; // jüngster Gesamtertrag in kWh
  live: { kw: number; t: number } | null; // jüngste Momentanleistung, t = Empfangszeit
  failed: boolean; // die Datenquelle hat zuletzt nicht geantwortet
}

export interface StoreDeps {
  query(flux: string): Promise<string>;
  now(): Date;
  liveUrls: string[];
  createSocket?: (url: string) => SocketLike;
  setTimer?: (fn: () => void, ms: number) => unknown;
  onChange(s: Snapshot): void;
}

export function createStore(deps: StoreDeps): { start(): void; snapshot(): Snapshot } {
  const timer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  let points: YieldPoint[] = [];
  let loadedFor = ''; // Tag, bis zu dem das Jahr geladen ist
  const snap: Snapshot = { year: null, total: null, live: null, failed: false };
  const changed = () => deps.onChange({ ...snap });

  const range = () => {
    const today = dayRange(deps.now());
    return { first: addDays(today.key, -(DAYS - 1)), today };
  };

  function rebuild(): void {
    const { first, today } = range();
    snap.year = buildYear(points, first, today.key);
  }

  async function loadYear(): Promise<void> {
    const { first, today } = range();
    try {
      points = parseYield(await deps.query(yieldQuery(viennaDayStart(first), today.end)));
      loadedFor = today.key;
      snap.failed = false;
      rebuild();
      changed();
      timer(loadToday, TODAY_EVERY_MS);
    } catch {
      snap.failed = true;
      changed();
      timer(loadYear, RETRY_MS);
    }
  }

  async function loadToday(): Promise<void> {
    const { today } = range();
    if (today.key !== loadedFor) { void loadYear(); return; } // neuer Tag: alles neu, der älteste Tag fällt weg
    try {
      const fresh = parseYield(await deps.query(yieldQuery(today.start, today.end)));
      const from = today.start.getTime();
      points = points.filter((p) => p.t < from).concat(fresh);
      snap.failed = false;
      rebuild();
      changed();
    } catch {
      snap.failed = true;
      changed();
    }
    timer(loadToday, TODAY_EVERY_MS);
  }

  async function loadTotal(): Promise<void> {
    try {
      const rows = parseYield(await deps.query(totalQuery()));
      if (rows.length > 0) { snap.total = rows[rows.length - 1].value; changed(); }
    } catch {
      // der Live-Kanal oder die nächste Abfrage liefert ihn
    }
    timer(loadTotal, TOTAL_EVERY_MS);
  }

  function onLive(msg: LiveMessage): void {
    if (msg.kind === 'power') snap.live = { kw: msg.power.pv, t: deps.now().getTime() };
    changed();
  }

  return {
    start() {
      void loadYear();
      void loadTotal();
      createLiveClient({ urls: deps.liveUrls, onMessage: onLive, onStatus: () => {}, createSocket: deps.createSocket }).start();
    },
    snapshot: () => ({ ...snap }),
  };
}
