// Materials by node name, as in the legacy explorer: glass, metal, and a light
// base material for everything else. Every room part gets its own material so
// that it can be highlighted or coloured on its own.

import { Color, type Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { nodeName } from './names';

export const ROOM_BASE_COLOUR = new Color('#e6e6e6');
export const HIGHLIGHT_COLOUR = new Color('#f1c40f');

const glass = new MeshStandardMaterial({ color: '#b8d4e6', transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.1 });
const metal = new MeshStandardMaterial({ color: '#8a8f95', metalness: 0.6, roughness: 0.4 });
const base = new MeshStandardMaterial({ color: '#e6e6e6', roughness: 0.9 });

export function structureMaterial(name: string): MeshStandardMaterial {
  if (name.includes('GLAS')) return glass;
  if (name.includes('METALL') || name.includes('FENSTERRAHMEN')) return metal;
  return base;
}

export function roomMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: ROOM_BASE_COLOUR.clone(), roughness: 0.85 });
}

/** Replaces the materials of a loaded model; returns the meshes of every room part. */
export function applyMaterials(root: Object3D, roomOf: (mesh: Object3D) => string | null): Map<string, Mesh[]> {
  const rooms = new Map<string, Mesh[]>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const room = roomOf(mesh);
    if (room === null) {
      mesh.material = structureMaterial(nodeName(mesh));
      return;
    }
    mesh.material = roomMaterial();
    const parts = rooms.get(room) ?? [];
    parts.push(mesh);
    rooms.set(room, parts);
  });
  return rooms;
}
