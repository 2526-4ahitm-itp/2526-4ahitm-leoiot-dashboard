// Reine Funktionen: Cloud-Antwort prüfen und in Datenbankzeile und Broker-Nachricht umwandeln.
// Das Format ist im Datenvertrag (platform/data-contract) festgelegt.

/** Thema der PV-Livedaten laut Datenvertrag. */
export const PV_TOPIC = 'leoenergy/solax_pv/overall_inverter';

/** Werte, die der Vertrag aus der Cloud-Antwort verlangt. */
export const REQUIRED_FIELDS = [
  'dailyYield',
  'dailyExported',
  'dailyImported',
  'dailyCharged',
  'dailyDischarged',
  'totalYield',
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface Reading {
  dailyYield: number;
  dailyExported: number;
  dailyImported: number;
  dailyCharged: number;
  dailyDischarged: number;
  totalYield: number;
  /** dailyYield − dailyExported + dailyImported (ohne Batterie) */
  consumption: number;
}

export type CheckResult =
  | { ok: true; reading: Reading }
  | { ok: false; missing: string };

/** consumption laut Vertrag; Reihenfolge der Rechenschritte wie bisher. */
export function computeConsumption(
  dailyYield: number,
  dailyExported: number,
  dailyImported: number,
): number {
  return dailyYield - dailyExported + dailyImported;
}

/**
 * Prüft, ob alle verlangten Werte endliche Zahlen sind. Fehlt einer, wird nur
 * der Name des ersten fehlenden Wertes geliefert und sonst nichts.
 */
export function checkResult(result: unknown): CheckResult {
  if (typeof result !== 'object' || result === null) {
    return { ok: false, missing: 'result' };
  }
  const record = result as Record<string, unknown>;
  for (const name of REQUIRED_FIELDS) {
    const value = record[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, missing: name };
    }
  }
  const dailyYield = record.dailyYield as number;
  const dailyExported = record.dailyExported as number;
  const dailyImported = record.dailyImported as number;
  return {
    ok: true,
    reading: {
      dailyYield,
      dailyExported,
      dailyImported,
      dailyCharged: record.dailyCharged as number,
      dailyDischarged: record.dailyDischarged as number,
      totalYield: record.totalYield as number,
      consumption: computeConsumption(dailyYield, dailyExported, dailyImported),
    },
  };
}

// Tag-Werte: Komma, Gleichheitszeichen und Leerzeichen müssen maskiert werden.
function escapeTag(value: string): string {
  return value.replace(/[,= ]/g, (c) => `\\${c}`);
}

/**
 * Line Protocol für InfluxDB, byte-genau wie der bisherige Collector:
 * - Feldreihenfolge daily_yield, total_yield, consumption, daily_charged,
 *   daily_discharged, daily_imported, daily_exported (so wie im bisherigen Code);
 * - Zahlen so, wie JavaScript sie ausgibt (String(n)), ohne "i"-Suffix, also Float;
 * - Zeitstempel in Nanosekunden als nowMs * 1000000, Precision ns.
 */
export function toLine(plantId: string, reading: Reading, nowMs: number): string {
  const fields = [
    `daily_yield=${reading.dailyYield}`,
    `total_yield=${reading.totalYield}`,
    `consumption=${reading.consumption}`,
    `daily_charged=${reading.dailyCharged}`,
    `daily_discharged=${reading.dailyDischarged}`,
    `daily_imported=${reading.dailyImported}`,
    `daily_exported=${reading.dailyExported}`,
  ].join(',');
  return `solax_stats,plant_id=${escapeTag(plantId)} ${fields} ${nowMs * 1000000}`;
}

/** Broker-Nachricht: die vollständige Cloud-Antwort als JSON, nicht reduziert. */
export function toMessage(result: unknown): string {
  return JSON.stringify(result);
}
