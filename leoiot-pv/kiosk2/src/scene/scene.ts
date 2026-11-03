// Das Bild: Himmel mit Nebelmeer und die Berge aus dem Höhengitter. Liest nur den Zustand aus film().
import * as THREE from 'three';
import type { FilmState } from '../core/film';
import { COLS } from '../core/yearData';
import { PAD, xOfU, zOf } from '../core/world';
import { mountainFragment, mountainVertex, skyFragment, skyVertex } from './shaders';

const FOV = 42;

/** Wiederholbares Rauschen als Textur (für Nebel und Wolken); ein Wert je Pixel genügt dem Shader. */
function noiseTexture(size = 256): THREE.DataTexture {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const data = new Uint8Array(size * size * 4);
  const octaves: [number, number][] = [[4, 0.5], [8, 0.27], [16, 0.14], [32, 0.06], [64, 0.03]];
  const grids = octaves.map(([n]) => Float32Array.from({ length: n * n }, rand));
  const st = (x: number) => x * x * (3 - 2 * x);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    octaves.forEach(([n, amp], o) => {
      const fx = (x / size) * n, fy = (y / size) * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = st(fx - ix), ty = st(fy - iy);
      const g = (a: number, b: number) => grids[o][(b % n) * n + (a % n)];
      v += amp * (g(ix, iy) * (1 - tx) * (1 - ty) + g(ix + 1, iy) * tx * (1 - ty) + g(ix, iy + 1) * (1 - tx) * ty + g(ix + 1, iy + 1) * tx * ty);
    });
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.min(255, v * 255);
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export interface Scene {
  setLandscape(grid: Float32Array, days: number): void;
  render(s: FilmState, light: { season: number; dusk: number; phase: number }): void;
  resize(): void;
  setDetail(pixelRatio: number, shadows: boolean): void;
  camera: THREE.PerspectiveCamera;
}

export function createScene(canvas: HTMLCanvasElement): Scene {
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 fehlt');
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 260);

  const uniforms: Record<string, THREE.IUniform> = {
    uDay: { value: 0 }, uFast: { value: 0 }, uCam: { value: new THREE.Vector3() }, uL: { value: new THREE.Vector3(0, 0.1, 1) }, uLit: { value: new THREE.Vector3(0, 0.2, 1) },
    uH: { value: null }, uFog: { value: noiseTexture() }, uPhase: { value: new THREE.Vector2() }, uDusk: { value: 0 }, uShadows: { value: 1 },
    uFwd: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() }, uTan: { value: Math.tan(THREE.MathUtils.degToRad(FOV / 2)) }, uAspect: { value: 1 },
    uBest: { value: -99 }, uBestOn: { value: 0 }, uMile: { value: -99 }, uMileOn: { value: 0 }, uPen: { value: new THREE.Vector3(0, -99, 0) }, uPenA: { value: 0 },
  };

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, depthTest: false, depthWrite: false, vertexShader: skyVertex, fragmentShader: skyFragment }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  let mountains: THREE.Mesh | null = null;
  let heightTex: THREE.DataTexture | null = null;

  function setLandscape(grid: Float32Array, days: number): void {
    const rows = days + PAD * 2;
    heightTex?.dispose();
    heightTex = new THREE.DataTexture(Uint16Array.from(grid, (x) => THREE.DataUtils.toHalfFloat(x)), COLS, rows, THREE.RedFormat, THREE.HalfFloatType);
    heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
    heightTex.needsUpdate = true;
    uniforms.uH.value = heightTex;
    // Drei Punkte je Fenster entlang des Grats, damit die Kante weich wird
    const cols = (COLS - 1) * 3 + 1;
    const position = new Float32Array(rows * cols * 3), aRow = new Float32Array(rows * cols), aU = new Float32Array(rows * cols);
    const index: number[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, u = c / (cols - 1);
      position[i * 3] = xOfU(u); position[i * 3 + 2] = zOf(r - PAD); aRow[i] = r - PAD; aU[i] = u;
      if (r < rows - 1 && c < cols - 1) index.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aRow', new THREE.BufferAttribute(aRow, 1));
    geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    geo.setIndex(index);
    if (mountains) { scene.remove(mountains); mountains.geometry.dispose(); (mountains.material as THREE.Material).dispose(); }
    mountains = new THREE.Mesh(geo, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, side: THREE.DoubleSide, vertexShader: mountainVertex(rows), fragmentShader: mountainFragment(rows) }));
    mountains.frustumCulled = false;
    scene.add(mountains);
  }

  function resize(): void {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
  }
  resize();

  function render(s: FilmState, light: { season: number; dusk: number; phase: number }): void {
    uniforms.uDay.value = s.day;
    uniforms.uFast.value = s.fast;
    uniforms.uPhase.value.set(Math.sin(light.phase), Math.cos(light.phase));
    camera.position.set(...s.cam.pos);
    camera.lookAt(...s.cam.look);
    camera.updateMatrixWorld();
    uniforms.uCam.value.copy(camera.position);
    camera.matrixWorld.extractBasis(uniforms.uRight.value, uniforms.uUp.value, uniforms.uFwd.value);
    uniforms.uFwd.value.negate();
    // Sonne mit festem Platz in der Welt, knapp unter dem Horizont; im Sommer etwas höher
    const el = 0.02 + light.season * 0.07 - light.dusk * 0.2;
    uniforms.uDusk.value = light.dusk;
    uniforms.uL.value.set(-0.36, el, 0.93).normalize();
    uniforms.uLit.value.set(-0.62, Math.max(el, 0.1) + 0.05, 0.75).normalize();
    uniforms.uBest.value = s.best ? s.best.row : -99;
    uniforms.uBestOn.value = s.best ? s.best.glow : 0;
    uniforms.uMile.value = s.mile ? s.mile.row : -99;
    uniforms.uMileOn.value = s.mile ? s.mile.glow : 0;
    if (s.pen) uniforms.uPen.value.set(xOfU(s.pen.u), s.pen.h, zOf(s.pen.row));
    uniforms.uPenA.value = 1 - Math.min(1, s.fast / 0.12);
    renderer.render(scene, camera);
  }

  return {
    setLandscape, render, resize, camera,
    setDetail(pixelRatio, shadows) {
      renderer.setPixelRatio(pixelRatio);
      resize();
      uniforms.uShadows.value = shadows ? 1 : 0;
    },
  };
}
