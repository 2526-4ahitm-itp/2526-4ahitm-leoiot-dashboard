// The room given in the explorer's address, `/3d/?room=<room id>` (spec platform/room-links,
// "A room has an address in each web application"): which floor to show for it, or that the
// model has no such room.

import { floorOf, type FloorId } from './rooms';

// Room ids of platform/data-contract: letters, digits and dots only
const ROOM_ID = /^[A-Za-z0-9.]+$/;
const MAX_ROOM_LENGTH = 32;

/** The `room` of the address as written, or null when the address names no room. */
export function roomFromAddress(search: string): string | null {
  const room = new URLSearchParams(search).get('room');
  return room === null || room === '' ? null : room.slice(0, MAX_ROOM_LENGTH);
}

export type RoomTarget = { found: true; floor: FloorId } | { found: false };

/**
 * Where the room lies: its floor by the room id's first character, if that floor's model has the
 * room. An id that breaks the room id rule, or a room the model does not have, is not found.
 */
export function resolveRoom(room: string, hasRoom: (floor: FloorId, room: string) => boolean): RoomTarget {
  if (!ROOM_ID.test(room)) return { found: false };
  const floor = floorOf(room);
  return floor !== null && hasRoom(floor, room) ? { found: true, floor } : { found: false };
}
