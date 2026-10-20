// Summen, Lücken und Kennzahlen je Zeitraum (reine Funktionen, siehe Design D6/D7).
import { COUNTER_KEYS, completeCounters, consumption, selfConsumption, type PartialCounters } from '@leoiot-pv/shared/energy';

export interface DayRow {
  key: string;
  counters: PartialCounters | null;
  future: boolean;
  today: boolean;
  finished: boolean;
  gap: boolean; // vergangener Tag ohne einen einzigen Wert
}

/** Größen in kWh; null = unbekannt (nie 0). */
export interface Quantities {
  prod: number | null;
  exp: number | null;
  chg: number | null;
  imp: number | null;
  dis: number | null;
  self: number | null;
  cons: number | null;
}

const FIELDS: (keyof Quantities)[] = ['prod', 'exp', 'chg', 'imp', 'dis', 'self', 'cons'];

const num = (v: number | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Größen eines Tages; Eigenverbrauch und Verbrauch nur bei allen fünf Zählern. */
export function quantities(c: PartialCounters | null): Quantities {
  const full = completeCounters(c);
  return {
    prod: num(c?.yield),
    exp: num(c?.exported),
    chg: num(c?.charged),
    imp: num(c?.imported),
    dis: num(c?.discharged),
    self: full ? selfConsumption(full) : null,
    cons: full ? consumption(full) : null,
  };
}

/** Zeilen für die gegebenen Tage in derselben Reihenfolge. */
export function dayRows(days: string[], byDay: Record<string, PartialCounters>, todayKey: string): DayRow[] {
  return days.map((key) => {
    const counters = byDay[key] ?? null;
    const future = key > todayKey;
    const hasValue = counters !== null && COUNTER_KEYS.some((k) => num(counters[k]) !== null);
    return { key, counters, future, today: key === todayKey, finished: key < todayKey, gap: !future && !hasValue };
  });
}

export interface Ratios {
  autarky: number | null;
  selfRate: number | null;
}

/** Autarkie = (Verbrauch − Vom Netz) / Verbrauch; Eigenverbrauchsquote = (Produktion − Ins Netz) / Produktion. */
export function ratios(q: Quantities): Ratios {
  const autarky = q.cons !== null && q.imp !== null && q.cons > 0 ? (q.cons - q.imp) / q.cons : null;
  const selfRate = q.prod !== null && q.exp !== null && q.prod > 0 ? (q.prod - q.exp) / q.prod : null;
  return { autarky, selfRate };
}

export interface Totals {
  sum: Quantities;
  missing: Record<keyof Quantities, number>;
  ratios: Ratios;
  ratioDays: number;
  ratioFrom: string | null;
  ratioTo: string | null;
  pastDays: number;
}

/** Summen über die Zeilen; künftige Tage zählen nicht, fehlende Werte werden gezählt statt als 0 gerechnet. */
export function totals(rows: DayRow[]): Totals {
  const past = rows.filter((r) => !r.future);
  const sum = {} as Quantities;
  const missing = {} as Record<keyof Quantities, number>;
  const perDay = past.map((r) => quantities(r.gap ? null : r.counters));
  for (const f of FIELDS) {
    let total: number | null = null;
    let miss = 0;
    for (const q of perDay) {
      const v = q[f];
      if (v === null) miss++;
      else total = (total ?? 0) + v;
    }
    sum[f] = total;
    missing[f] = miss;
  }
  // Kennzahlen nur über vollständige Tage, damit Zähler und Nenner dieselben Tage meinen
  const complete = past.filter((_, i) => perDay[i].cons !== null);
  const acc: Quantities = { prod: 0, exp: 0, chg: 0, imp: 0, dis: 0, self: 0, cons: 0 };
  for (const r of complete) {
    const q = quantities(r.counters);
    for (const f of FIELDS) acc[f] = (acc[f] ?? 0) + (q[f] ?? 0);
  }
  return {
    sum,
    missing,
    ratios: complete.length > 0 ? ratios(acc) : { autarky: null, selfRate: null },
    ratioDays: complete.length,
    ratioFrom: complete[0]?.key ?? null,
    ratioTo: complete.length > 0 ? complete[complete.length - 1].key : null,
    pastDays: past.length,
  };
}

export interface MonthRow {
  month: number; // 1..12
  firstKey: string;
  future: boolean;
  current: boolean;
  totals: Totals;
}

/** Zwölf Monatszeilen eines Jahres aus den Tageszeilen. */
export function monthRows(year: number, rows: DayRow[], todayKey: string): MonthRow[] {
  const out: MonthRow[] = [];
  for (let month = 1; month <= 12; month++) {
    const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    out.push({
      month,
      firstKey: prefix + '-01',
      future: prefix + '-01' > todayKey,
      current: todayKey.startsWith(prefix),
      totals: totals(rows.filter((r) => r.key.startsWith(prefix))),
    });
  }
  return out;
}
