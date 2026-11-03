// Der Ablauf des Films als reine Funktion der Zeit: was in welchem Augenblick zu sehen ist.
// Das Bild und die Texte lesen nur diesen Zustand; darum lässt sich der ganze Film ohne Browser prüfen.
import { COLS } from './yearData';
import { HEIGHT, smooth, xOfU, zOf, grown } from './world';

export const LOOP = 98;
const K = (2 * Math.PI) / LOOP;
/** Zeitpunkte im Film (Sekunden). */
export const T = { today: 60, live: 75, total: 83, rewind: 90, tailEnd: 93.6 };

export interface Peak { u: number; h: number }

/** Was der Ablauf über die Daten wissen muss. */
export interface FilmInput {
  days: number; // Anzahl der gezeigten Tage, der letzte ist heute
  levels: (day: number, col: number) => number; // geglättete Höhe 0..1
  energy: (day: number) => number | null;
  coverage: (day: number) => number;
  best: number; // Index des besten Tages oder -1
  milestones: { day: number; kwh: number }[];
  monthStarts: { day: number; label: string }[];
  now: number; // Anteil des heutigen Tages, an dem die Sonne steht (0..1), nachts 1
}

type Kind = 'l' | 's' | 'h' | 'r'; // linear, schnell, halten, zurückspulen
interface Key { t: number; d: number; kind: Kind }
interface Shot { at: number; f: (t: number, front: number) => Cam }
export interface Cam { pos: [number, number, number]; look: [number, number, number] }

export interface Schedule {
  input: FilmInput;
  keys: Key[];
  shots: Shot[];
  peaks: Peak[];
  bestDrawn: number; // ab hier steht die Fahne des besten Tages
  bestOff: number;
  sample: number; // zweiter langsam gezeichneter Tag oder -1
  miles: { day: number; kwh: number; at: number }[];
  months: { day: number; label: string; at: number }[];
  gaps: { from: number; to: number; enter: number; leave: number }[];
  end: number; // Stelle von heute
}

export interface FilmState {
  t: number;
  day: number; // 12,5 = Mittag von Tag 12
  fast: number; // 0 = die Sonne zeichnet, 1 = ganze Tage steigen auf
  cam: Cam;
  late: number; // 0..1: Übergang in die großen Momente
  hudQuiet: boolean;
  dateIsToday: boolean;
  pen: { on: boolean; still: boolean; row: number; u: number; h: number } | null;
  axisOn: boolean;
  best: { on: boolean; glow: number; row: number; u: number; h: number } | null;
  mile: { kwh: number; row: number; glow: number } | null;
  tag: { row: number; u: number; h: number } | null;
  months: { label: string; row: number; alpha: number }[];
  gap: { from: number; to: number } | null;
  moment: 'live' | 'total' | 'co2' | 'tail' | null;
}

function peakOf(input: FilmInput, d: number): Peak {
  let c = 0;
  for (let i = 1; i < COLS; i++) if (input.levels(d, i) > input.levels(d, c)) c = i;
  return { u: c / (COLS - 1), h: input.levels(d, c) * HEIGHT };
}

/** Wählt den zweiten langsam gezeichneten Tag: vollständig, nicht zu schwach, mit Abstand zu Anfang, bestem Tag und heute. */
function pickSample(input: FilmInput, best: number): number {
  const n = input.days;
  const energies = Array.from({ length: n }, (_, i) => input.energy(i) ?? 0).filter((e) => e > 0).sort((a, b) => a - b);
  const median = energies[Math.floor(energies.length / 2)] ?? 0;
  const ok = (i: number) => input.coverage(i) >= 0.9 && (input.energy(i) ?? 0) >= median * 0.6;
  const after = best >= 0 && n - 1 - best > 20;
  const target = after ? best + (n - 1 - best) * 0.55 : (best >= 0 ? best : n) * 0.5;
  let pick = -1;
  for (let i = 4; i < n - 8; i++) {
    if (best >= 0 && Math.abs(i - best) < 10) continue;
    if (after ? i < best : best >= 0 && i > best) continue;
    if (ok(i) && (pick < 0 || Math.abs(i - target) < Math.abs(pick - target))) pick = i;
  }
  return pick;
}

/** Legt den Ablauf einmal fest; danach liefert `film` für jeden Zeitpunkt den Zustand. */
export function schedule(input: FilmInput): Schedule {
  const n = Math.max(1, input.days);
  const end = n - 1 + input.now;
  const best = input.best >= 0 && input.best < n - 1 ? input.best : -1;
  const sample = n > 30 ? pickSample(input, best) : -1;

  // Langsame Stellen in Tagesreihenfolge: (Tag von, Tag bis, Dauer)
  const slow: [number, number, number][] = [];
  if (n > 3) slow.push([0, 1, 5], [1, 2, 2.5], [2, 3, 1.5]);
  else slow.push([0, Math.min(1, end), 5]);
  let bestDrawn = -1, bestOff = -1;
  const crawl = 0.5;
  const events: { d: number; kind: 'best' | 'sample' }[] = [];
  if (best >= 3) events.push({ d: best, kind: 'best' });
  if (sample >= 0) events.push({ d: sample, kind: 'sample' });
  events.sort((a, b) => a.d - b.d);

  // Abschnitte bauen; die schnellen teilen sich die restliche Zeit bis T.today nach Anzahl ihrer Tage
  type Seg = { d0: number; d1: number; kind: Kind; dur: number; tag?: string };
  const segs: Seg[] = slow.map(([a, b, dur]) => ({ d0: a, d1: b, kind: 'l' as Kind, dur }));
  let cursor = segs[segs.length - 1].d1;
  for (const e of events) {
    if (e.d > cursor) segs.push({ d0: cursor, d1: e.d, kind: 's', dur: 0 });
    if (e.kind === 'best') {
      segs.push({ d0: e.d, d1: e.d + 1, kind: 'l', dur: 5.4, tag: 'bestDraw' });
      segs.push({ d0: e.d + 1, d1: e.d + 1 + crawl, kind: 'l', dur: 4.6, tag: 'bestMark' });
      cursor = e.d + 1 + crawl;
    } else {
      segs.push({ d0: e.d, d1: e.d + 1, kind: 'l', dur: 3.5 });
      cursor = e.d + 1;
    }
  }
  if (best >= 0 && best < 3) {
    segs.push({ d0: cursor, d1: cursor + crawl, kind: 'l', dur: 4.6, tag: 'bestMark' });
    cursor += crawl;
  }
  if (end > cursor) segs.push({ d0: cursor, d1: end, kind: 's', dur: 0 });
  const slowTime = segs.filter((s) => s.kind === 'l').reduce((a, s) => a + s.dur, 0);
  const fastSegs = segs.filter((s) => s.kind === 's');
  const fastDays = fastSegs.reduce((a, s) => a + (s.d1 - s.d0), 0) || 1;
  const fastTime = Math.max(0, T.today - slowTime);
  for (const s of fastSegs) s.dur = Math.max(fastSegs.length > 1 ? 1.5 : 0, (fastTime * (s.d1 - s.d0)) / fastDays);
  const scale = Math.min(1, T.today / segs.reduce((a, s) => a + s.dur, 0));
  const keys: Key[] = [];
  let t = 0;
  for (const s of segs) {
    if (s.tag === 'bestMark') bestDrawn = t;
    keys.push({ t, d: s.d0, kind: s.kind });
    t += s.dur * scale;
    if (s.tag === 'bestMark') bestOff = t;
  }
  keys.push({ t: T.today, d: end, kind: 'h' }, { t: T.rewind, d: end, kind: 'r' }, { t: LOOP, d: 0, kind: 'l' });

  const peaks = Array.from({ length: n }, (_, d) => peakOf(input, d));
  const sched: Schedule = { input, keys, shots: [], peaks, bestDrawn, bestOff, sample, miles: [], months: [], gaps: [], end };

  const timeOf = (day: number) => { let s = 0; while (s < T.today && dayAt(sched, s) < day) s += 0.05; return s; };
  // Meilensteine: nicht beim besten Tag, nicht zu dicht hintereinander
  let lastMile = -9;
  for (const m of input.milestones) {
    const at = timeOf(m.day + 0.5);
    if (at >= T.today - 1 || at < 4) continue;
    if (bestDrawn >= 0 && at > bestDrawn - 6 && at < bestOff + 1) continue;
    if (at - lastMile < 3.4) continue;
    sched.miles.push({ ...m, at });
    lastMile = at;
  }
  sched.months = input.monthStarts.map((m) => ({ ...m, at: timeOf(m.day + 0.2) }));
  // Lücken: zusammenhängende Tage ohne Messwerte
  for (let d = 0; d < n; d++) {
    if (input.energy(d) !== null) continue;
    let e = d;
    while (e + 1 < n && input.energy(e + 1) === null) e++;
    const enter = timeOf(d), leave = timeOf(e + 1);
    sched.gaps.push({ from: d, to: e, enter, leave: Math.max(leave, enter + 2) });
    d = e;
  }

  // Kamera: Einstellungen an den Stellen des Ablaufs
  const P = best >= 0 ? peaks[best] : { u: 0.5, h: HEIGHT * 0.5 };
  const bx = xOfU(P.u), bz = zOf(best >= 0 ? best : 0);
  const c = (p: [number, number, number], l: [number, number, number]): Cam => ({ pos: p, look: l });
  const start = (tt: number, f: number) => c([Math.sin(K * 5 * tt) * 4, 7.4 + Math.sin(K * 9 * tt) * 1.2, f - 22], [0, 4.6, f + 12]);
  const introEnd = keys[Math.min(3, keys.length - 1)].t;
  const sampleAt = sample >= 0 ? keys.find((k) => k.d === sample)?.t ?? -1 : -1;
  const list: Shot[] = [
    { at: 0, f: start },
    { at: introEnd + 4, f: (tt, f) => c([-13 + Math.sin(K * 6 * tt) * 2, 5.2, f - 12], [4, 3.8, f + 12]) },
  ];
  if (best >= 0) {
    const t0 = Math.max(introEnd + 6, bestDrawn - 6.4);
    list.push({ at: t0, f: (tt) => { const a = (tt - t0) * 0.13 - 2; return c([bx + Math.cos(a) * 15, P.h + 4, bz + Math.sin(a) * 15], [bx, P.h * 1.28, bz]); } });
    list.push({ at: bestOff + 1, f: (tt, f) => c([12 + Math.sin(K * 5 * tt) * 3, 6.4, f - 13], [-4, 3.6, f + 15]) });
  }
  if (sampleAt > 0) {
    list.push({ at: sampleAt - 1, f: (tt, f) => c([Math.sin(K * 7 * tt) * 3, 7.6, f - 21], [0, 4.4, f + 12]) });
    const s0 = sampleAt + 4.7;
    list.push({ at: s0, f: (tt, f) => c([14 - (tt - s0) * 2.2, 5.4 + Math.sin(K * 11 * tt) * 0.8, f - 11], [-3 + (tt - s0) * 0.7, 3.8, f + 13]) });
  }
  list.push(
    { at: 58, f: (tt, f) => c([-3 + (tt - 58) * 0.2, 5, f - 13], [1, 6.4, f + 6]) },
    { at: 74, f: (tt) => c([-15 + (tt - 74) * 0.6, 11, zOf(n) - 9], [2, 8.5, zOf(n * 0.55)]) },
    { at: 91, f: start },
  );
  // Nur aufsteigende Einstellungen mit genug Abstand behalten
  for (const s of list.sort((a, b) => a.at - b.at)) {
    const prev = sched.shots[sched.shots.length - 1];
    if (!prev || s.at - prev.at >= 5) sched.shots.push(s);
  }
  return sched;
}

/** Stelle im Jahr zum Zeitpunkt t. */
export function dayAt(s: Schedule, t: number): number {
  const k = s.keys;
  for (let i = 0; i < k.length - 1; i++) {
    if (t < k[i + 1].t) {
      if (k[i].kind === 'h') return k[i].d;
      const p = (t - k[i].t) / (k[i + 1].t - k[i].t);
      const e = k[i].kind === 'l' ? p : k[i].kind === 'r' ? p * p * (3 - 2 * p) : 0.3 * p + 0.7 * p * p * (3 - 2 * p);
      return k[i].d + (k[i + 1].d - k[i].d) * e;
    }
  }
  return 0;
}

function camAt(s: Schedule, t: number, front: number): Cam {
  let i = s.shots.length - 1;
  while (i > 0 && t < s.shots[i].at) i--;
  const b = s.shots[i].f(t, front);
  if (i === 0) return b;
  const a = s.shots[i - 1].f(t, front);
  const k = smooth(0, i === s.shots.length - 1 ? 6 : 4.5, t - s.shots[i].at);
  const mix = (x: number[], y: number[]) => x.map((v, j) => v + (y[j] - v) * k) as [number, number, number];
  return { pos: mix(a.pos, b.pos), look: mix(a.look, b.look) };
}

/** Wird der Gipfel von Tag d von einem der nächsten Grate bis `until` an derselben Tageszeit verdeckt? */
export function hiddenPeak(s: Schedule, d: number, until: number): boolean {
  const p = s.peaks[d];
  const c = Math.round(p.u * (COLS - 1));
  for (let r = d + 1; r <= Math.min(s.input.days - 1, Math.floor(until)); r++) {
    if (s.input.levels(r, c) * HEIGHT > p.h * 0.82) return true;
  }
  return false;
}

const TAG_EVERY = 2.5, TAG_SHOW = 1.8;

export function film(s: Schedule, time: number): FilmState {
  const t = ((time % LOOP) + LOOP) % LOOP;
  const day = dayAt(s, t);
  const speed = Math.abs(dayAt(s, Math.min(LOOP - 0.01, t + 0.7)) - dayAt(s, Math.max(0, t - 0.7))) / 1.4;
  const fast = t > T.rewind - 1 ? 1 : smooth(0.75, 2, speed);
  const n = s.input.days;
  const dI = Math.max(0, Math.min(n - 1, Math.floor(day)));
  const u = Math.min(1, Math.max(0, day - dI));
  const late = smooth(55, 61, t) * (1 - smooth(T.rewind, T.rewind + 4, t));
  const bestOn = s.bestDrawn >= 0 && t > s.bestDrawn && t < s.bestOff;

  const penOn = fast < 0.12 && t < T.rewind - 1 && !bestOn;
  const pen = penOn ? { on: t < T.today + 1.5, still: t >= T.today, row: dI, u, h: s.input.levels(dI, Math.round(u * (COLS - 1))) * HEIGHT } : null;

  const best = s.bestDrawn >= 0 && s.input.best >= 0
    ? { on: bestOn, glow: smooth(s.bestDrawn, s.bestDrawn + 1, t) * (1 - smooth(s.bestOff - 1.5, s.bestOff, t)), row: s.input.best, u: s.peaks[s.input.best].u, h: s.peaks[s.input.best].h * grown(day, s.input.best, s.peaks[s.input.best].u, fast) }
    : null;

  const m = s.miles.find((x) => t >= x.at && t < x.at + 2.8);
  const mile = m ? { kwh: m.kwh, row: m.day, glow: smooth(m.at, m.at + 0.4, t) * (1 - smooth(m.at + 2, m.at + 2.8, t)) } : null;

  // Einzelne Tageswerte: feste Takte, damit der Film immer gleich abläuft
  let tag: FilmState['tag'] = null;
  const w = Math.floor(t / TAG_EVERY), w0 = w * TAG_EVERY;
  const freeAt = (x: number) => x > 4.8 && x < T.today - 1 && !(s.bestDrawn >= 0 && x > s.bestDrawn - 0.5 && x < s.bestOff + 2) && smooth(0.75, 2, Math.abs(dayAt(s, x + 0.7) - dayAt(s, Math.max(0, x - 0.7))) / 1.4) > 0.12;
  if (t - w0 < TAG_SHOW && freeAt(w0) && freeAt(Math.min(t, w0 + TAG_SHOW))) {
    const base = Math.floor(dayAt(s, w0));
    for (let d = Math.min(n - 2, base - 4); d >= Math.max(0, base - 9); d--) {
      if ((s.input.energy(d) ?? 0) <= 0 || d === s.input.best || s.peaks[d].h < 1 || hiddenPeak(s, d, d + 12)) continue;
      tag = { row: d, u: s.peaks[d].u, h: s.peaks[d].h * grown(day, d, s.peaks[d].u, fast) };
      break;
    }
  }

  const months = s.months
    .map((mo) => ({ label: mo.label, row: mo.day, alpha: t > T.rewind ? 0 : smooth(mo.at, mo.at + 0.4, t) * (1 - smooth(mo.at + 2.3, mo.at + 3, t)) }))
    .filter((mo) => mo.alpha > 0);
  const g = t < T.today ? s.gaps.find((x) => t >= x.enter && t < x.leave) : undefined;

  const moment = t > T.today + 1.2 && t < T.live - 0.5 ? 'live'
    : t > T.live + 1 && t < T.total - 0.3 ? 'total'
    : t > T.total + 0.2 && t < T.rewind - 0.3 ? 'co2'
    : t >= T.rewind && t < T.tailEnd ? 'tail' : null;

  return {
    t, day, fast, cam: camAt(s, t, zOf(day)), late,
    hudQuiet: t > T.today + 0.6 && t < T.tailEnd - 0.2,
    dateIsToday: t >= T.today - 0.5 && t < T.rewind,
    pen, axisOn: t < T.today - 1 && !(s.bestDrawn >= 0 && t > s.bestDrawn - 0.5 && t < s.bestOff),
    best, mile, tag, months, gap: g ? { from: g.from, to: g.to } : null, moment,
  };
}
