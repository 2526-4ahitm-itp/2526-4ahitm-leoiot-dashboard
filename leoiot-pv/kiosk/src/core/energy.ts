// Reine Rechenfunktionen für die Energiedaten (Tageszähler in kWh).

/** Tageszähler in kWh. */
export interface Counters {
  yield: number; // Produktion
  exported: number; // Einspeisung ins Netz
  imported: number; // Bezug vom Netz
  charged: number; // in die Batterie geladen
  discharged: number; // aus der Batterie entladen
}
export type PartialCounters = Partial<Counters>;

export const COUNTER_KEYS = ['yield', 'exported', 'imported', 'charged', 'discharged'] as const;

/** Herkunft bestimmt die Farbe. */
export type Source = 'pv' | 'verbrauch' | 'netz' | 'batterie';

// Nur endliche, positive Werte zählen; alles andere ist 0.
function pos(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Vollständige Zähler oder null, wenn ein Feld fehlt oder keine endliche Zahl ist. */
export function completeCounters(p: PartialCounters | null | undefined): Counters | null {
  if (!p) return null;
  for (const k of COUNTER_KEYS) {
    const v = p[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  }
  return {
    yield: p.yield as number,
    exported: p.exported as number,
    imported: p.imported as number,
    charged: p.charged as number,
    discharged: p.discharged as number,
  };
}

export function selfConsumption(c: Counters): number {
  return pos(c.yield - c.exported - c.charged);
}

export function consumption(c: Counters): number {
  return selfConsumption(c) + pos(c.imported) + pos(c.discharged);
}

export interface Share {
  id: string;
  label: string;
  source: Source;
  value: number;
}

// Array.prototype.sort ist stabil: bei Gleichstand bleibt die Reihenfolge.
function sortDesc(shares: Share[]): Share[] {
  return shares.sort((a, b) => b.value - a.value);
}

/** Anteile des Donuts "Verbrauch", absteigend nach Wert. */
export function consumptionShares(c: Counters): Share[] {
  return sortDesc([
    { id: 'fromPv', label: 'Von PV', source: 'pv', value: selfConsumption(c) },
    { id: 'fromGrid', label: 'Vom Netz', source: 'netz', value: pos(c.imported) },
    { id: 'fromBattery', label: 'Von Batterie', source: 'batterie', value: pos(c.discharged) },
  ]);
}

/** Anteile des Donuts "Produktion", absteigend nach Wert. */
export function productionShares(c: Counters): Share[] {
  return sortDesc([
    { id: 'self', label: 'Eigenverbrauch', source: 'pv', value: selfConsumption(c) },
    { id: 'toGrid', label: 'Ins Netz', source: 'netz', value: pos(c.exported) },
    { id: 'toBattery', label: 'In Batterie', source: 'batterie', value: pos(c.charged) },
  ]);
}

export interface DayValues {
  key: string; // 'YYYY-MM-DD'
  production: number | null;
  consumption: number | null;
  exported: number | null;
}

function finiteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Werte der Wochenübersicht für die gegebenen Tage in derselben Reihenfolge. */
export function weekValues(
  keys: string[],
  byDay: Record<string, PartialCounters | undefined>,
): DayValues[] {
  return keys.map((key) => {
    const p = byDay[key];
    if (!p) return { key, production: null, consumption: null, exported: null };
    const c = completeCounters(p);
    return {
      key,
      production: finiteOrNull(p.yield),
      // Unvollständige (nachgetragene) Tage: Verbrauch unbekannt.
      consumption: c ? consumption(c) : null,
      exported: finiteOrNull(p.exported),
    };
  });
}

/** Momentanleistung in kW. grid > 0 Bezug, < 0 Einspeisung; battery > 0 entlädt, < 0 lädt. */
export interface Power {
  pv: number;
  load: number;
  grid: number;
  battery: number;
}

/** Mittlere Leistung zwischen zwei Zählerständen; null, wenn hours <= 0 oder ein Zähler gefallen ist. */
export function powerBetween(prev: Counters, next: Counters, hours: number): Power | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const d = {} as Counters;
  for (const k of COUNTER_KEYS) {
    const diff = next[k] - prev[k];
    if (!Number.isFinite(diff) || diff < -0.05) return null; // Zähler-Reset
    d[k] = diff < 0 ? 0 : diff; // kleine Rückgänge zählen als 0
  }
  return {
    pv: d.yield / hours,
    grid: (d.imported - d.exported) / hours,
    battery: (d.discharged - d.charged) / hours,
    load: consumption(d) / hours,
  };
}
