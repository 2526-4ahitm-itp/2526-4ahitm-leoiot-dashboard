// Maße der Landschaft, gemeinsam für Ablauf, Bild und Beschriftung.

export const WIDTH = 30; // Breite eines Grats in Welt-Einheiten (Morgen bis Abend)
export const ROW = 0.42; // Abstand zweier Tage
export const HEIGHT = 7.5; // Höhe der höchsten Leistung des Jahres
export const PAD = 8; // leere Reihen vor dem ersten und nach dem letzten Tag

/** Die Kamera blickt zurück zu den alten Tagen; darum gespiegelt: am Bildschirm ist links Morgen. */
export const xOfU = (u: number): number => (0.5 - u) * WIDTH;
export const zOf = (day: number): number => -day * ROW;

/** Wie weit ein Tag an der Stelle u schon gewachsen ist (0..1); dieselbe Formel steht im Shader. */
export function grown(day: number, row: number, u: number, fast: number): number {
  const k = Math.min(1, Math.max(0, (day - row - u * (1 - fast) - fast * 1.6) / (0.05 + fast * 1.6) + 1));
  return k * k * (3 - 2 * k);
}

export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
