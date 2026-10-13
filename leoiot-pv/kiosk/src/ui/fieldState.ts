// Zustand je Feld: Daten zeigen oder einen Hinweis statt des Diagramms.
import type { KioskState } from '../data/store';
import type { KioskView } from '../data/view';

export type FieldState = 'ok' | 'loading' | 'empty' | 'error' | 'nopower';

export interface FieldStates {
  today: FieldState;
  week: FieldState;
  power: FieldState;
  flow: FieldState;
}

function todayState(state: KioskState, view: KioskView): FieldState {
  if (state.todayStatus !== 'ok') return state.todayStatus;
  return view.today !== null ? 'ok' : 'empty';
}

/** Zustand je Feld. Reine Funktion. */
export function fieldStates(state: KioskState, view: KioskView): FieldStates {
  const today = todayState(state, view);
  let flow: FieldState;
  if (view.flow !== null) flow = 'ok';
  else if (today !== 'ok') flow = today;
  else flow = 'nopower';
  return { today, week: state.weekStatus, power: today, flow };
}

/** Überschrift und Erklärung zu einem Zustand; null bei 'ok'. Reine Funktion. */
export function stateText(s: FieldState): { title: string; detail: string } | null {
  switch (s) {
    case 'ok':
      return null;
    case 'loading':
      return { title: 'Daten werden geladen', detail: '' };
    case 'error':
      return { title: 'Keine Daten', detail: 'Die Datenquelle antwortet nicht. Neuer Versuch läuft.' };
    case 'empty':
      return {
        title: 'Keine Daten',
        detail: 'Die Datenquelle liefert für diesen Zeitraum keine Messwerte. Neuer Versuch läuft.',
      };
    case 'nopower':
      return { title: 'Keine Daten', detail: 'Für die letzten 10 Minuten liegen noch keine Messwerte vor.' };
  }
}

/** Setzt Überschrift, Erklärung und Klasse loading eines Hinweises. */
function fillState(box: HTMLElement, s: FieldState, text: { title: string; detail: string }): void {
  const title = box.querySelector('b');
  const detail = box.querySelector<HTMLElement>('span');
  if (title) title.textContent = text.title;
  if (detail) {
    detail.textContent = text.detail;
    detail.hidden = text.detail === '';
  }
  box.classList.toggle('loading', s === 'loading');
}

/** Zeigt im Feld entweder .content oder den Hinweis und setzt data-state. */
export function applyFieldState(field: HTMLElement, s: FieldState): void {
  if (field.dataset.state === s) return;
  field.dataset.state = s;
  const content = field.querySelector<HTMLElement>('.content');
  const box = field.querySelector<HTMLElement>('.state');
  if (!content || !box) return;
  const text = stateText(s);
  if (text === null) {
    content.hidden = false;
    box.hidden = true;
    return;
  }
  content.hidden = true;
  box.hidden = false;
  fillState(box, s, text);
}

export type PageState = 'loading' | 'error' | 'empty';

/** Gemeinsamer Zustand ohne Daten, wenn alle vier Felder genau denselben haben; sonst null. Reine Funktion. */
export function pageState(states: FieldStates): PageState | null {
  const s = states.today;
  if (states.week !== s || states.power !== s || states.flow !== s) return null;
  return s === 'loading' || s === 'error' || s === 'empty' ? s : null;
}

/** Zeigt die gemeinsame Meldung über der ganzen Fläche (oder blendet sie aus) und setzt data-page-state. */
export function applyPageState(grid: HTMLElement, box: HTMLElement, s: PageState | null): void {
  if ((grid.dataset.pageState ?? null) === s) return;
  if (s === null) {
    delete grid.dataset.pageState;
    box.hidden = true;
    return;
  }
  grid.dataset.pageState = s;
  box.hidden = false;
  const text = stateText(s);
  if (text) fillState(box, s, text);
}
