import './styles/tokens.css';
import './styles/kiosk.css';
import './ui/chartSetup'; // registriert Chart.js
import { buildView } from './data/view';
import { createKiosk } from './data/store';
import { createLiveClient } from './data/live';
import { liveUrls, queryInflux } from './data/api';
import { initTheme } from './ui/theme';
import { readColors } from './ui/colors';
import { applyFieldState, applyPageState, fieldStates, pageState, type FieldStates } from './ui/fieldState';
import { renderHeader } from './ui/header';
import { scheduleNightlyReload } from './ui/reload';
import { watchActivity } from './ui/idle';
import type { Panel } from './ui/panel';
import { createTodayPanel } from './panels/today';
import { createWeekPanel } from './panels/week';
import { createPowerPanel } from './panels/power';
import { createFlowPanel } from './panels/flow';

initTheme(restyle);
let colors = readColors();

const fieldToday = document.getElementById('fieldToday') as HTMLElement;
const fieldWeek = document.getElementById('fieldWeek') as HTMLElement;
const fieldPower = document.getElementById('fieldPower') as HTMLElement;
const fieldFlow = document.getElementById('fieldFlow') as HTMLElement;

const fields: { key: keyof FieldStates; field: HTMLElement; panel: Panel }[] = [
  { key: 'today', field: fieldToday, panel: createTodayPanel(fieldToday, colors) },
  { key: 'week', field: fieldWeek, panel: createWeekPanel(fieldWeek, colors) },
  { key: 'power', field: fieldPower, panel: createPowerPanel(fieldPower, colors) },
  { key: 'flow', field: fieldFlow, panel: createFlowPanel(fieldFlow, colors) },
];

const kiosk = createKiosk({ query: (flux) => queryInflux(flux), now: () => Date.now() });
const live = createLiveClient({
  urls: liveUrls(location),
  onMessage: (m) => kiosk.handleLive(m),
  onStatus: (connected) => kiosk.setLiveConnected(connected),
});

const grid = document.querySelector('main.grid') as HTMLElement;
const pageBox = document.getElementById('pageState') as HTMLElement;
const weekRange = document.getElementById('weekRange') as HTMLElement;

function render(): void {
  const now = Date.now();
  const state = kiosk.getState();
  const view = buildView(state, now);
  renderHeader(view, now);
  if (weekRange.textContent !== view.weekLabel) weekRange.textContent = view.weekLabel;
  const states = fieldStates(state, view);
  applyPageState(grid, pageBox, pageState(states));
  for (const { key, field, panel } of fields) {
    applyFieldState(field, states[key]);
    if (states[key] === 'ok') panel.update(view);
  }
}

function restyle(): void {
  colors = readColors();
  for (const { panel } of fields) panel.restyle(colors);
}

// Store-Änderungen gebündelt rendern
let queued = false;
kiosk.subscribe(() => {
  if (!queued) {
    queued = true;
    setTimeout(() => {
      queued = false;
      render();
    }, 0);
  }
});

setInterval(render, 1000); // Uhr, Veraltet-Hinweis, Ablauf der Live-Werte
window.addEventListener('resize', restyle);
render();
kiosk.start();
live.start();
scheduleNightlyReload();
watchActivity();
