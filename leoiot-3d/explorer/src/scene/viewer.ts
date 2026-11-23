// The three.js scene: renderer, camera, controls, lights, picking and labels.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  CurvePath,
  DirectionalLight,
  LineCurve3,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { roomOf } from './names';
import type { WorldPoint } from '../nav/route';

// Start camera relative to the centre of the whole building (legacy: (100, 80, 100))
const START_OFFSET = new Vector3(100, 80, 100);
// A pointer that moved further than this between down and up was a drag, not a click
const CLICK_TOLERANCE_PX = 5;
// Lifts the drawn route clear of the floor slab it's drawn on, to avoid z-fighting.
const ROUTE_Y_OFFSET = 0.2;
const ROUTE_RADIUS = 0.25;
const ROUTE_COLOUR = '#2ecc71';
// A turn/stairs marker, drawn as a real mesh (not a CSS2DObject like the heatmap
// labels) so it's depth-tested against the building the same way the route tube
// already is, instead of always drawing on top of walls regardless of distance.
const ROUTE_MARKER_RADIUS = 0.3;
// How long a newly-revealed stretch of the route (model3d/room-navigation,
// advancing to the next floor) takes to draw itself in.
const ROUTE_GROW_DURATION_MS = 600;
// Room meshes are flat patches lying almost on the floor slab (checked
// 2026-10-30: often 0.15–0.5 units apart). Hits this close to the nearest one
// count as the same surface, so the room wins over the slab under it.
const SAME_SURFACE = 0.5;
// Direction of a printed floor picture's camera from the route it frames: steeper than the start view, so corridors read like a plan.
const PRINT_DIRECTION = new Vector3(0.25, 1, 0.4).normalize();
// Camera distance per world unit of the framed route's size, and the smallest size framed, so a short route keeps some surroundings.
const PRINT_DISTANCE_PER_UNIT = 1.5;
const PRINT_MIN_SIZE = 40;

/** Smoother finish than a linear draw-in. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export interface Label {
  position: Vector3;
  element: HTMLElement;
}

export interface RouteMarkerDot {
  position: Vector3;
  colour: string;
}

interface Growing {
  readonly mesh: Mesh;
  readonly totalIndexCount: number;
  readonly start: number;
}

export class Viewer {
  private readonly renderer: WebGLRenderer;
  private readonly labelRenderer = new CSS2DRenderer();
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly startTarget = new Vector3();
  private current: Object3D | null = null;
  private labels: CSS2DObject[] = [];
  // One mesh per revealed stretch of the active route (the initial segment, plus
  // one more per "next floor"/floor-button reveal); never rebuilt once drawn, see showRoute.
  private segments: Mesh[] = [];
  private routePoints: WorldPoint[] = [];
  private growing: Growing | null = null;
  private routeMarkers: Mesh[] = [];

  /** Called with the room id of a clicked room, or null for a click elsewhere. */
  onPick: (room: string | null) => void = () => undefined;

  constructor(private readonly container: HTMLElement) {
    // Transparent, so the room watermark behind the canvas shows through and a printed picture has no background
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = 'labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene.add(new AmbientLight('#ffffff', 1.4));
    const sun = new DirectionalLight('#ffffff', 0.8);
    sun.position.set(200, 300, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 1000 });
    this.scene.add(sun);

    this.camera = new PerspectiveCamera(45, 1, 1, 100000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.listenForClicks();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.updateGrow();
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    });
  }

  /** Sets the start camera from the model of the whole building. */
  setStart(full: Object3D): void {
    new Box3().setFromObject(full).getCenter(this.startTarget);
    this.resetCamera();
  }

  resetCamera(): void {
    this.camera.position.copy(this.startTarget).add(START_OFFSET);
    this.controls.target.copy(this.startTarget);
    this.controls.update();
  }

  show(root: Object3D): void {
    if (this.current === root) return;
    if (this.current) this.scene.remove(this.current);
    this.scene.add(root);
    this.current = root;
  }

  setLabels(labels: Label[]): void {
    for (const l of this.labels) {
      this.scene.remove(l);
      l.element.remove();
    }
    this.labels = labels.map(({ position, element }) => {
      const obj = new CSS2DObject(element);
      obj.position.copy(position);
      this.scene.add(obj);
      return obj;
    });
  }

  /**
   * Draws a navigation route as a tube along the given points (spec
   * model3d/room-navigation). When `points` simply extends what was already
   * drawn (advancing to the next floor reveals more of the same route), the
   * already-drawn portion is left exactly as it was, as its own segment, and
   * only the new tail grows in, over {@link ROUTE_GROW_DURATION_MS}; anything
   * else (a new route, or fewer points than before) redraws instantly.
   */
  showRoute(points: WorldPoint[]): void {
    const previous = this.routePoints;
    const isGrowth = previous.length > 0 && points.length > previous.length && previous.every((p, i) => p === points[i]);
    this.routePoints = points;
    if (isGrowth) this.startGrow(previous, points);
    else this.rebuildRoute(points);
  }

  /** Removes every segment drawn by {@link showRoute}, if any, and any markers drawn by {@link setRouteMarkers}. */
  clearRoute(): void {
    this.growing = null;
    this.routePoints = [];
    this.disposeSegments();
    this.setRouteMarkers([]);
  }

  /** Replaces the shown turn/stairs markers with one small, fully coloured sphere per marker, at its exact point. A real mesh, not a CSS2DObject, so it's hidden behind a wall the same way the route tube is. */
  setRouteMarkers(markers: readonly RouteMarkerDot[]): void {
    for (const mesh of this.routeMarkers) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.routeMarkers = markers.map((marker) => {
      const mesh = this.buildMarker(marker);
      this.scene.add(mesh);
      return mesh;
    });
  }

  /**
   * A picture of `root` with `route` and `markers` drawn fully (no grow
   * animation), seen from above and framed on the route, as a PNG data URL — for the
   * printed route. The live view is left exactly as it was.
   */
  snapshot(root: Object3D, route: WorldPoint[], markers: readonly RouteMarkerDot[]): string {
    const live = [...this.segments, ...this.routeMarkers].filter((m) => m.visible);
    for (const m of live) m.visible = false;
    const shown = this.current;
    if (shown) this.scene.remove(shown);
    this.scene.add(root);
    const extra = markers.map((m) => this.buildMarker(m));
    if (route.length >= 2) extra.push(this.buildTube(route));
    for (const m of extra) this.scene.add(m);

    const box = route.length > 0 ? new Box3().setFromPoints(route.map((p) => new Vector3(p.x, p.y, p.z))) : new Box3().setFromObject(root);
    const target = box.getCenter(new Vector3());
    const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, PRINT_MIN_SIZE);
    const camera = this.camera.clone();
    camera.position.copy(target).addScaledVector(PRINT_DIRECTION, size * PRINT_DISTANCE_PER_UNIT);
    camera.lookAt(target);
    // Read right after rendering, before the frame is handed to the screen (no preserveDrawingBuffer needed)
    this.renderer.render(this.scene, camera);
    const image = this.renderer.domElement.toDataURL('image/png');

    for (const m of extra) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
    this.scene.remove(root);
    if (shown) this.scene.add(shown);
    for (const m of live) m.visible = true;
    return image;
  }

  private buildMarker({ position, colour }: RouteMarkerDot): Mesh {
    const mesh = new Mesh(new SphereGeometry(ROUTE_MARKER_RADIUS, 16, 16), new MeshBasicMaterial({ color: colour }));
    mesh.position.copy(position);
    return mesh;
  }

  /** A tube mesh along straight segments between `points`, not a smoothed spline: a smoothed curve looks vague and can bow away from the corridor it's meant to follow, especially at a sharp turn. */
  private buildTube(points: WorldPoint[]): Mesh {
    const lifted = points.map((p) => new Vector3(p.x, p.y + ROUTE_Y_OFFSET, p.z));
    const curve = new CurvePath<Vector3>();
    for (let i = 1; i < lifted.length; i++) curve.add(new LineCurve3(lifted[i - 1], lifted[i]));
    const geometry = new TubeGeometry(curve, Math.max(points.length * 2, 4), ROUTE_RADIUS, 8, false);
    return new Mesh(geometry, new MeshBasicMaterial({ color: ROUTE_COLOUR }));
  }

  private rebuildRoute(points: WorldPoint[]): void {
    this.growing = null;
    this.disposeSegments();
    if (points.length < 2) return;
    const mesh = this.buildTube(points);
    this.scene.add(mesh);
    this.segments.push(mesh);
  }

  private disposeSegments(): void {
    for (const mesh of this.segments) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.segments = [];
  }

  /**
   * Starts growing `newPoints`' tail in from the end of `oldPoints`, which
   * stays exactly as already drawn, as its own segment, never touched again.
   * The tail's own geometry (and the Frenet frames `buildTube` derives it
   * from) is built once, up front, at its final, full length — only its
   * `drawRange` changes per animation frame — rather than being rebuilt from
   * a changing, partial point list on every frame, which is what used to
   * make the tube visibly twist and wobble while it grew in (three.js
   * recomputes frames fresh each time, and that's numerically unstable for a
   * straight-segment path with sharp corners).
   */
  private startGrow(oldPoints: WorldPoint[], newPoints: WorldPoint[]): void {
    this.settleGrowing();
    const tailFull = [oldPoints[oldPoints.length - 1], ...newPoints.slice(oldPoints.length)];
    if (tailFull.length < 2) return;
    const mesh = this.buildTube(tailFull);
    const totalIndexCount = mesh.geometry.getIndex()?.count ?? 0;
    mesh.geometry.setDrawRange(0, 0);
    this.scene.add(mesh);
    this.segments.push(mesh);
    this.growing = { mesh, totalIndexCount, start: performance.now() };
  }

  /** Snaps an in-flight reveal to fully drawn and stops animating it, so starting another grow (or clearing the route) leaves it exactly as it is instead of cutting it off mid-way. */
  private settleGrowing(): void {
    if (!this.growing) return;
    this.growing.mesh.geometry.setDrawRange(0, this.growing.totalIndexCount);
    this.growing = null;
  }

  private updateGrow(): void {
    if (!this.growing) return;
    const { mesh, totalIndexCount, start } = this.growing;
    const t = Math.min(1, (performance.now() - start) / ROUTE_GROW_DURATION_MS);
    // Reveal whole rings' worth of triangles (6 indices each), matching how buildTube indexes the tube.
    const revealedIndexCount = Math.round((totalIndexCount / 6) * easeOutCubic(t)) * 6;
    mesh.geometry.setDrawRange(0, revealedIndexCount);
    if (t >= 1) this.growing = null; // finished — stays exactly as drawn until the next showRoute call
  }

  /**
   * The room under a point of the canvas: the nearest hit decides, and a room
   * lying on the nearest surface wins over it. Walls, roof and windows block.
   */
  private pick(clientX: number, clientY: number): string | null {
    if (!this.current) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let nearest: number | null = null;
    for (const hit of this.raycaster.intersectObject(this.current, true)) {
      nearest ??= hit.distance;
      if (hit.distance > nearest + SAME_SURFACE) break;
      const room = roomOf(hit.object);
      if (room !== null) return room;
    }
    return null;
  }

  private listenForClicks(): void {
    const canvas = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || !e.isPrimary) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved <= CLICK_TOLERANCE_PX) this.onPick(this.pick(e.clientX, e.clientY));
    });
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }
}
