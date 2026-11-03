// Einstieg: Daten laden, Ablauf festlegen, jedes Bild aus film(t) zeichnen.
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles/kiosk2.css';
import { dayRange } from '@leoiot-pv/shared/time';
import { formatNumber } from '@leoiot-pv/shared/format';
import { COLS, FIRST_MINUTE, WINDOW_MIN, heightGrid, type Year } from './core/yearData';
import { bestDay, counterAt, cumulative, milestones } from './core/facts';
import { LOOP, film, schedule, type FilmInput, type Schedule } from './core/film';
import { co2Moment, kwh, liveMoment, storedStand, TAIL, totalMoment, type Moment } from './core/moments';
import { isDaylight } from './core/sun';
import { PAD } from './core/world';
import { createStore, type Snapshot } from './data/store';
import { createScene, type Scene } from './scene/scene';
import { createOverlay, type Texts } from './ui/overlay';
import { createQuality } from './ui/quality';
import { scheduleNightlyReload } from './ui/reload';

const BASE = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);
const fixedT = params.has('t') ? Number(params.get('t')) : null; // Standbild für Prüfungen
const fixedNow = params.has('now') ? new Date(params.get('now') as string) : null; // feste Uhrzeit für Prüfungen
const now = (): Date => fixedNow ?? new Date();

const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const dateFormat = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const keyDate = (key: string) => new Date(key + 'T12:00:00Z');

const notice = document.querySelector('.notice') as HTMLElement;
function say(title: string, text: string): void {
  notice.hidden = title === '';
  (notice.querySelector('b') as HTMLElement).textContent = title;
  (notice.querySelector('span') as HTMLElement).textContent = text;
}

/** Was der Ablauf aus einem geladenen Jahr wissen muss. */
function inputOf(year: Year, total: number, grid: Float32Array): FilmInput {
  const n = year.days.length;
  const t = now(), start = dayRange(t).start.getTime();
  const minute = (t.getTime() - start) / 60_000;
  return {
    days: n,
    levels: (d, c) => grid[(Math.max(-PAD, Math.min(n + PAD - 1, d)) + PAD) * COLS + c] ?? 0,
    energy: (d) => year.days[d]?.energy ?? null,
    coverage: (d) => year.days[d]?.coverage ?? 0,
    best: bestDay(year),
    milestones: milestones(year, cumulative(year), total),
    monthStarts: year.days.flatMap((d, i) => (i === 0 || d.key.endsWith('-01') ? [{ day: i, label: MONTHS[Number(d.key.slice(5, 7)) - 1] }] : [])),
    now: Math.min(1, Math.max(0, (minute - FIRST_MINUTE) / ((COLS - 1) * WINDOW_MIN))),
  };
}

let scene: Scene;
try {
  scene = createScene(document.getElementById('scene') as HTMLCanvasElement);
} catch {
  say('Dieser Bildschirm kann den Film nicht zeigen.', 'Er braucht WebGL2. Der Hauptkiosk unter /kiosk/ läuft auch hier.');
  throw new Error('kein WebGL2');
}
const overlay = createOverlay(scene.camera);
const quality = createQuality((d) => scene.setDetail(d.pixelRatio, d.shadows));
addEventListener('resize', () => scene.resize());
document.addEventListener('fullscreenchange', () => scene.resize());

// Ein geladenes Jahr wird zum Ablauf; neue Daten gelten erst ab dem nächsten Durchlauf, damit nichts springt
interface Film { year: Year; sched: Schedule; cum: Float64Array; total: number | null }
let current: Film | null = null;
let pending: Snapshot | null = null;
let totalWaits = 0;
let snap: Snapshot = { year: null, total: null, live: null, failed: false };

function adopt(s: Snapshot): void {
  if (!s.year || s.year.days.length === 0) return;
  // Zähler und Meilensteine brauchen den Gesamtertrag; ohne ihn startet der Film erst nach zwei Versuchen
  if (s.total === null && totalWaits++ < 2) return;
  const grid = heightGrid(s.year, PAD);
  const cum = cumulative(s.year);
  const total = s.total ?? cum[s.year.days.length];
  current = { year: s.year, sched: schedule(inputOf(s.year, total, grid)), cum, total: s.total };
  scene.setLandscape(grid, s.year.days.length);
}

const store = createStore({
  query: async (flux) => {
    const r = await fetch(BASE + 'api/query', { method: 'POST', headers: { 'Content-Type': 'application/vnd.flux', Accept: 'application/csv' }, body: flux, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  },
  now,
  liveUrls: [...new Set([(location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + BASE + 'ws', (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws'])],
  onChange: (s) => {
    snap = s;
    if (!current || (current.total === null && s.total !== null)) adopt(s);
    else pending = s;
  },
});

function texts(f: Film, t: number): { state: ReturnType<typeof film>; x: Texts } {
  const st = film(f.sched, t);
  const days = f.year.days;
  const row = Math.max(0, Math.min(days.length - 1, Math.floor(st.day)));
  const total = f.total;
  const moment: Moment | null =
    st.moment === 'live' ? liveMoment(now(), snap.live)
    : st.moment === 'total' ? (total === null ? null : totalMoment(total))
    : st.moment === 'co2' ? (total === null ? null : co2Moment(total))
    : st.moment === 'tail' ? TAIL : null;
  const pen = st.pen;
  const penPower = pen ? days[pen.row].power[Math.round(pen.u * (COLS - 1))] : NaN;
  const penMinute = pen ? FIRST_MINUTE + pen.u * (COLS - 1) * WINDOW_MIN : 0;
  const best = f.sched.input.best;
  const gap = st.gap ? `Keine Messwerte vom ${shortFormat.format(keyDate(days[st.gap.from].key))} bis ${shortFormat.format(keyDate(days[st.gap.to].key))}` : '';
  return {
    state: st,
    x: {
      date: st.dateIsToday ? 'Heute' : dateFormat.format(keyDate(days[row].key)),
      counter: total === null ? '–' : kwh(counterAt(f.year, f.cum, total, st.day)),
      stand: storedStand(now(), f.year.lastReading),
      moment,
      isTail: st.moment === 'tail',
      penKw: Number.isNaN(penPower) ? '–' : `${formatNumber(penPower)} kW`,
      penClock: `${String(Math.floor(penMinute / 60)).padStart(2, '0')}:${String(Math.floor(penMinute % 60)).padStart(2, '0')} Uhr`,
      bestDate: best >= 0 ? shortFormat.format(keyDate(days[best].key)) : '',
      bestValue: best >= 0 ? `${kwh(days[best].energy ?? 0)} kWh` : '',
      tagValue: st.tag ? `${kwh(days[st.tag.row].energy ?? 0)} kWh` : '',
      mile: st.mile ? `${kwh(st.mile.kwh)} kWh erreicht` : '',
      gap,
    },
  };
}

let loopIndex = 0;
function frame(time: number): void {
  if (pending && Math.floor(time / LOOP) !== loopIndex) { adopt(pending); pending = null; }
  loopIndex = Math.floor(time / LOOP);
  if (!current) {
    say(snap.failed ? 'Keine Daten' : 'Daten werden geladen', snap.failed ? 'Die Datenquelle antwortet gerade nicht. Der Film startet von selbst, sobald sie wieder da ist.' : '');
    return;
  }
  say('', '');
  const { state, x } = texts(current, time);
  const key = current.year.days[Math.max(0, Math.min(current.year.days.length - 1, Math.floor(state.day)))].key;
  const doy = (Date.parse(key) - Date.parse(key.slice(0, 4) + '-01-01')) / 86_400_000;
  const season = Math.cos(((doy - 172) / 365) * 2 * Math.PI) * 0.5 + 0.5;
  const dusk = isDaylight(now()) ? 0 : state.late;
  scene.render(state, { season, dusk, phase: (2 * Math.PI * state.t) / LOOP });
  overlay.update(state, x);
}

if (params.has('audit')) {
  // Prüfwerkzeug: Ablauf ohne Bild, siehe design D12
  (window as unknown as { __film: unknown }).__film = { frame, ready: () => current !== null };
}

store.start();
scheduleNightlyReload(BASE);
document.fonts.ready.then(() => {
  if (fixedT !== null) {
    const wait = () => { if (current) { frame(fixedT); document.body.dataset.ready = '1'; } else setTimeout(wait, 100); };
    wait();
    return;
  }
  const start = performance.now();
  const loop = (ts: number) => {
    requestAnimationFrame(loop);
    quality.frame(ts);
    frame(Math.max(0, (ts - start) / 1000));
  };
  requestAnimationFrame(loop);
});
