// Leitsatz der Ansicht und Zeile "Gerade": reine Funktionen, die Teile (Text oder Zahl-Chip) liefern.
import type { Power } from '@leoiot-pv/shared/energy';
import { dateLong, kw, kwh, monthLabel, pct, TEXT, type Lang } from './i18n';
import type { DayRow, Quantities, Totals } from './periods';
import { quantities } from './periods';
import { addDays } from '@leoiot-pv/shared/time';
import type { Route, View } from './route';

export type ChipQuantity = keyof Quantities | 'autarky' | 'selfRate';
export type Part = { text: string } | { chip: { value: string; quantity: ChipQuantity } };

export interface LeadInput {
  view: View;
  key: string; // erster Tag des Zeitraums
  rows: DayRow[];
  totals: Totals;
  lang: Lang;
  /** 'HH:MM' des Zeitpunkts, bis zu dem heute gerechnet wird */
  nowTime: string;
  todayKey: string;
}

const t = (text: string): Part => ({ text });
const chip = (value: string, quantity: ChipQuantity): Part => ({ chip: { value, quantity } });

// Tag und Monat ausgeschrieben: '7. Oktober' / '7 October'
export function dayMonthLong(key: string, lang: Lang): string {
  const d = Number(key.slice(8, 10));
  const month = monthLabel(key, lang).split(' ')[0];
  return lang === 'en' ? `${d} ${month}` : `${d}. ${month}`;
}

/** '20. bis 30. April' / '20 to 30 April'; über Monatsgrenzen '28. März bis 3. April'. */
export function rangeText(from: string, to: string, lang: Lang): string {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const d1 = Number(from.slice(8, 10));
  if (sameMonth) {
    const d2 = Number(to.slice(8, 10));
    const month = monthLabel(to, lang).split(' ')[0];
    return lang === 'en' ? `${d1} to ${d2} ${month}` : `${d1}. bis ${d2}. ${month}`;
  }
  return lang === 'en'
    ? `${dayMonthLong(from, lang)} to ${dayMonthLong(to, lang)}`
    : `${dayMonthLong(from, lang)} bis ${dayMonthLong(to, lang)}`;
}

// Letzter Tag des Zeitraums (ohne künftige Tage zu verlangen)
function lastDay(rows: DayRow[]): string {
  return rows[rows.length - 1].key;
}

/** Zeitangabe am Satzanfang, z. B. 'Am Mittwoch, 14. Oktober 2026' oder 'In der Woche vom 5. bis 11. Oktober'. */
function when(i: LeadInput): string {
  const { view, key, rows, lang } = i;
  const open = rows.some((r) => r.today);
  if (view === 'day') {
    if (open) return lang === 'en' ? `Today until ${i.nowTime},` : `Heute bis ${i.nowTime}`;
    return lang === 'en' ? `On ${dateLong(key, lang)},` : `Am ${dateLong(key, lang)}`;
  }
  if (view === 'week') {
    const r = rangeText(rows[0].key, lastDay(rows), lang);
    return lang === 'en' ? `In the week of ${r},` : `In der Woche vom ${r}`;
  }
  if (view === 'month') {
    const m = monthLabel(key, lang);
    return lang === 'en' ? `In ${m},` : `Im ${m}`;
  }
  const y = key.slice(0, 4);
  return lang === 'en' ? `In ${y},` : `Im Jahr ${y}`;
}

/** Absätze des Leitsatzes; jede Zahl ist ein Chip, fehlende Werte werden in Worten gesagt, nie als 0. */
export function leadParagraphs(i: LeadInput): Part[][] {
  const { totals: tot, lang, view, rows } = i;
  const s = tot.sum;
  const day = view === 'day';
  const open = rows.some((r) => r.today);
  const w = when(i);
  const de = lang === 'de';

  if (s.prod === null) {
    if (day) {
      const dateText = i.rows[0].gap ? dateLong(i.key, lang) : null;
      if (dateText === null) return [[t(TEXT[lang].noDataBefore)]];
      return [[t(de ? `Am ${dateText} wurden keine Werte gespeichert.` : `No readings were stored on ${dateText}.`)]];
    }
    return [[t(de ? 'Für diesen Zeitraum liegen keine Daten vor.' : 'There is no data for this period.')]];
  }
  if (s.prod === 0) {
    return [[t(de ? `${w} wurde nichts produziert.` : `${w} nothing was produced.`)]];
  }

  // Fehlen vergangene Tage der Produktion, nennt der Satz den Bereich, den sie abdeckt
  const past = rows.filter((r) => !r.future);
  const withProd = past.filter((r) => quantities(r.gap ? null : r.counters).prod !== null);
  let pw = w;
  let pwEn = w;
  if (tot.missing.prod > 0 && withProd.length > 0) {
    const f = withProd[0].key;
    const l = withProd[withProd.length - 1].key;
    const miss = tot.missing.prod === 1 ? past.find((r) => !withProd.includes(r)) : undefined;
    if (miss && f === rows[0].key && l === past[past.length - 1].key) {
      const x = dayMonthLong(miss.key, lang);
      pw = `${w} (ohne ${x})`;
      pwEn = `${w.replace(/,$/, '')} (excluding ${x})`;
    } else if (f === l) {
      pw = `Am ${dayMonthLong(f, lang)}`;
      pwEn = `On ${dayMonthLong(f, lang)}`;
    } else {
      pw = `Vom ${rangeText(f, l, lang)}`;
      pwEn = `From ${rangeText(f, l, lang)}`;
    }
  }
  const first: Part[] = de
    ? [t(`${pw} hat die Anlage${open && !day ? ' bisher' : ''} `), chip(kwh(s.prod, lang), 'prod'), t(' produziert.')]
    : [t(`${pwEn} the system ${open ? 'has produced' : 'produced'} `), chip(kwh(s.prod, lang), 'prod'), t('.')];
  const out: Part[][] = [first];

  if (s.cons === null) {
    out.push([
      t(
        day
          ? de
            ? 'Netz, Batterie und Verbrauch wurden an diesem Tag noch nicht erfasst.'
            : 'Grid, battery and consumption were not yet recorded on this day.'
          : de
            ? 'Netz, Batterie und Verbrauch wurden in diesem Zeitraum noch nicht erfasst.'
            : 'Grid, battery and consumption were not yet recorded in this period.',
      ),
    ]);
    return out;
  }

  const cons = chip(kwh(s.cons, lang), 'cons');
  const aut = tot.ratios.autarky;
  const tail = (sep: string): Part[] =>
    aut === null
      ? [t('.')]
      : de
        ? [t(', '), chip(pct(aut, lang), 'autarky'), t(' davon kamen nicht aus dem Netz.')]
        : [t(sep), chip(pct(aut, lang), 'autarky'), t(' of it did not come from the grid.')];

  if (tot.missing.cons > 0 && tot.ratioFrom !== null && tot.ratioTo !== null) {
    const lastPast = [...rows].reverse().find((r) => !r.future)?.key ?? lastDay(rows);
    const missingDay =
      tot.missing.cons === 1 ? rows.find((r) => !r.future && quantities(r.gap ? null : r.counters).cons === null) : undefined;
    let lead: string;
    if (missingDay && tot.ratioFrom === rows[0].key && tot.ratioTo === lastPast) {
      const x = dayMonthLong(missingDay.key, lang);
      lead = `${w.replace(/,$/, '')} ${de ? `(ohne ${x})` : `(excluding ${x})`}`;
    } else if (tot.ratioFrom === tot.ratioTo) {
      lead = de ? `Am ${dayMonthLong(tot.ratioFrom, lang)}` : `On ${dayMonthLong(tot.ratioFrom, lang)}`;
    } else {
      lead = de ? `Vom ${rangeText(tot.ratioFrom, tot.ratioTo, lang)}` : `From ${rangeText(tot.ratioFrom, tot.ratioTo, lang)}`;
    }
    // Gleiche Zeitangabe wie im ersten Satz: nicht wiederholen
    if (lead !== (de ? pw : pwEn)) {
      out.push(
        de
          ? [t(`${lead} hat die Schule `), cons, t(' verbraucht'), ...tail('')]
          : [t(`${lead} the school used `), cons, ...tail('; ')],
      );
      return out;
    }
  }

  out.push(
    de
      ? [t('Die Schule hat '), cons, t(' verbraucht'), ...tail('')]
      : [t('The school consumed '), cons, ...tail(', ')],
  );
  return out;
}

/** Zeile "Gerade …" für heute; label ist der Hinweis ('Live' oder 'Ø letzte 10 Min'), steht daneben. */
export function liveParts(power: Power, lang: Lang): Part[] {
  const L = TEXT[lang];
  const near = (v: number): boolean => Math.abs(v) < 0.05;
  const gridText = near(power.grid)
    ? `${L.grid} ${kw(0, lang)}`
    : `${L.grid} ${kw(Math.abs(power.grid), lang)} ${power.grid > 0 ? L.gridIn : L.gridOut}`;
  const batteryText = near(power.battery)
    ? `${L.battery} ${L.idle}`
    : `${L.battery} ${kw(Math.abs(power.battery), lang)} ${power.battery > 0 ? L.discharging : L.charging}`;
  return [
    t(`${L.power}: ${L.quantities.production} `),
    chip(kw(power.pv, lang), 'prod'),
    t(`, ${L.quantities.consumption} `),
    chip(kw(power.load, lang), 'cons'),
    t(`, ${gridText}, ${batteryText}`),
  ];
}

/** ISO-Kalenderwoche des Tages (Woche mit dem ersten Donnerstag des Jahres ist Woche 1). */
export function isoWeek(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const thursday = new Date(Date.UTC(y, m - 1, d));
  thursday.setUTCDate(thursday.getUTCDate() - ((thursday.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

/** Titel des Zeitraums für die Kopfleiste: 'Mittwoch, 14. Oktober 2026', 'KW 41 · 5. bis 11. Oktober', 'Oktober 2026', '2026'. */
export function periodTitle(r: Route, lang: Lang): string {
  switch (r.view) {
    case 'day':
      return dateLong(r.key, lang);
    case 'week':
      return `${TEXT[lang].week} ${isoWeek(r.key)} · ${rangeText(r.key, addDays(r.key, 6), lang)}`;
    case 'month':
      return monthLabel(r.key, lang);
    case 'year':
      return r.key.slice(0, 4);
  }
}
