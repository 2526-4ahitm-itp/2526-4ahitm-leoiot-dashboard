// Room search and the start/clear navigation controls (spec model3d/room-navigation,
// "Visible controls to start and clear navigation").

import { filterRooms } from '../core/roomSearch';
import { el } from './dom';
import { strings } from './strings';

export class Navigation {
  /** The "Search" dock group: a toggle that opens a popover above the dock. */
  readonly element = el('div', 'dock-group dock-group-search');
  /**
   * Its own fixed control above the dock, not tucked into the collapsible
   * search popover: it stays usable while advancing through a route even
   * with the popover closed.
   */
  readonly nextFloorElement = el('button', 'button next-floor', strings.navigation.nextFloor);
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
  onNextFloor: () => void = () => undefined;

  constructor() {
    this.input.type = 'text';
    this.input.placeholder = strings.navigation.searchPlaceholder;
    this.input.autocomplete = 'off';
    this.error.hidden = true;
    this.panel.hidden = true;
    this.nextFloorElement.hidden = true;

    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', () => this.setOpen(this.panel.hidden));
    window.addEventListener('resize', () => {
      if (!this.panel.hidden) this.positionPanel();
    });
    this.input.addEventListener('input', () => this.renderSuggestions());
    this.goButton.addEventListener('click', () => this.go());
    this.clearButton.addEventListener('click', () => {
      this.hideError();
      this.onClear();
    });
    this.nextFloorElement.addEventListener('click', () => this.onNextFloor());

    const actions = el('div', 'nav-actions');
    actions.append(this.goButton, this.clearButton);
    this.panel.append(this.input, this.suggestions, actions, this.error);
    this.element.append(el('span', 'dock-group-label', strings.dock.search), this.toggle, this.panel);
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

  /** Shows or hides "Next floor" — visible only while an active route continues onto a floor not yet shown. */
  setNextFloorAvailable(available: boolean): void {
    this.nextFloorElement.hidden = !available;
  }

  /**
   * Closes the search popover once a route has actually started, so it
   * doesn't sit over "Next floor" above the dock. Left open on a rejected
   * destination, so the error message stays visible (spec "Invalid
   * destination does not start navigation").
   */
  closeOnRouteStarted(): void {
    this.setOpen(false);
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      this.positionPanel();
      this.input.focus();
    }
  }

  /**
   * Centres the popover above the Search toggle itself, not the screen: the
   * dock (and the toggle within it) moved to the left edge of the screen,
   * no longer centred, so a fixed `left: 50%` would leave the popover
   * floating away from the control that opened it.
   */
  private positionPanel(): void {
    const rect = this.toggle.getBoundingClientRect();
    this.panel.style.left = `${rect.left + rect.width / 2}px`;
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
