// Lücken in den Daten als Bereiche in Worten (reine Funktionen): Hinweis unter dem Diagramm und über dem Zahlenblock.
import { dayMonthLong, rangeText } from './lead';
import { monthName, type Lang } from './i18n';
import { quantities, type DayRow, type Quantities } from './periods';
import type { View } from './route';

export interface Piece {
  /** ohne Verhältniswort: '10. bis 31. August' */
  plain: string;
  /** mit Verhältniswort: 'vom 10. bis 31. August' */
  lead: string;
}

/** Aufeinanderfolgende Tage als Bereiche [von, bis]. */
export function dayRanges(keys: string[]): [string, string][] {
  const out: [string, string][] = [];
  let prev = '';
  for (const k of keys) {
    const last = out[out.length - 1];
    if (last && nextDay(prev) === k) last[1] = k;
    else out.push([k, k]);
    prev = k;
  }
  return out;
}

function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const dayPieces = (keys: string[], lang: Lang): Piece[] =>
  dayRanges(keys).map(([a, b]) => {
    if (a === b) {
      const t = dayMonthLong(a, lang);
      return { plain: t, lead: lang === 'en' ? `on ${t}` : `am ${t}` };
    }
    const t = rangeText(a, b, lang);
    return { plain: t, lead: lang === 'en' ? `from ${t}` : `vom ${t}` };
  });

// Monate ('YYYY-MM'), die ganz ohne Daten sind: alle Tage vergangen und Lücke
function missingMonths(rows: DayRow[]): string[] {
  const byMonth = new Map<string, DayRow[]>();
  for (const r of rows) byMonth.set(r.key.slice(0, 7), [...(byMonth.get(r.key.slice(0, 7)) ?? []), r]);
  return [...byMonth].filter(([, rs]) => rs.every((r) => r.gap)).map(([m]) => m);
}

function monthPieces(months: string[], lang: Lang): Piece[] {
  const out: Piece[] = [];
  let i = 0;
  while (i < months.length) {
    let j = i;
    while (j + 1 < months.length && Number(months[j + 1].slice(5)) === Number(months[j].slice(5)) + 1 && months[j + 1].slice(0, 4) === months[i].slice(0, 4)) j++;
    const a = monthName(Number(months[i].slice(5)), lang);
    const b = monthName(Number(months[j].slice(5)), lang);
    if (i === j) out.push({ plain: a, lead: lang === 'en' ? `in ${a}` : `im ${a}` });
    else out.push({ plain: `${a} ${lang === 'en' ? 'to' : 'bis'} ${b}`, lead: lang === 'en' ? `from ${a} to ${b}` : `von ${a} bis ${b}` });
    i = j + 1;
  }
  return out;
}

/** Bereiche der Tage ohne Daten (vergangene Lückentage); im Jahr ganze Monate als Bereiche, übrige Tage als Anzahl. */
export function gapPieces(rows: DayRow[], view: View, lang: Lang): Piece[] {
  const gaps = rows.filter((r) => r.gap && !r.future);
  if (gaps.length === 0) return [];
  if (view !== 'year') return dayPieces(gaps.map((r) => r.key), lang);
  const months = missingMonths(rows);
  const full = new Set(months);
  const rest = gaps.filter((r) => !full.has(r.key.slice(0, 7)));
  const out = monthPieces(months, lang);
  if (rest.length > 0) {
    const n = rest.length;
    // nach ganzen Monaten heißt es "und 21 weitere Tage", allein "21 Tage"
    const more = out.length > 0;
    out.push(
      lang === 'en'
        ? { plain: `${n} ${more ? 'more ' : ''}${n === 1 ? 'day' : 'days'}`, lead: `on ${n} ${more ? 'more ' : ''}${n === 1 ? 'day' : 'days'}` }
        : { plain: `${n} ${more ? (n === 1 ? 'weiterer ' : 'weitere ') : ''}${n === 1 ? 'Tag' : 'Tage'}`, lead: `an ${n} ${more ? 'weiteren ' : ''}${n === 1 ? 'Tag' : 'Tagen'}` },
    );
  }
  return out;
}

const join = (items: string[], lang: Lang): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${lang === 'en' ? 'and' : 'und'} ${items[items.length - 1]}`;

/** 'Keine Daten vom 10. bis 31. August und am 16. September' / 'No data from 10 to 31 August and on 16 September'; leer ohne Lücken. */
export function gapSentence(rows: DayRow[], view: View, lang: Lang): string {
  const p = gapPieces(rows, view, lang);
  return p.length === 0 ? '' : `${lang === 'en' ? 'No data' : 'Keine Daten'} ${join(p.map((x) => x.lead), lang)}`;
}

/** Klammertext für den Zahlenblock zu den gegebenen Tagen: '10. bis 31. August, 16. September'. */
export function daysPlain(rows: DayRow[], days: string[], view: View, lang: Lang): string {
  const set = new Set(days);
  const parts = gapPieces(rows.map((r) => ({ ...r, gap: set.has(r.key) })), view, lang).map((p) => p.plain);
  if (parts.length < 2) return parts.join('');
  return parts.slice(0, -1).join(', ') + (lang === 'en' ? ' and ' : ' und ') + parts[parts.length - 1];
}

const FIELDS: (keyof Quantities)[] = ['prod', 'cons', 'self', 'imp', 'exp', 'dis', 'chg'];

export interface MissingSummary {
  /** Anzahl der Tage der gemeinsamen Zeile und die Tage selbst; null, wenn nichts fehlt */
  common: { n: number; days: string[] } | null;
  /** Größen, bei denen mehr Tage fehlen als in der gemeinsamen Zeile: Anzahl */
  extra: Partial<Record<keyof Quantities, number>>;
}

/** Fehlende Tage je Größe (nur Größen mit Summe); die kleinste Anzahl gilt für alle und steht einmal, nur Abweichungen einzeln. */
export function missingSummary(rows: DayRow[], sums: Quantities): MissingSummary {
  const past = rows.filter((r) => !r.future);
  const perDay = past.map((r) => quantities(r.gap ? null : r.counters));
  const days: Partial<Record<keyof Quantities, string[]>> = {};
  for (const f of FIELDS) {
    if (sums[f] === null) continue;
    const d = past.filter((_, i) => perDay[i][f] === null).map((r) => r.key);
    if (d.length > 0) days[f] = d;
  }
  const fields = Object.keys(days) as (keyof Quantities)[];
  if (fields.length === 0) return { common: null, extra: {} };
  // Die häufigste Anzahl steht einmal über den Zahlen; abweichende Größen bekommen einen eigenen Hinweis
  const counts = new Map<number, number>();
  for (const f of fields) counts.set(days[f]!.length, (counts.get(days[f]!.length) ?? 0) + 1);
  const common = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const base = fields.find((f) => days[f]!.length === common)!;
  const extra: Partial<Record<keyof Quantities, number>> = {};
  for (const f of fields) if (days[f]!.length !== common) extra[f] = days[f]!.length;
  return { common: { n: common, days: days[base]! }, extra };
}
