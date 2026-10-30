// What the explorer shows: view, heatmap and selected room, and how user
// actions and live data change them (specs model3d/*; design D6, D11).

import { REJUDGE_EVERY_MS } from './core/age';
import { cell, HEATMAP_FLOORS, heatmapRooms, type HeatmapKind } from './core/heatmap';
import type { FloorId } from './core/rooms';
import type { RoomStore } from './core/store';
import { HIGHLIGHT_COLOUR, ROOM_BASE_COLOUR } from './scene/materials';
import type { Model, ViewId } from './scene/models';
import type { Label, Viewer } from './scene/viewer';
import type { Controls } from './ui/controls';
import { el } from './ui/dom';
import { InfoPanel, statusBadge } from './ui/panel';
import { strings } from './ui/strings';
import type { MeshStandardMaterial } from 'three';

function heatmapAllowed(view: ViewId): view is FloorId {
  return (HEATMAP_FLOORS as readonly string[]).includes(view);
}

export class App {
  private view: ViewId = 'full';
  private heatmap: HeatmapKind | null = null;
  private selected: string | null = null;
  private scheduled = false;

  constructor(
    private readonly viewer: Viewer,
    private readonly models: Map<ViewId, Model>,
    private readonly store: RoomStore,
    private readonly controls: Controls,
    private readonly panel: InfoPanel,
  ) {
    viewer.onPick = (room) => (room === null ? this.deselect() : this.select(room));
    panel.onClose = () => this.deselect();
    controls.onView = (v) => this.setView(v);
    controls.onReset = () => this.reset();
    controls.onHeatmap = (k) => this.toggleHeatmap(k);
    store.subscribe(() => this.schedule());
    // Values turn stale without a new message
    setInterval(() => this.schedule(), REJUDGE_EVERY_MS);
    viewer.setStart(this.model('full').root);
    this.render();
  }

  private model(view: ViewId): Model {
    const m = this.models.get(view);
    if (!m) throw new Error(`model ${view} not loaded`);
    return m;
  }

  setView(view: ViewId): void {
    this.view = view;
    // A heatmap follows the floor; whole building and gym have none
    if (!heatmapAllowed(view)) this.heatmap = null;
    if (this.selected !== null && !this.model(view).rooms.has(this.selected)) this.selected = null;
    this.render();
  }

  reset(): void {
    this.heatmap = null;
    this.setView('full');
    this.viewer.resetCamera();
  }

  toggleHeatmap(kind: HeatmapKind): void {
    if (!heatmapAllowed(this.view)) return;
    this.heatmap = this.heatmap === kind ? null : kind;
    // Heatmap colours and the selection highlight would mix: one or the other
    if (this.heatmap) this.selected = null;
    this.render();
  }

  select(room: string): void {
    this.heatmap = null;
    this.selected = room;
    this.render();
  }

  deselect(): void {
    if (this.selected === null) return;
    this.selected = null;
    this.render();
  }

  /** Renders at most once per frame, however many messages arrive. */
  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.render();
    });
  }

  private render(): void {
    const now = Date.now();
    const model = this.model(this.view);
    this.viewer.show(model.root);
    this.controls.update(this.view, this.heatmap, heatmapAllowed(this.view));

    const coloured = new Map<string, string>();
    const labels: Label[] = [];
    if (this.heatmap && heatmapAllowed(this.view)) {
      for (const room of heatmapRooms(this.view, model.rooms.keys())) {
        const c = cell(this.heatmap, this.store.get(room), now);
        if (c.kind !== 'none') coloured.set(room, c.colour);
        labels.push({ position: model.centres.get(room)!, element: this.label(c) });
      }
    }
    for (const [room, parts] of model.rooms) {
      const colour = room === this.selected ? HIGHLIGHT_COLOUR : coloured.get(room) ?? ROOM_BASE_COLOUR;
      for (const p of parts) (p.material as MeshStandardMaterial).color.set(colour);
    }
    this.viewer.setLabels(labels);

    if (this.selected === null) this.panel.hide();
    else this.panel.show(this.selected, this.store.get(this.selected), now);
  }

  private label(c: ReturnType<typeof cell>): HTMLElement {
    if (c.kind === 'none') return el('div', 'label label-nodata', strings.heatmap.noData);
    const label = el('div', c.kind === 'stale' ? 'label label-stale' : 'label');
    if (c.kind === 'stale') label.append(el('span', 'label-warning', '⚠'));
    label.append(el('span', undefined, c.text));
    if (c.status && c.kind === 'current') label.append(statusBadge(c.value, false));
    return label;
  }
}
