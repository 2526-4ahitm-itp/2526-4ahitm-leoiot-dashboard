// The room shown comes from the address. It ends up in a Flux string and in an
// MQTT topic, so it is checked against the room id rule of platform/data-contract
// ("only letters, digits and dots") before it is used for anything else.

export const DEFAULT_ROOM = '105';
export const MAX_ROOM_LENGTH = 32;

const ROOM_ID = /^[A-Za-z0-9.]+$/;

/** True for a room id that is safe in a Flux string and a topic level. */
export function isValidRoomId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_ROOM_LENGTH && ROOM_ID.test(id);
}

/** Throws unless the id is valid; the query and topic builders call it as the last line of defence. */
export function assertRoomId(id: string): string {
  if (!isValidRoomId(id)) throw new Error('invalid room id');
  return id;
}

export interface RoomChoice {
  /** The id as written in the address (or the default), never changed. */
  id: string;
  /** False when the id breaks the room id rule; nothing is queried for such a room. */
  valid: boolean;
}

/** Reads `?room=` from a location search string. No room (or an empty one) means room 105. */
export function roomFromSearch(search: string): RoomChoice {
  const given = new URLSearchParams(search).get('room');
  const id = given === null || given === '' ? DEFAULT_ROOM : given;
  return { id, valid: isValidRoomId(id) };
}

/** Room id for display in a sentence: long nonsense in the address must not break the layout. */
export function displayRoomId(id: string, max = 40): string {
  return id.length > max ? id.slice(0, max) + '…' : id;
}
