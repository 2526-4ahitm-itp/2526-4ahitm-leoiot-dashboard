// Zeigt den Theme-Schalter nur nach Mausbewegung: setzt data-active, bis fünf Sekunden Ruhe sind.
export const IDLE_MS = 5000;

interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Meldet true bei der ersten Bewegung und false nach IDLE_MS ohne weitere. Zeitgeber austauschbar. */
export function createIdle(
  onChange: (active: boolean) => void,
  timers: Timers = defaultTimers,
): { poke(): void; stop(): void } {
  let active = false;
  let timer: unknown = null;
  const clear = (): void => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  return {
    poke() {
      if (!active) {
        active = true;
        onChange(true);
      }
      clear();
      timer = timers.set(() => {
        timer = null;
        active = false;
        onChange(false);
      }, IDLE_MS);
    },
    stop: clear,
  };
}

/** Hängt die Erkennung an Mausereignisse; die Tastatur deckt CSS mit :focus-within ab. */
export function watchActivity(): void {
  const idle = createIdle((active) => {
    if (active) document.documentElement.setAttribute('data-active', '');
    else document.documentElement.removeAttribute('data-active');
  });
  window.addEventListener('pointermove', idle.poke, { passive: true });
  window.addEventListener('pointerdown', idle.poke, { passive: true });
}
