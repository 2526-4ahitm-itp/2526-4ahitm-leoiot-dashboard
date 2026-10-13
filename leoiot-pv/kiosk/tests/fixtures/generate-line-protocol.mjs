// Erzeugt Line Protocol für eine Wegwerf-InfluxDB (nur Testdaten, keine echten Werte).
// Wiener Sommerzeit im ganzen Zeitraum (UTC+2).
import { writeFileSync } from 'node:fs';

const OFFSET_H = 2;
const dayStart = (key) => Date.parse(key + 'T00:00:00Z') - OFFSET_H * 3600_000;
const r1 = (v) => Math.round(v * 10) / 10;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// weicher Anstieg 0..1 zwischen a und b (Stunden)
const ramp = (h, a, b) => {
  const x = clamp01((h - a) / (b - a));
  return x * x * (3 - 2 * x);
};

// Tagesendwerte je Tag
const days = {
  '2026-10-02': { y: 612.4, e: 35.2, i: 251.3, c: 96.0, d: 120.5 },
  '2026-10-03': { y: 188.9, e: 0, i: 402.7, c: 12.1, d: 88.4 },
  '2026-10-04': { y: 540.0, e: 120.6, i: 180.2, c: 101.3, d: 97.7 },
  '2026-10-05': { y: 705.3, e: 60.1, i: 260.9, c: 110.0, d: 131.2 },
  '2026-10-06': { y: 820.6, e: 15.4, i: 240.0, c: 118.8, d: 150.3 },
};
// Heute: Stand um 14:02 Wien entspricht dem Zahlenbeispiel der Spec
const todayKey = '2026-10-07';
const NOW_H = 14 + 2.5 / 60;
const todayAtNow = { y: 746.2, e: 0, i: 207, c: 82.4, d: 141.2 };

function shape(h) {
  return {
    y: ramp(h, 6.5, 18.5),
    e: ramp(h, 11, 15),
    i: 0.45 * ramp(h, 0, 7) + 0.1 * ramp(h, 7, 17) + 0.45 * ramp(h, 17, 24),
    c: ramp(h, 9.5, 13.5),
    d: 0.6 * ramp(h, 0, 6.5) + 0.4 * ramp(h, 18.5, 24),
  };
}

const lines = [];
const line = (fields, ms) =>
  lines.push(`solax_stats,plant_id=test ${fields} ${BigInt(ms) * 1_000_000n}`);

function full(v, total, ms) {
  const consumption = r1(v.y - v.e + v.i);
  line(
    `daily_yield=${r1(v.y)},total_yield=${r1(total + v.y)},consumption=${consumption},` +
      `daily_charged=${r1(v.c)},daily_discharged=${r1(v.d)},daily_imported=${r1(v.i)},daily_exported=${r1(v.e)}`,
    ms,
  );
}

// 1. Oktober: nur nachgetragene Werte (zwei Felder, stündlich)
{
  const s = dayStart('2026-10-01');
  for (let h = 1; h <= 23; h++) {
    const y = r1(430 * ramp(h, 6.5, 18.5));
    line(`daily_yield=${y},consumption=${r1(y + 12 * h)}`, s + h * 3600_000);
  }
}

let total = 100000;
let prevEnd = null;
for (const [key, end] of Object.entries(days)) {
  const s = dayStart(key);
  for (let m = 0; m < 1440; m++) {
    const h = (m + 0.5) / 60;
    const sh = shape(h);
    const v = { y: end.y * sh.y, e: end.e * sh.e, i: end.i * sh.i, c: end.c * sh.c, d: end.d * sh.d };
    full(v, total, s + m * 60_000 + 30_000);
  }
  total += end.y;
  prevEnd = end;
}

// Heute: bis 00:07 stehen noch die Endstände von gestern (verzögerter Reset)
{
  const s = dayStart(todayKey);
  const at = shape(NOW_H);
  const scale = {
    y: todayAtNow.y / at.y, e: 0, i: todayAtNow.i / at.i, c: todayAtNow.c / at.c, d: todayAtNow.d / at.d,
  };
  const last = Math.floor(NOW_H * 60 - 0.5);
  for (let m = 0; m <= last; m++) {
    const h = (m + 0.5) / 60;
    const ms = s + m * 60_000 + 30_000;
    if (m < 7) {
      full(prevEnd, total - prevEnd.y, ms);
      continue;
    }
    const sh = shape(h);
    const v = m === last
      ? todayAtNow
      : { y: scale.y * sh.y, e: 0, i: scale.i * sh.i, c: scale.c * sh.c, d: scale.d * sh.d };
    full(v, total, ms);
  }
}

writeFileSync(process.argv[2], lines.join('\n') + '\n');
console.log(lines.length, 'Zeilen');
