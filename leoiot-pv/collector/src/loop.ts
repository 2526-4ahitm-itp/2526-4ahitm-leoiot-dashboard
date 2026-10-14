// Die Schleife: einmal beim Start, danach in festem Takt ab Start.
import { createCounterWatch, dayKey } from './core/counters.js';
import { checkResult, PV_TOPIC, toLine, toMessage } from './core/reading.js';
import type { Log } from './log.js';

export interface LoopDeps {
  plantId: string;
  intervalMs: number;
  publish: boolean;
  cloud: { fetchRealtime(): Promise<unknown> };
  influx: { write(line: string): Promise<void> };
  broker: { publish(topic: string, payload: string): boolean };
  /** Hält den Zeitpunkt der letzten Lieferung fest (Health-Datei). */
  markDelivered: (nowMs: number) => Promise<void> | void;
  log: Log;
  now?: () => number;
}

export function createLoop(deps: LoopDeps) {
  const now = deps.now ?? Date.now;
  const counters = createCounterWatch(deps.log);
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  /** Ein Zyklus; wirft nie, jeder Fehler wird geloggt. */
  async function cycle(): Promise<void> {
    try {
      const result = await deps.cloud.fetchRealtime();
      const checked = checkResult(result);
      if (!checked.ok) {
        deps.log(`Unvollständige Lesung, nichts geliefert: Wert "${checked.missing}" fehlt oder ist keine Zahl`);
        return;
      }
      const nowMs = now();
      counters.observe(checked.reading, dayKey(result, nowMs));
      deps.log(
        `Lesung: dailyYield=${checked.reading.dailyYield}, consumption=${checked.reading.consumption}`,
      );

      let stored = false;
      try {
        await deps.influx.write(toLine(deps.plantId, checked.reading, nowMs));
        stored = true;
        deps.log('In InfluxDB geschrieben');
      } catch (error) {
        deps.log(`Schreiben in InfluxDB fehlgeschlagen: ${(error as Error).message}`);
      }

      if (deps.publish) {
        deps.broker.publish(PV_TOPIC, toMessage(result));
      }

      if (stored) {
        try {
          await deps.markDelivered(nowMs);
        } catch (error) {
          deps.log(`Health-Datei nicht geschrieben: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      deps.log(`Zyklus übersprungen: ${(error as Error).message}`);
    }
  }

  function tick(): void {
    // Dauert ein Zyklus länger als der Takt, wird der nächste ausgelassen.
    if (running) {
      deps.log('Vorheriger Zyklus läuft noch, dieser wird ausgelassen');
      return;
    }
    running = cycle().finally(() => {
      running = null;
    });
  }

  return {
    start(): void {
      tick();
      timer = setInterval(tick, deps.intervalMs);
    },
    /** Hält den Takt an und wartet auf einen laufenden Zyklus. */
    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      if (running) await running;
    },
  };
}

export type Loop = ReturnType<typeof createLoop>;
