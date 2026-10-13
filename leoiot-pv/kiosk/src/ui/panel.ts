import type { KioskView } from '../data/view';
import type { Colors } from './colors';

/** Ein Feld des Rasters. update() läuft nur, wenn das Feld Daten zeigt, und muss billig sein, wenn sich nichts geändert hat. */
export interface Panel {
  update(view: KioskView): void;
  /** Theme oder Fenstergröße haben sich geändert. */
  restyle(colors: Colors): void;
}

/** field ist die <section class="field">; das Panel füllt deren .content. */
export type PanelFactory = (field: HTMLElement, colors: Colors) => Panel;
