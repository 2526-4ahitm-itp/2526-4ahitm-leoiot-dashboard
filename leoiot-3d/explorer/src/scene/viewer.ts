// The three.js scene: renderer, camera, controls, lights, picking and labels.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
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
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { polylineLength, polylinePrefix } from '../core/polyline';
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
// How long a newly-revealed stretch of the route (model3d/room-navigation,
// advancing to the next floor) takes to draw itself in.
const ROUTE_GROW_DURATION_MS = 600;
// Room meshes are flat patches lying almost on the floor slab (checked
// 2026-10-30: often 0.15–0.5 units apart). Hits this close to the nearest one
// count as the same surface, so the room wins over the slab under it.
const SAME_SURFACE = 0.5;

/** Smoother finish than a linear draw-in. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export interface Label {
  position: Vector3;
  element: HTMLElement;
}

interface RouteGrow {
  /** The full newly-revealed tail, starting at the end of the already-drawn portion. */
  tailFull: WorldPoint[];
  tailLength: number;
  start: number;
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
  private route: Mesh | null = null;
  private routePoints: WorldPoint[] = [];
  private routeGrow: RouteGrow | null = null;
  private growMesh: Mesh | null = null;

  /** Called with the room id of a clicked room, or null for a click elsewhere. */
  onPick: (room: string | null) => void = () => undefined;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = 'labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene.background = new Color('#3a3d42');
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
   * already-drawn portion is left exactly as it was and only the new tail
   * grows in, over {@link ROUTE_GROW_DURATION_MS}; anything else (a new
   * route, or fewer points than before) redraws instantly.
   */
  showRoute(points: WorldPoint[]): void {
    const previous = this.routePoints;
    const isGrowth = previous.length > 0 && points.length > previous.length && previous.every((p, i) => p === points[i]);
    this.routePoints = points;
    if (isGrowth) this.startGrow(previous, points);
    else {
      this.cancelGrow();
      this.rebuildRoute(points);
    }
  }

  /** Removes a route drawn by {@link showRoute}, if any. */
  clearRoute(): void {
    this.cancelGrow();
    this.routePoints = [];
    this.disposeRoute();
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
    this.disposeRoute();
    if (points.length < 2) return;
    this.route = this.buildTube(points);
    this.scene.add(this.route);
  }

  private disposeRoute(): void {
    if (!this.route) return;
    this.scene.remove(this.route);
    this.route.geometry.dispose();
    (this.route.material as MeshBasicMaterial).dispose();
    this.route = null;
  }

  /** Starts growing `newPoints`' tail in from the end of `oldPoints`, which stays exactly as already drawn. */
  private startGrow(oldPoints: WorldPoint[], newPoints: WorldPoint[]): void {
    this.cancelGrow();
    if (!this.route) this.route = this.buildTube(oldPoints); // shouldn't happen — oldPoints was already drawn — but never leave nothing showing
    const tailFull = [oldPoints[oldPoints.length - 1], ...newPoints.slice(oldPoints.length)];
    this.routeGrow = { tailFull, tailLength: polylineLength(tailFull), start: performance.now() };
  }

  private cancelGrow(): void {
    this.routeGrow = null;
    if (!this.growMesh) return;
    this.scene.remove(this.growMesh);
    this.growMesh.geometry.dispose();
    (this.growMesh.material as MeshBasicMaterial).dispose();
    this.growMesh = null;
  }

  private updateGrow(): void {
    if (!this.routeGrow) return;
    const { tailFull, tailLength, start } = this.routeGrow;
    const t = Math.min(1, (performance.now() - start) / ROUTE_GROW_DURATION_MS);
    const prefix = polylinePrefix(tailFull, tailLength * easeOutCubic(t));
    if (this.growMesh) {
      this.scene.remove(this.growMesh);
      this.growMesh.geometry.dispose();
      (this.growMesh.material as MeshBasicMaterial).dispose();
      this.growMesh = null;
    }
    if (prefix.length >= 2) {
      this.growMesh = this.buildTube(prefix);
      this.scene.add(this.growMesh);
    }
    if (t >= 1) this.routeGrow = null; // finished — the drawn tail stays exactly as it is until the next showRoute call
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
