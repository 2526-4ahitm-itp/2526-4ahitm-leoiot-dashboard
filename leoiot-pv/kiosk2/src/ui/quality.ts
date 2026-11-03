// Passt die Bildschärfe an das Gerät an (design D11). Der Ablauf hängt an der Uhr, nicht an der Bildrate.

export const MIN_FPS = 40;
export const WINDOW_MS = 2000;

export interface Detail { pixelRatio: number; shadows: boolean }

/** Nimmt Bildzeiten entgegen; meldet eine niedrigere Stufe, wenn zwei Fenster nacheinander zu langsam waren. */
export function createQuality(onChange: (d: Detail) => void): { frame(now: number): void; detail(): Detail } {
  const detail: Detail = { pixelRatio: 1, shadows: true };
  let windowStart = -1, frames = 0, slow = 0;
  return {
    frame(now) {
      if (windowStart < 0) { windowStart = now; return; }
      frames++;
      if (now - windowStart < WINDOW_MS) return;
      const fps = (frames * 1000) / (now - windowStart);
      slow = fps < MIN_FPS ? slow + 1 : 0;
      frames = 0;
      windowStart = now;
      if (slow < 2) return;
      slow = 0;
      if (detail.pixelRatio > 0.5) detail.pixelRatio = Math.max(0.5, Math.round(detail.pixelRatio * 0.8 * 100) / 100);
      else if (detail.shadows) detail.shadows = false;
      else return;
      onChange({ ...detail });
    },
    detail: () => ({ ...detail }),
  };
}
