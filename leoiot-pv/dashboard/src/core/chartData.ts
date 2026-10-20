// Zahlenreihen für die Diagramme (reine Funktionen, ohne Chart.js).
import type { PowerPoint } from '@leoiot-pv/shared/influx';
import { SLOT_MS, viennaTime } from '@leoiot-pv/shared/time';
import { dateLong, monthLabel, monthShort, TEXT, weekdayShort, type Lang } from './i18n';
import { quantities, type DayRow, type MonthRow } from './periods';
import type { View } from './route';

export type SeriesKey = 'prod' | 'cons' | 'imp' | 'exp';

export interface Series {
  key: SeriesKey;
  data: (number | null)[];
}

export interface DayModel {
  kind: 'line';
  labels: string[]; // Uhrzeit je 5-Minuten-Fenster
  series: Series[]; // gleitender Mittelwert über 15 Minuten
  raw: Series[]; // Werte je 5-Minuten-Fenster (Grundlage der Stundenmittel in der Tabelle)
}

export interface BarModel {
  kind: 'bar';
  labels: string[];
  titles: string[]; // Überschrift je Balken im Tooltip und in der Tabelle
  marks: string[][]; // Hinweise je Balken ("keine Daten", "noch nicht abgeschlossen")
  keys: string[]; // Schlüssel zum Hineinspringen: Tag bzw. erster Tag des Monats
  gaps: boolean[]; // Tag bzw. Monat ganz ohne Daten (vergangen)
  series: Series[];
}

export type ChartModel = DayModel | BarModel;

/** Gleitender Mittelwert über drei Fenster (15 Minuten), zentriert; Lücken bleiben Lücken und werden nicht überbrückt, an Rändern zählen die vorhandenen Fenster. */
export function smoothPower(data: (number | null)[]): (number | null)[] {
  return data.map((v, i) => {
    if (v === null) return null;
    let sum = v;
    let n = 1;
    for (const j of [i - 1, i + 1]) {
      const w = data[j];
      if (w !== undefined && w !== null) {
        sum += w;
        n++;
      }
    }
    return sum / n;
  });
}

/** Tageskurve in kW je 5-Minuten-Fenster; null nach dem Jetzt, in Lücken und wo nichts gespeichert ist. */
export function dayModel(power: PowerPoint[], dayStart: number, slots: number, now: number): DayModel {
  const prod: (number | null)[] = new Array(slots).fill(null);
  const cons: (number | null)[] = new Array(slots).fill(null);
  for (const p of power) {
    const i = Math.floor((p.t - dayStart) / SLOT_MS);
    if (i < 0 || i >= slots || p.t > now) continue;
    prod[i] = p.production;
    cons[i] = p.consumption;
  }
  const labels = Array.from({ length: slots }, (_, i) => viennaTime(new Date(dayStart + i * SLOT_MS)));
  const raw: Series[] = [{ key: 'prod', data: prod }];
  if (cons.some((v) => v !== null)) raw.push({ key: 'cons', data: cons });
  return { kind: 'line', labels, series: raw.map((s) => ({ key: s.key, data: smoothPower(s.data) })), raw };
}

const BAR_KEYS: SeriesKey[] = ['prod', 'cons', 'imp', 'exp'];
const pick = (q: ReturnType<typeof quantities>, k: SeriesKey): number | null => q[k];

/** Balken je Tag (Woche, Monat); künftige Tage und Tage ohne Wert sind leer (null). */
export function dayBars(rows: DayRow[], view: View, lang: Lang): BarModel {
  const L = TEXT[lang];
  const per = rows.map((r) => (r.future || r.gap ? quantities(null) : quantities(r.counters)));
  return {
    kind: 'bar',
    labels: rows.map((r) => (view === 'week' ? `${weekdayShort(r.key, lang)} ${Number(r.key.slice(8))}` : String(Number(r.key.slice(8))))),
    titles: rows.map((r) => dateLong(r.key, lang)),
    marks: rows.map((r, i) => {
      const m: string[] = [];
      if (r.gap) m.push(L.noData + ': ' + L.gapDay);
      else if (!r.future && per[i].cons === null) m.push(L.noDataBefore);
      if (r.today) m.push(L.notFinished);
      return m;
    }),
    keys: rows.map((r) => r.key),
    gaps: rows.map((r) => r.gap && !r.future),
    series: BAR_KEYS.map((key) => ({ key, data: per.map((q) => pick(q, key)) })),
  };
}

/** Balken je Monat (Jahr); künftige Monate sind leer. */
export function monthBars(months: MonthRow[], lang: Lang): BarModel {
  const L = TEXT[lang];
  return {
    kind: 'bar',
    labels: months.map((m) => monthShort(m.month, lang)),
    titles: months.map((m) => monthLabel(m.firstKey, lang)),
    marks: months.map((m) => (m.current ? [L.notFinished] : [])),
    keys: months.map((m) => m.firstKey),
    gaps: months.map((m) => !m.future && !m.current && m.totals.pastDays > 0 && Object.values(m.totals.sum).every((v) => v === null)),
    series: BAR_KEYS.map((key) => ({
      key,
      data: months.map((m) => (m.future || m.totals.pastDays === 0 ? null : m.totals.sum[key])),
    })),
  };
}

/** Stundenmittel der Tageskurve in kW (Tabelle); null, wenn in der Stunde kein Wert vorliegt. */
export function hourlyMeans(model: DayModel): { label: string; values: (number | null)[] }[] {
  const out: { label: string; values: (number | null)[] }[] = [];
  const n = model.labels.length;
  for (let from = 0; from < n; from += 12) {
    const values = model.raw.map((s) => {
      const part = s.data.slice(from, from + 12).filter((v): v is number => v !== null);
      return part.length === 0 ? null : part.reduce((a, b) => a + b, 0) / part.length;
    });
    out.push({ label: model.labels[from], values });
  }
  // Stunden nach dem letzten Wert entfallen
  while (out.length > 0 && out[out.length - 1].values.every((v) => v === null)) out.pop();
  return out;
}
