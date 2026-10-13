// Zahlen in deutscher Schreibweise: Dezimalkomma, unter 100 eine Nachkommastelle, ab 100 keine.

/** Platzhalter für fehlende Werte (Halbgeviertstrich). */
export const MISSING = '–';

/** Geschütztes Leerzeichen zwischen Zahl und Einheit. */
export const NBSP = ' ';

function isMissing(v: number | null | undefined): v is null | undefined {
  return v === null || v === undefined || !Number.isFinite(v);
}

/** Zahl ohne Einheit: '12,5', '99,9', '100', '1012'; fehlend: '–'. */
export function formatNumber(v: number | null | undefined): string {
  if (isMissing(v)) return MISSING;
  const r = Math.round(v * 10) / 10;
  if (Math.abs(r) >= 100) return String(Math.round(v));
  // r + 0 macht aus -0 eine 0
  return (r + 0).toFixed(1).replace('.', ',');
}

/** Energie: '12,5 kWh' (mit NBSP); fehlend: '–'. */
export function formatKwh(v: number | null | undefined): string {
  return isMissing(v) ? MISSING : formatNumber(v) + NBSP + 'kWh';
}

/** Leistung: '12,5 kW' (mit NBSP); fehlend: '–'. */
export function formatKw(v: number | null | undefined): string {
  return isMissing(v) ? MISSING : formatNumber(v) + NBSP + 'kW';
}

/** Achsenwert: ganze Zahlen ohne Nachkommastelle ('0', '20', '150'), sonst wie formatNumber ('12,5'). */
export function formatTick(v: number): string {
  if (!Number.isFinite(v)) return MISSING;
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v) + 0);
  return formatNumber(v);
}
