// Write buffer (spec sensors/collector: "The collector recovers by itself").
// Points are written in batches. When a write fails they stay in order and are
// tried again, for at most maxAgeMs of readings.
import { WriteError } from './influx.js';
import type { Log } from './log.js';

export interface Point {
  line: string;
  /** Receipt time in ms. */
  receivedMs: number;
}

export interface BufferOptions {
  write: (lines: string[]) => Promise<void>;
  maxAgeMs: number;
  /** Most lines in one request. */
  batchSize?: number;
  now: () => number;
  log: Log;
  onWriteOk: () => void;
  onWriteFail: () => void;
}

const REMINDER_MS = 60_000;

export function createWriteBuffer(options: BufferOptions) {
  const batchSize = options.batchSize ?? 5_000;
  let queue: Point[] = [];
  let flushing: Promise<void> | null = null;
  let failing = false;
  let lastFailureLogMs = 0;

  function dropExpired(): void {
    const oldest = options.now() - options.maxAgeMs;
    let count = 0;
    while (count < queue.length && queue[count]!.receivedMs < oldest) count++;
    if (count > 0) {
      queue = queue.slice(count);
      options.log(`Dropped ${count} reading(s) older than ${Math.round(options.maxAgeMs / 60000)} min that could not be written`);
    }
  }

  async function run(): Promise<void> {
    while (queue.length > 0) {
      const batch = queue.slice(0, batchSize);
      try {
        await options.write(batch.map((p) => p.line));
      } catch (error) {
        const retryable = !(error instanceof WriteError) || error.retryable;
        const message = (error as Error).message;
        options.onWriteFail();
        if (!retryable) {
          // The database rejects this data; keeping it would block every later point.
          queue = queue.slice(batch.length);
          options.log(`Database rejected ${batch.length} reading(s), dropped: ${message}`);
          continue;
        }
        const now = options.now();
        if (!failing || now - lastFailureLogMs >= REMINDER_MS) {
          options.log(`Writing to the database failed, ${queue.length} reading(s) kept: ${message}`);
          lastFailureLogMs = now;
        }
        failing = true;
        dropExpired();
        return;
      }
      queue = queue.slice(batch.length);
      options.onWriteOk();
      if (failing) {
        failing = false;
        options.log('Database can be written again');
      }
    }
  }

  return {
    add(point: Point): void {
      queue.push(point);
    },
    /** Writes what is queued; never throws. Calls overlap safely. */
    flush(): Promise<void> {
      if (flushing) return flushing;
      dropExpired();
      flushing = run()
        .catch((error) => options.log(`Unexpected error while writing: ${(error as Error).message}`))
        .finally(() => {
          flushing = null;
        });
      return flushing;
    },
    size(): number {
      return queue.length;
    },
  };
}

export type WriteBuffer = ReturnType<typeof createWriteBuffer>;
