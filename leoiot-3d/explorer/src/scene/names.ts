import type { Object3D } from 'three';
import { roomIdOf } from '../core/rooms';

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
