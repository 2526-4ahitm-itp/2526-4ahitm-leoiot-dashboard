// Room search and the start/clear navigation controls (spec model3d/room-navigation,
// "Visible controls to start and clear navigation").

import { filterRooms } from '../core/roomSearch';
import { el } from './dom';
import { strings } from './strings';

export class Navigation {
  readonly element = el('div', 'nav');
  private readonly toggle = el('button', 'button nav-toggle', strings.navigation.toggle);
  private readonly panel = el('div', 'nav-panel');
  private readonly input = el('input', 'nav-input') as HTMLInputElement;
  private readonly suggestions = el('ul', 'nav-suggestions');
  private readonly goButton = el('button', 'button', strings.navigation.go);
  private readonly clearButton = el('button', 'button', strings.navigation.clear);
  private readonly error = el('p', 'nav-error');
  private rooms: readonly string[] = [];

  onNavigate: (room: string) => void = () => undefined;
  onClear: () => void = () => undefined;

  constructor() {
    this.input.type = 'text';
    this.input.placeholder = strings.navigation.searchPlaceholder;
    this.input.autocomplete = 'off';
    this.error.hidden = true;
    this.panel.hidden = true;

    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', () => this.setOpen(this.panel.hidden));
    this.input.addEventListener('input', () => this.renderSuggestions());
    this.goButton.addEventListener('click', () => this.go());
    this.clearButton.addEventListener('click', () => {
      this.hideError();
      this.onClear();
    });

    const actions = el('div', 'nav-actions');
    actions.append(this.goButton, this.clearButton);
    this.panel.append(this.input, this.suggestions, actions, this.error);
    this.element.append(this.toggle, this.panel);
  }

  /** The room ids a search can match; set once the models are loaded. */
  setRooms(rooms: readonly string[]): void {
    this.rooms = rooms;
  }

  /** Shows a rejection message (spec "Invalid destination does not start navigation"). */
  showError(message: string): void {
    this.error.hidden = false;
    this.error.textContent = message;
  }

  hideError(): void {
    this.error.hidden = true;
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    if (open) this.input.focus();
  }

  private renderSuggestions(): void {
    this.suggestions.replaceChildren();
    for (const room of filterRooms(this.input.value, this.rooms)) {
      const item = el('li', 'nav-suggestion', room);
      item.addEventListener('click', () => {
        this.input.value = room;
        this.suggestions.replaceChildren();
        this.go();
      });
      this.suggestions.append(item);
    }
  }

  private go(): void {
    const room = this.input.value.trim();
    if (!room) return;
    this.hideError();
    this.onNavigate(room);
  }
}
