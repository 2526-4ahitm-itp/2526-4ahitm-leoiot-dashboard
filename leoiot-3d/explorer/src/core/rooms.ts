// Rooms in the building models (spec model3d/room-climate-view, "Rooms in the
// model are identified by their room id").

export type FloorId = 'U' | 'E' | '1' | '2' | 'T';

export const FLOORS: readonly FloorId[] = ['U', 'E', '1', '2', 'T'];

// Room ids of platform/data-contract: letters, digits and dots only
const ROOM_ID = /^[A-Za-z0-9.]+$/;

/**
 * Room id of a model node, or null if the node is not a room. Takes the node's
 * name as written in the glTF file: three.js removes dots from Object3D.name
 * (`U74.1` becomes `U741`) and keeps the original in userData.name.
 */
export function roomIdOf(nodeName: string): string | null {
  if (!/^[UE12T]/.test(nodeName)) return null;
  const id = nodeName.split('_')[0];
  return ROOM_ID.test(id) ? id : null;
}

/** Floor a room belongs to, by its first character. */
export function floorOf(roomId: string): FloorId | null {
  const first = roomId.charAt(0);
  return (FLOORS as readonly string[]).includes(first) ? (first as FloorId) : null;
}
