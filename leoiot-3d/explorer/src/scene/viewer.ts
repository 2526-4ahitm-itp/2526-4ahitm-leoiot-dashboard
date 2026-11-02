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
// Room meshes are flat patches lying almost on the floor slab (checked
// 2026-10-30: often 0.15–0.5 units apart). Hits this close to the nearest one
// count as the same surface, so the room wins over the slab under it.
const SAME_SURFACE = 0.5;

export interface Label {
  position: Vector3;
  element: HTMLElement;
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

  /** Draws a navigation route as a tube along the given points (spec model3d/room-navigation). */
  showRoute(points: WorldPoint[]): void {
    this.clearRoute();
    if (points.length < 2) return;
    // Straight segments between waypoints, not a smoothed spline: a smoothed
    // curve looks vague and can bow away from the corridor it's meant to
    // follow, especially at a sharp turn.
    const lifted = points.map((p) => new Vector3(p.x, p.y + ROUTE_Y_OFFSET, p.z));
    const curve = new CurvePath<Vector3>();
    for (let i = 1; i < lifted.length; i++) curve.add(new LineCurve3(lifted[i - 1], lifted[i]));
    const geometry = new TubeGeometry(curve, Math.max(points.length * 2, 4), ROUTE_RADIUS, 8, false);
    const material = new MeshBasicMaterial({ color: ROUTE_COLOUR });
    this.route = new Mesh(geometry, material);
    this.scene.add(this.route);
  }

  /** Removes a route drawn by {@link showRoute}, if any. */
  clearRoute(): void {
    if (!this.route) return;
    this.scene.remove(this.route);
    this.route.geometry.dispose();
    (this.route.material as MeshBasicMaterial).dispose();
    this.route = null;
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
