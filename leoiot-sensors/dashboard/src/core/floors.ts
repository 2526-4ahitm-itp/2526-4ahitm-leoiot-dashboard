// The floor of a room follows from the first character of its room id (platform/data-contract).
// The list shows floors in building order, rooms of no known floor last. No DOM here.

export type FloorId = 'U' | 'E' | '1' | '2' | 'T';
/** Building order, from the basement up, then the gym. */
export const FLOORS: readonly FloorId[] = ['U', 'E', '1', '2', 'T'];

export function floorOf(roomId: string): FloorId | null {
  const first = roomId.charAt(0);
  return (FLOORS as readonly string[]).includes(first) ? (first as FloorId) : null;
}

/** Natural order: digit runs compare as numbers (`T2` before `T10`), everything else by code unit. */
export function compareRoomIds(a: string, b: string): number {
  const partsA = a.match(/\d+|\D+/g) ?? [];
  const partsB = b.match(/\d+|\D+/g) ?? [];
  const n = Math.min(partsA.length, partsB.length);
  for (let i = 0; i < n; i++) {
    const x = partsA[i];
    const y = partsB[i];
    const digits = /^\d/.test(x) && /^\d/.test(y);
    if (digits) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff < 0 ? -1 : 1;
      if (x.length !== y.length) return x.length < y.length ? -1 : 1; // 07 after 7, so that the order stays total
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return partsA.length - partsB.length;
}

export interface FloorGroup {
  floor: FloorId | null;
  rooms: string[];
}

/** Only non-empty groups, in list order, rooms sorted. */
export function groupByFloor(ids: readonly string[]): FloorGroup[] {
  const order: (FloorId | null)[] = [...FLOORS, null];
  return order
    .map((floor) => ({ floor, rooms: ids.filter((id) => floorOf(id) === floor).sort(compareRoomIds) }))
    .filter((g) => g.rooms.length > 0);
}
