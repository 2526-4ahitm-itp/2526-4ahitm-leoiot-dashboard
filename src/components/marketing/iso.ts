// Geometrie des isometrischen Platzhalter-Gebäudes (aus produktseite-v2.html), serverseitig berechnet.
export type Status = 'g' | 'y' | 'r';
export type Poly = { points: string; fill: string; opacity?: number };
export type Room = { key: string; floor: number; base: Poly; lit: Poly; status: Status; name?: string; n: number };

// Demo-Status je Raum "Stock-Index"
export const STATUS: Record<string, Status> = {
  '0-1': 'y', '1-0': 'g', '1-2': 'r', '1-3': 'g', '2-4': 'g', '0-3': 'g', '2-1': 'g',
};
export const NAMES: Record<string, string> = { '1-0': 'A', '1-2': 'C', '0-1': 'B' };
const COLOR: Record<Status, string> = { g: 'var(--g)', y: 'var(--y)', r: 'var(--r)' };

export function buildIso(o: { s: number; cx: number; cy: number; h: number; names: boolean }) {
  const { s: S, cx, cy, h: H } = o;
  const X = 5, Y = 3, F = 3;
  const P = (x: number, y: number, z: number) => `${cx + (x - y) * S},${cy + ((x + y) * S) / 2 - z}`;
  const poly = (a: number[][], fill: string, opacity?: number): Poly => ({
    points: a.map((q) => P(q[0], q[1], q[2])).join(' '),
    fill,
    opacity,
  });
  const walls: Poly[] = [];
  const windows: Poly[] = []; // Fenster ohne Status
  const rooms: Room[] = [];
  let n = 0;
  for (let f = 0; f < F; f++) {
    const z0 = f * H, z1 = (f + 1) * H;
    walls.push(poly([[0, Y, z0], [X, Y, z0], [X, Y, z1], [0, Y, z1]], 'var(--wall-l)'));
    walls.push(poly([[X, Y, z0], [X, 0, z0], [X, 0, z1], [X, Y, z1]], 'var(--wall-r)'));
    for (let i = 0; i < X; i++) {
      const key = `${f}-${i}`;
      const st = STATUS[key];
      const q = [[i + 0.2, Y, z0 + H * 0.3], [i + 0.8, Y, z0 + H * 0.3], [i + 0.8, Y, z0 + H * 0.78], [i + 0.2, Y, z0 + H * 0.78]];
      const base = poly(q, 'var(--bg)', 0.7);
      if (!st) { windows.push(base); continue; }
      rooms.push({ key, floor: f, base, lit: poly(q, COLOR[st]), status: st, name: o.names ? NAMES[key] : undefined, n: n++ });
    }
  }
  const top = poly([[0, Y, F * H], [X, Y, F * H], [X, 0, F * H], [0, 0, F * H]], 'var(--wall-t)');
  // Reihenfolge wie Prototyp: je Stockwerk Wände, dann Fenster. Zeichnen nach Stockwerk gruppiert.
  return { walls, windows, rooms, top };
}
