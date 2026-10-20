// Zahlen: unter 100 eine Nachkommastelle, ab 100 keine. Standard ist deutsche Schreibweise
// (Dezimalkomma, keine Tausendertrennung) wie im Kiosk; das Dashboard wählt Sprache und Trennung.

/** Platzhalter für fehlende Werte (Halbgeviertstrich). */
export const MISSING = '–';

/** Geschütztes Leerzeichen zwischen Zahl und Einheit. */
export const NBSP = ' ';

/** Sprache der Zahlen. */
export type Lang = 'de' | 'en';

/** Schreibweise: Sprache (Dezimalzeichen) und ob ab 1000 Tausender getrennt werden. */
export interface NumberStyle {
  lang?: Lang;
  group?: boolean;
}

/** Tausendertrennung einer ganzen Zahl: '84.312' (de), '84,312' (en). */
function groupThousands(int: string, lang: Lang): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '.');
}

function isMissing(v: number | null | undefined): v is null | undefined {
  return v === null || v === undefined || !Number.isFinite(v);
}

/** Zahl ohne Einheit: '12,5', '99,9', '100', '1012'; fehlend: '–'. Englisch: '12.5'; mit group: '84.312' bzw. '84,312'. */
export function formatNumber(v: number | null | undefined, style: NumberStyle = {}): string {
  if (isMissing(v)) return MISSING;
  const lang = style.lang ?? 'de';
  const r = Math.round(v * 10) / 10;
  if (Math.abs(r) >= 100) {
    const int = String(Math.round(v));
    return style.group ? groupThousands(int, lang) : int;
  }
  // r + 0 macht aus -0 eine 0
  const fixed = (r + 0).toFixed(1);
  return lang === 'en' ? fixed : fixed.replace('.', ',');
}

/** Energie: '12,5 kWh' (mit NBSP); fehlend: '–'. */
export function formatKwh(v: number | null | undefined, style: NumberStyle = {}): string {
  return isMissing(v) ? MISSING : formatNumber(v, style) + NBSP + 'kWh';
}

/** Leistung: '12,5 kW' (mit NBSP); fehlend: '–'. */
export function formatKw(v: number | null | undefined, style: NumberStyle = {}): string {
  return isMissing(v) ? MISSING : formatNumber(v, style) + NBSP + 'kW';
}

/** Achsenwert: ganze Zahlen ohne Nachkommastelle ('0', '20', '150'), sonst wie formatNumber ('12,5'). */
export function formatTick(v: number, style: NumberStyle = {}): string {
  if (!Number.isFinite(v)) return MISSING;
  if (Math.abs(v - Math.round(v)) < 1e-9) {
    const int = String(Math.round(v) + 0);
    return style.group ? groupThousands(int, style.lang ?? 'de') : int;
  }
  return formatNumber(v, style);
}
