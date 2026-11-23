// What the explorer shows: view, heatmap and selected room, and how user
// actions and live data change them (specs model3d/*; design D6, D11).

import { REJUDGE_EVERY_MS } from './core/age';
import { cell, HEATMAP_FLOORS, heatmapRooms, type HeatmapKind } from './core/heatmap';
import { resolveRoom } from './core/roomAddress';
import { FLOOR_ORDER, type FloorId } from './core/rooms';
import type { RoomStore } from './core/store';
import { markerColour, routeMarkers, type RouteMarker } from './nav/markers';
import { isFloorVisible, knownRooms, routeFloors, routeTo, visibleRoutePoints, type RoutePoint } from './nav/route';
import { HIGHLIGHT_COLOUR, ROOM_BASE_COLOUR } from './scene/materials';
import type { Model, ViewId } from './scene/models';
import type { Label, RouteMarkerDot, Viewer } from './scene/viewer';
import type { Controls } from './ui/controls';
import { el } from './ui/dom';
import type { Navigation } from './ui/navigation';
import { InfoPanel, statusBadge } from './ui/panel';
import type { HeatmapLegend } from './ui/heatmapLegend';
import type { LegendSection, RouteLegend } from './ui/routeLegend';
import type { PrintSheet, RoutePrint } from './ui/routePrint';
import type { RoomWatermark } from './ui/roomWatermark';
import { strings } from './ui/strings';
import { type MeshStandardMaterial, Vector3 } from 'three';

// Lifts a route marker's dot clear of the drawn route tube (radius 0.25), so it sits just above it.
const MARKER_Y_OFFSET = 0.4;

function heatmapAllowed(view: ViewId): view is FloorId {
  return (HEATMAP_FLOORS as readonly string[]).includes(view);
}

export class App {
  private view: ViewId = 'full';
  private heatmap: HeatmapKind | null = null;
  private selected: string | null = null;
  private scheduled = false;
  // The route currently shown, if any, and the floors it crosses in order
  // (e.g. ['E', '1', '2']) — used to start on the right floor, to reveal the
  // route one floor at a time as the user moves up/down, and to drive "Next floor".
  private activeRoute: RoutePoint[] | null = null;
  private routeFloorSequence: FloorId[] = [];
  // The room the active route leads to
  private destination: string | null = null;
  // Which room the watermark shows when both exist: the one the user acted on last
  private watermarkPrefers: 'selected' | 'destination' = 'selected';

  constructor(
    private readonly viewer: Viewer,
    private readonly models: Map<ViewId, Model>,
    private readonly store: RoomStore,
    private readonly controls: Controls,
    private readonly panel: InfoPanel,
    private readonly navigation: Navigation,
    private readonly routeLegend: RouteLegend,
    private readonly heatmapLegend: HeatmapLegend,
    private readonly routePrint: RoutePrint,
    private readonly watermark: RoomWatermark,
  ) {
    viewer.onPick = (room) => (room === null ? this.deselect() : this.select(room));
    panel.onClose = () => this.deselect();
    panel.onNavigate = (room) => this.navigate(room);
    controls.onView = (v) => this.setView(v);
    controls.onReset = () => this.reset();
    controls.onHeatmap = (k) => this.toggleHeatmap(k);
    navigation.setRooms(knownRooms());
    navigation.onNavigate = (room) => this.navigate(room);
    navigation.onClear = () => this.clearRoute();
    navigation.onNextFloor = () => this.nextFloor();
    navigation.onPreviousFloor = () => this.previousFloor();
    routeLegend.onPrint = () => window.print();
    // Also covers the browser's own print command, not only the button
    window.addEventListener('beforeprint', () => this.routePrint.update(this.printSheet()));
    window.addEventListener('keydown', (e) => this.handleKey(e));
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
    // The destination stays selected on the floors the route passes before reaching it
    if (this.selected !== null && this.selected !== this.destination && !this.model(view).rooms.has(this.selected)) this.selected = null;
    this.render();
  }

  /**
   * ↑/↓ move one floor up/down (top to bottom as in the building). The whole
   * building sits conceptually one step above the top floor, so ArrowDown
   * from it enters Floor 2; ArrowUp there is a no-op, same as at Floor 2
   * itself. No-op off the floor stack entirely (the gym) or past the bottom.
   */
  private handleKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    let index: number;
    if (this.view === 'full') index = -1;
    else {
      index = (FLOOR_ORDER as readonly string[]).indexOf(this.view);
      if (index === -1) return;
    }
    const next = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (next < 0 || next >= FLOOR_ORDER.length) return;
    e.preventDefault();
    this.setView(FLOOR_ORDER[next]);
  }

  reset(): void {
    this.heatmap = null;
    this.dropRoute();
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
    // Picking another room than the destination ends the navigation (spec model3d/room-navigation)
    if (this.destination !== null && room !== this.destination) this.dropRoute();
    this.selected = room;
    this.watermarkPrefers = 'selected';
    this.render();
  }

  /**
   * Opens the room the address names (spec platform/room-links): its floor is shown and the room
   * selected with its info panel, as if clicked. A room the model does not have is reported.
   */
  openRoom(room: string): void {
    const target = resolveRoom(room, (floor, id) => this.models.get(floor)?.rooms.has(id) ?? false);
    if (!target.found) {
      this.navigation.reportNotFound(room);
      return;
    }
    this.setView(target.floor);
    this.select(room);
  }

  deselect(): void {
    if (this.selected === null) return;
    this.selected = null;
    this.render();
  }

  /** Starts a navigation route to a room, from the floor the route itself starts on (spec model3d/room-navigation). */
  navigate(room: string): void {
    const result = routeTo(room);
    if (!result.ok) {
      this.navigation.showError(strings.navigation.notFound);
      return;
    }
    this.activeRoute = result.points;
    this.routeFloorSequence = routeFloors(result.points);
    this.destination = room.trim();
    this.watermarkPrefers = 'destination';
    // The destination becomes the selected room, replacing any other; like any selection it replaces a heatmap
    this.selected = this.destination;
    this.heatmap = null;
    // The search box names the destination however navigation started (search or "Navigate here")
    this.navigation.setQuery(this.destination);
    this.setView(this.routeFloorSequence[0]);
  }

  clearRoute(): void {
    this.dropRoute();
    this.render();
  }

  private dropRoute(): void {
    if (this.destination !== null) this.navigation.setQuery('');
    this.activeRoute = null;
    this.routeFloorSequence = [];
    this.destination = null;
  }

  /** Advances to the next floor the active route crosses, revealing that floor's segment (spec model3d/room-navigation). */
  nextFloor(): void {
    if (!this.activeRoute) return;
    const index = (this.routeFloorSequence as readonly string[]).indexOf(this.view);
    if (index === -1 || index >= this.routeFloorSequence.length - 1) return;
    this.setView(this.routeFloorSequence[index + 1]);
  }

  /** Steps back to the floor the active route crosses before the one shown (spec model3d/room-navigation). */
  previousFloor(): void {
    if (!this.activeRoute) return;
    const index = (this.routeFloorSequence as readonly string[]).indexOf(this.view);
    if (index <= 0) return;
    this.setView(this.routeFloorSequence[index - 1]);
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
    this.heatmapLegend.show(this.heatmap);

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

    if (this.activeRoute) {
      this.viewer.showRoute(visibleRoutePoints(this.activeRoute, this.view));
      const visible = this.visibleRouteMarkers();
      this.viewer.setRouteMarkers(this.routeMarkerDots(visible));
      this.routeLegend.update(this.routeLegendSections(visible), true);
      const index = (this.routeFloorSequence as readonly string[]).indexOf(this.view);
      this.navigation.setNextFloorAvailable(index !== -1 && index < this.routeFloorSequence.length - 1);
      this.navigation.setPreviousFloorAvailable(index > 0);
    } else {
      this.viewer.clearRoute();
      this.routeLegend.update([], false);
      this.navigation.setNextFloorAvailable(false);
      this.navigation.setPreviousFloorAvailable(false);
    }
    this.viewer.setLabels(labels);
    this.watermark.show(this.watermarkPrefers === 'selected' ? (this.selected ?? this.destination) : (this.destination ?? this.selected));

    if (this.selected === null) this.panel.hide();
    else this.panel.show(this.selected, this.store.get(this.selected), now);
  }

  /**
   * The active route's markers currently on screen, each paired with its
   * colour. Colours are assigned from the *full* route (before filtering by
   * floor), so a marker keeps the same colour as more of the route is
   * revealed, instead of every marker reshuffling colours each time.
   */
  private visibleRouteMarkers(): { marker: RouteMarker; colour: string }[] {
    if (!this.activeRoute) return [];
    return routeMarkers(this.activeRoute)
      .map((marker, i) => ({ marker, colour: markerColour(i) }))
      .filter(({ marker }) => isFloorVisible(marker.point.floor, this.view));
  }

  /** Each visible marker's sphere position (lifted clear of the route tube) and colour, for {@link Viewer.setRouteMarkers}. */
  private routeMarkerDots(visible: { marker: RouteMarker; colour: string }[]): RouteMarkerDot[] {
    return visible.map(({ marker, colour }) => ({
      position: new Vector3(marker.point.x, marker.point.y + MARKER_Y_OFFSET, marker.point.z),
      colour,
    }));
  }

  /** Groups the given markers into one legend section per floor, top-to-bottom in the building's own order (same as the floor buttons), not the order the route visits them. */
  private routeLegendSections(visible: { marker: RouteMarker; colour: string }[]): LegendSection[] {
    const byFloor = new Map<FloorId, { colour: string; text: string }[]>();
    for (const { marker, colour } of visible) {
      const entries = byFloor.get(marker.point.floor) ?? [];
      entries.push({ colour, text: this.markerText(marker) });
      byFloor.set(marker.point.floor, entries);
    }
    return FLOOR_ORDER.filter((floor) => byFloor.has(floor)).map((floor) => ({
      title: strings.views[floor],
      entries: byFloor.get(floor)!,
    }));
  }

  /**
   * The whole active route for paper: every floor it crosses, in the order it
   * walks them, each pictured with its part of the route (and the floors
   * beneath, as on screen) and its markers as numbered steps.
   */
  private printSheet(): PrintSheet | null {
    const route = this.activeRoute;
    if (!route || this.destination === null) return null;
    const markers = routeMarkers(route).map((marker, i) => ({ marker, colour: markerColour(i) }));
    return {
      title: strings.routePrint.title(this.destination),
      start: strings.routePrint.start,
      floors: this.routeFloorSequence.map((floor) => ({
        title: strings.views[floor],
        image: this.viewer.snapshot(
          this.model(floor).root,
          visibleRoutePoints(route, floor),
          this.routeMarkerDots(markers.filter(({ marker }) => isFloorVisible(marker.point.floor, floor))),
        ),
        steps: markers.filter(({ marker }) => marker.point.floor === floor).map(({ marker, colour }) => ({ colour, text: this.markerText(marker) })),
      })),
      arrival: strings.routePrint.arrival(this.destination),
    };
  }

  private markerText(marker: RouteMarker): string {
    if (marker.kind === 'turn') return marker.direction === 'left' ? strings.routeMarker.turnLeft : strings.routeMarker.turnRight;
    const floorName = strings.views[marker.toFloor];
    return marker.direction === 'up' ? strings.routeMarker.stairsUp(floorName) : strings.routeMarker.stairsDown(floorName);
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
