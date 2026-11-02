// Loading the building models (spec model3d/building-viewer, "The models are
// loaded before the explorer can be used"; design D5, D6).

import { Box3, type Mesh, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fullUrl from '../../models/ModelFull.gltf?url';
import uUrl from '../../models/ModelU.gltf?url';
import eUrl from '../../models/ModelE.gltf?url';
import f1Url from '../../models/Model1F.gltf?url';
import f2Url from '../../models/Model2F.gltf?url';
import tUrl from '../../models/ModelT.gltf?url';
import type { FloorId } from '../core/rooms';
import { applyMaterials } from './materials';
import { roomOf } from './names';

export type ViewId = 'full' | FloorId;

const URLS: Record<ViewId, string> = { full: fullUrl, U: uUrl, E: eUrl, '1': f1Url, '2': f2Url, T: tUrl };
export const VIEWS = Object.keys(URLS) as ViewId[];

export interface Model {
  root: Object3D;
  /** Parts of every room, by room id */
  rooms: Map<string, Mesh[]>;
  /** Centre of every room in world space, for labels */
  centres: Map<string, Vector3>;
}

export type Progress = (done: number, total: number, bytes: number) => void;

/** Some models could not be loaded; the others stay loaded. */
export class LoadError extends Error {
  constructor(
    readonly failed: number,
    readonly total: number,
  ) {
    super(`${failed} of ${total} models failed to load`);
  }
}

function prepare(root: Object3D): Model {
  root.updateMatrixWorld(true);
  const rooms = applyMaterials(root, roomOf);
  const centres = new Map<string, Vector3>();
  for (const [room, parts] of rooms) {
    const box = new Box3();
    for (const p of parts) box.expandByObject(p);
    centres.set(room, box.getCenter(new Vector3()));
  }
  return { root, rooms, centres };
}

/**
 * Loads every model that is not loaded yet, in parallel. Models loaded by an
 * earlier call are kept, so "Try again" fetches only what failed.
 */
export async function loadModels(loaded: Map<ViewId, Model>, onProgress: Progress): Promise<void> {
  const loader = new GLTFLoader();
  const bytes = new Map<ViewId, number>();
  let done = loaded.size;
  const report = () => onProgress(done, VIEWS.length, [...bytes.values()].reduce((a, b) => a + b, 0));
  report();
  const missing = VIEWS.filter((v) => !loaded.has(v));
  const results = await Promise.allSettled(
    missing.map(async (view) => {
      const gltf = await loader.loadAsync(URLS[view], (e) => {
        bytes.set(view, e.loaded);
        report();
      });
      loaded.set(view, prepare(gltf.scene));
      done++;
      report();
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) throw new LoadError(failed, VIEWS.length);
}
