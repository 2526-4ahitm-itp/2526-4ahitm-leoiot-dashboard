// Filtering room ids for the navigation search box (spec model3d/room-navigation).

const MAX_SUGGESTIONS = 8;

/** Rooms whose id contains the query (case-insensitive), prefix matches first. */
export function filterRooms(query: string, rooms: readonly string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const room of rooms) {
    const lower = room.toLowerCase();
    if (lower.startsWith(q)) prefix.push(room);
    else if (lower.includes(q)) contains.push(room);
  }
  return [...prefix.sort(), ...contains.sort()].slice(0, MAX_SUGGESTIONS);
}
