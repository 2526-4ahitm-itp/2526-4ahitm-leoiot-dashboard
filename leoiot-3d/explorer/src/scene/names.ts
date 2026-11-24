import type { Object3D } from 'three';
import { floorOf, type FloorId, roomIdOf } from '../core/rooms';

/**
 * The node name as written in the glTF file. GLTFLoader keeps it in
 * userData.name; Object3D.name has dots and other characters removed.
 * A mesh of a node with several primitives is a child of that node.
 */
export function nodeName(obj: Object3D): string {
  for (let o: Object3D | null = obj; o; o = o.parent) {
    const n = o.userData.name;
    if (typeof n === 'string') return n;
  }
  return obj.name;
}

export function roomOf(obj: Object3D): string | null {
  return roomIdOf(nodeName(obj));
}

// A structure (non-room) node's own floor, by the prefix the model files give it (checked 2026-11-24 across all models/*.gltf).
const STRUCTURE_FLOOR_PREFIX: Record<string, FloorId> = {
  cellar: 'U',
  ground_floor: 'E',
  first_floor: '1',
  second_floor: '2',
};

/**
 * The floor a node belongs to: a room's own floor, or a structure node's by
 * its name prefix. Null for a node that is neither (the gym model stacks no
 * floors, so every one of its nodes is null here).
 */
export function floorOfNode(obj: Object3D): FloorId | null {
  const room = roomOf(obj);
  if (room !== null) return floorOf(room);
  const name = nodeName(obj);
  const prefix = Object.keys(STRUCTURE_FLOOR_PREFIX).find((p) => name.startsWith(p));
  return prefix ? STRUCTURE_FLOOR_PREFIX[prefix] : null;
}
