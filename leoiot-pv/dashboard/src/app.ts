// Zustand und Ablauf des Dashboards: Adresse, Laden, Aktualisieren, Live-Kanal, Darstellung der Teile.
import { completeCounters, type Power } from '@leoiot-pv/shared/energy';
import { createLiveClient } from '@leoiot-pv/shared/live';
import { viennaDateKey, viennaDayStart, viennaTime, addDays } from '@leoiot-pv/shared/time';
import type { PowerPoint } from '@leoiot-pv/shared/influx';
import type { CounterRow } from '@leoiot-pv/shared/influx';
import { dayBars, dayModel, monthBars, type ChartModel } from './core/chartData';
import { gapSentence } from './core/gaps';
import { initialLang, monthLabel, dateShort, TEXT, type Lang } from './core/i18n';
import { leadParagraphs, liveParts, periodTitle, type ChipQuantity, type Part } from './core/lead';
import { isStale, liveState } from './core/live';
import { dayRows, monthRows, totals, type DayRow, type MonthRow, type Totals } from './core/periods';
import { parseRoute, periodDays, periodStart, routeSearch, stepRoute, type Route, type View } from './core/route';
import { liveUrls, queryInflux } from './data/api';
import { loadDayCurve, loadDayTotals, loadDayTotalsByMonth, loadEarliest, loadLatest, type MonthCache } from './data/queries';
import { createBar } from './ui/bar';
import { createChart } from './ui/chart';
import { el, HATCHED, QUANTITY_COLOR, swatch } from './ui/dom';
import { renderFigures, quantityName } from './ui/figures';
import { renderTable } from './ui/table';
import { applyTheme, initialTheme, LANG_KEY, readStored, store, THEME_KEY, type Theme } from './ui/theme';

interface ViewData {
  route: Route;
  rows: DayRow[];
  totals: Totals;
  months: MonthRow[] | null;
  curve: { rows: CounterRow[]; power: PowerPoint[]; slots: number } | null;
  latest: number | null;
}

type Status = 'loading' | 'error' | 'ok';

const RETRY_MS = 15_000;
const REFRESH_MS = 60_000;
const TICK_MS = 15_000;
const SERIES_OF_CHIP: Partial<Record<ChipQuantity, string>> = { prod: 'prod', cons: 'cons', imp: 'imp', exp: 'exp' };

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export function startApp(): void {
  const query = (flux: string): Promise<string> => queryInflux(flux);
  const todayKey = (): string => viennaDateKey(new Date());

  let lang: Lang = initialLang(readStored(LANG_KEY), navigator.language);
  let theme: Theme = initialTheme(readStored(THEME_KEY), window.matchMedia('(prefers-color-scheme: dark)').matches);
  let route: Route = parseRoute(location.search, todayKey());
  let earliest: string | null | undefined; // undefined = noch nicht geladen
  const monthCache: MonthCache = new Map();
  let data: ViewData | null = null;
  let status: Status = 'loading';
  let tableOpen = false;
  let lastLive: { power: Power; t: number } | null = null;
  let token = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let liveClient: { stop(): void } | null = null;

  const bar = createBar($('bar'), {
    onView: (view) => go({ view, key: periodStart(view, route.key) }),
    onStep: (dir) => {
      const next = stepRoute(route, dir, todayKey(), earliest ?? null);
      if (next) go(next);
    },
    onPick: (r) => {
      if (r.view === route.view && r.key !== route.key) go(r);
    },
    onToday: () => go({ view: route.view, key: periodStart(route.view, todayKey()) }),
    onLang: (l) => {
      lang = l;
      store(LANG_KEY, l);
      renderAll(false);
    },
    onTheme: (t) => {
      if (t === theme) return;
      theme = t;
      store(THEME_KEY, theme);
      applyTheme(theme);
      chart.recolor();
      renderAll(false);
    },
  });

  const chart = createChart($('chart') as HTMLCanvasElement, {
    onDrill: (key) => go(route.view === 'year' ? { view: 'month', key } : { view: 'day', key }),
  });

  // ---------- Navigation ----------
  function go(next: Route, push = true): void {
    route = next;
    if (push) history.pushState(null, '', routeSearch(next));
    status = 'loading';
    data = null;
    renderAll(true);
    void load(true);
  }
  window.addEventListener('popstate', () => go(parseRoute(location.search, todayKey()), false));

  // ---------- Laden ----------
  const containsToday = (r: Route): boolean => periodStart(r.view, todayKey()) === r.key;

  async function fetchData(r: Route): Promise<ViewData> {
    const today = todayKey();
    const latestPromise = containsToday(r) ? loadLatest(query) : Promise.resolve(null);
    if (r.view === 'day') {
      const before = addDays(r.key, -1);
      const byDay = await loadDayTotals(query, [before, r.key]);
      const rows = dayRows([r.key], byDay, today);
      const curve = await loadDayCurve(query, r.key, completeCounters(byDay[before]));
      return { route: r, rows, totals: totals(rows), months: null, curve, latest: await latestPromise };
    }
    const days = periodDays(r.view, r.key);
    // Monat und Jahr monatsweise und mit Zwischenspeicher (Jahr am Stück dauert auf vm23 rund 4 s)
    const byDay =
      r.view === 'week'
        ? await loadDayTotals(query, days)
        : await loadDayTotalsByMonth(query, days, { earliestKey: earliest ?? null, todayKey: today, cache: monthCache });
    const rows = dayRows(days, byDay, today);
    const months = r.view === 'year' ? monthRows(Number(r.key.slice(0, 4)), rows, today) : null;
    return { route: r, rows, totals: totals(rows), months, curve: null, latest: await latestPromise };
  }

  async function load(visible: boolean): Promise<void> {
    const mine = ++token;
    clearTimeout(retryTimer);
    const wanted = route;
    try {
      if (earliest === undefined) earliest = await loadEarliest(query);
      const result = await fetchData(wanted);
      if (mine !== token) return;
      data = result;
      status = 'ok';
      renderAll(visible);
    } catch {
      if (mine !== token) return;
      if (!visible && data !== null) return; // stiller Abgleich: alte Werte bleiben, der Hinweis auf alte Daten kommt von selbst
      data = null;
      status = 'error';
      renderAll(false);
      retryTimer = setTimeout(() => void load(true), RETRY_MS);
    }
  }

  setInterval(() => {
    if (status === 'ok' && containsToday(route)) void load(false);
  }, REFRESH_MS);
  setInterval(() => {
    if (status === 'ok') renderLive();
  }, TICK_MS);

  // ---------- Live-Kanal nur im Tag von heute ----------
  function syncLive(): void {
    const want = route.view === 'day' && containsToday(route);
    if (want && liveClient === null) {
      const client = createLiveClient({
        urls: liveUrls(location),
        onMessage: (m) => {
          if (m.kind !== 'power') return;
          lastLive = { power: m.power, t: m.t };
          renderLive();
        },
        onStatus: () => undefined,
      });
      client.start();
      liveClient = client;
    } else if (!want && liveClient !== null) {
      liveClient.stop();
      liveClient = null;
    }
  }

  // ---------- Darstellung ----------
  const leadEl = $('leadText');
  const liveEl = $('live');
  const statusEl = $('status');
  const overlay = $('overlay');
  const main = $('main');
  const tip = $('tip');

  function chipButton(c: { value: string; quantity: ChipQuantity }): HTMLElement {
    const ratio = c.quantity === 'autarky' || c.quantity === 'selfRate';
    const name = ratio ? TEXT[lang][c.quantity as 'autarky' | 'selfRate'] : quantityName(c.quantity as never, lang);
    const b = el(
      'button',
      {
        type: 'button',
        class: 'chip' + (ratio ? ' ratio' : '') + (HATCHED.has(c.quantity) ? ' hatch' : ''),
        'data-q': c.quantity,
        'aria-label': `${c.value}, ${name}`,
      },
      c.value,
    );
    if (!ratio) b.style.setProperty('--q', `var(${QUANTITY_COLOR[c.quantity]})`);
    return b;
  }

  const partNodes = (parts: Part[]): Node[] =>
    parts.map((p) => ('text' in p ? document.createTextNode(p.text) : chipButton(p.chip)));

  function showTip(chip: HTMLElement): void {
    const q = chip.dataset.q as ChipQuantity;
    const L = TEXT[lang];
    const ratio = q === 'autarky' || q === 'selfRate';
    tip.replaceChildren(
      ratio
        ? el('span', {}, el('b', {}, L[q]), q === 'autarky' ? L.autarkyExplain : L.selfRateExplain)
        : el('b', {}, quantityName(q as never, lang)),
    );
    tip.hidden = false;
    chip.classList.add('on');
    const w = main.getBoundingClientRect();
    const r = chip.getBoundingClientRect();
    tip.style.left = Math.max(0, Math.min(r.left - w.left, w.width - tip.offsetWidth)) + 'px';
    tip.style.top = r.bottom - w.top + 6 + 'px';
    chart.highlight(SERIES_OF_CHIP[q] ?? null);
  }
  function hideTip(): void {
    tip.hidden = true;
    main.querySelectorAll('.chip.on').forEach((c) => c.classList.remove('on'));
    chart.highlight(null);
  }
  const lead = $('lead');
  lead.addEventListener('pointerover', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (c) showTip(c);
  });
  lead.addEventListener('pointerout', (e) => {
    const c = (e.target as HTMLElement).closest('.chip');
    if (c && document.activeElement !== c) hideTip();
  });
  lead.addEventListener('focusin', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (c) showTip(c);
  });
  lead.addEventListener('focusout', hideTip);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
  });
  $('legend').addEventListener('pointerover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) chart.highlight(b.dataset.q ?? null);
  });
  $('legend').addEventListener('pointerout', () => chart.highlight(null));
  $('legend').addEventListener('focusin', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) chart.highlight(b.dataset.q ?? null);
  });
  $('legend').addEventListener('focusout', () => chart.highlight(null));
  $('tableBtn').addEventListener('click', () => {
    tableOpen = !tableOpen;
    renderTableState();
  });

  function renderTableState(): void {
    const L = TEXT[lang];
    $('tableBtn').textContent = tableOpen ? L.hideTable : L.showTable;
    $('tableBtn').setAttribute('aria-expanded', String(tableOpen));
    $('tableBox').hidden = !tableOpen;
  }

  /** Live-Zeile und Hinweise zur Aktualität (ändern sich auch ohne neue Abfrage). */
  function renderLive(): void {
    const L = TEXT[lang];
    const now = Date.now();
    liveEl.replaceChildren();
    statusEl.replaceChildren();
    if (!data || status !== 'ok' || !containsToday(data.route)) return;
    if (data.route.view === 'day' && data.curve) {
      const state = liveState(lastLive, data.curve.rows, now);
      if (state) {
        liveEl.append(
          ...partNodes(liveParts(state.power, lang)),
          document.createTextNode(' · '),
          el('span', { class: 'livebadge' + (state.label === 'live' ? ' on' : '') }, state.label === 'live' ? L.live : L.avg10),
        );
      }
    }
    const bits: string[] = [];
    if (data.latest !== null) bits.push(`${L.updated} ${viennaTime(new Date(data.latest))}`);
    if (isStale(data.latest, now)) bits.push(L.outdated);
    bits.forEach((b, i) => statusEl.append(el('span', i === bits.length - 1 && isStale(data!.latest, now) ? { class: 'warn' } : {}, b)));
  }

  function chartModel(d: ViewData): ChartModel {
    if (d.route.view === 'day' && d.curve) {
      const start = viennaDayStart(d.route.key).getTime();
      return dayModel(d.curve.power, start, d.curve.slots, Date.now());
    }
    if (d.route.view === 'year' && d.months) return monthBars(d.months, lang);
    return dayBars(d.rows, d.route.view, lang);
  }

  function renderAll(animate: boolean): void {
    const L = TEXT[lang];
    document.documentElement.lang = lang;
    applyTheme(theme);
    const today = todayKey();
    const first = earliest ?? null;
    bar.update({
      lang,
      theme,
      view: route.view,
      title: periodTitle(route, lang),
      canPrev: stepRoute(route, -1, today, first) !== null,
      canNext: stepRoute(route, 1, today, first) !== null,
      key: route.key,
      min: first,
      max: today,
      atToday: containsToday(route),
    });
    document.title = `${L.brand} · ${periodTitle(route, lang)}`;
    main.dataset.state = status;
    syncLive();
    hideTip();
    renderTableState();
    if (status !== 'ok' || !data) {
      leadEl.replaceChildren();
      liveEl.replaceChildren();
      statusEl.replaceChildren();
      overlay.hidden = false;
      overlay.parentElement?.classList.remove('empty');
      overlay.textContent = status === 'error' ? L.loadError : L.loading;
      overlay.setAttribute('role', status === 'error' ? 'alert' : 'status');
      $('chartNote').textContent = '';
      return;
    }
    const d = data;
    const nowMs = Date.now();
    const nowTime = viennaTime(new Date(d.latest !== null && viennaDateKey(new Date(d.latest)) === today ? d.latest : nowMs));
    leadEl.replaceChildren(
      ...leadParagraphs({ view: d.route.view, key: d.route.key, rows: d.rows, totals: d.totals, lang, nowTime, todayKey: today }).map((p) =>
        el('p', { class: 'big' }, ...partNodes(p)),
      ),
    );
    renderLive();

    const model = chartModel(d);
    const empty = model.series.every((s) => s.data.every((v) => v === null));
    overlay.hidden = !empty;
    overlay.parentElement?.classList.toggle('empty', empty);
    overlay.removeAttribute('role');
    overlay.textContent = empty ? (d.route.view === 'day' ? (d.rows[0].gap ? L.gapDay : L.noDataBefore) : L.noData) : '';
    const title = d.route.view === 'day' ? L.powerChart : d.route.view === 'year' ? L.monthChart : L.energyChart;
    $('chartTitle').textContent = title;
    $('chart').setAttribute('aria-label', `${title}: ${periodTitle(d.route, lang)}`);
    chart.show(model, lang, animate);
    $('legend').replaceChildren(
      ...model.series.map((s) => {
        const b = el('button', { type: 'button', 'data-q': s.key }, swatch(s.key), quantityName(s.key, lang));
        return el('li', {}, b);
      }),
    );
    const notes: string[] = [];
    if (d.route.view !== 'day' && containsToday(d.route)) {
      notes.push(`${d.route.view === 'year' ? monthLabel(today, lang) : dateShort(today, lang)}: ${L.notFinished}`);
    }
    if (d.route.view !== 'day') {
      const gaps = gapSentence(d.rows, d.route.view, lang);
      if (gaps) notes.push(gaps);
    }
    $('chartNote').textContent = notes.join(' · ');
    renderTable($('tableBox'), model, d.route.view, lang, (key) => go(d.route.view === 'year' ? { view: 'month', key } : { view: 'day', key }));
    $('figTitle').textContent = L.figures;
    renderFigures($('figs'), $('ratios'), $('figNote'), { view: d.route.view, rows: d.rows, totals: d.totals, lang });
  }

  history.replaceState(null, '', routeSearch(route));
  renderAll(true);
  void load(true);
}

export type { View };
