// Leistungskurve nur der Produktion, für Tage, an denen nicht alle fünf Zähler gespeichert sind (vor dem 20. April 2026).
import { parseCsv, type PowerPoint } from '@leoiot-pv/shared/influx';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** kW aus aufeinanderfolgenden daily_yield-Ständen der todayQuery-Antwort; Rücksprünge zählen als keine Änderung. */
export function yieldPower(csv: string, dayStart: Date): PowerPoint[] {
  const stands = parseCsv(csv)
    .filter((r) => r._field === 'daily_yield')
    .map((r) => ({ t: Date.parse(r._time), v: Number(r._value) }))
    .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.v))
    .sort((a, b) => a.t - b.t);
  if (stands.length === 0) return [];
  const all = stands[0].t - dayStart.getTime() <= 15 * MINUTE_MS ? [{ t: dayStart.getTime(), v: 0 }, ...stands] : stands;
  const out: PowerPoint[] = [];
  for (let i = 1; i < all.length; i++) {
    const dt = all[i].t - all[i - 1].t;
    if (dt <= 0 || dt > 15 * MINUTE_MS) {
      if (dt > 0) out.push({ t: all[i].t, production: null, consumption: null });
      continue;
    }
    const diff = Math.max(0, all[i].v - all[i - 1].v);
    out.push({ t: all[i].t, production: diff / (dt / HOUR_MS), consumption: null });
  }
  return out;
}

