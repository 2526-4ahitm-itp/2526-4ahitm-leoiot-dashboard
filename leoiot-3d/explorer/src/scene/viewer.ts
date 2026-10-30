// The three.js scene: renderer, camera, controls, lights, picking and labels.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { isGlass } from './materials';
import { roomOf } from './names';

// Start camera relative to the centre of the whole building (legacy: (100, 80, 100))
const START_OFFSET = new Vector3(100, 80, 100);
// A pointer that moved further than this between down and up was a drag, not a click
const CLICK_TOLERANCE_PX = 5;
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

  /**
   * The room under a point of the canvas: the nearest hit decides, see-through
   * glass is skipped, and a room lying on the nearest surface wins over it.
   */
  private pick(clientX: number, clientY: number): string | null {
    if (!this.current) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let nearest: number | null = null;
    for (const hit of this.raycaster.intersectObject(this.current, true)) {
      const material = (hit.object as { material?: Parameters<typeof isGlass>[0] }).material;
      if (material && isGlass(material)) continue;
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
