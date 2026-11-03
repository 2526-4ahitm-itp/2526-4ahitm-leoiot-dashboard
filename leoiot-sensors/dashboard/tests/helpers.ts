import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MqttLike, Timers } from '../src/data/feed';

export const fixture = (name: string): string => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

/** Vienna wall-clock time of Friday 23 October 2026 (summer time, UTC+2) as ms since the epoch. */
export const vienna = (hhmm: string, day = 23): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return Date.UTC(2026, 9, day, h - 2, m);
};

/** Puts the body of index.html (without scripts) into a DOM document. */
export function loadPage(doc: Document): void {
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  doc.body.innerHTML = body;
  doc.documentElement.lang = 'de';
  delete doc.documentElement.dataset.theme;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

export class FakeMqtt implements MqttLike {
  handlers = new Map<string, Listener[]>();
  subscribed: string[] = [];
  ended = false;
  grantQos = 0;
  on(event: string, listener: Listener): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), listener]);
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    for (const l of this.handlers.get(event) ?? []) l(...args);
  }
  subscribe(topic: string, callback?: (error: Error | null, granted?: { qos: number }[]) => void): this {
    this.subscribed.push(topic);
    callback?.(null, [{ qos: this.grantQos }]);
    return this;
  }
  end(): this {
    this.ended = true;
    return this;
  }
  message(topic: string, payload: unknown): void {
    this.emit('message', topic, new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload)));
  }
}

export class FakeTimers implements Timers {
  private next = 1;
  private jobs = new Map<number, { fn: () => void; every: number | null; at: number }>();
  now = 0;
  setInterval(fn: () => void, ms: number): number {
    this.jobs.set(this.next, { fn, every: ms, at: this.now + ms });
    return this.next++;
  }
  clearInterval(h: unknown): void {
    this.jobs.delete(h as number);
  }
  setTimeout(fn: () => void, ms: number): number {
    this.jobs.set(this.next, { fn, every: null, at: this.now + ms });
    return this.next++;
  }
  clearTimeout(h: unknown): void {
    this.jobs.delete(h as number);
  }
  get pending(): number {
    return this.jobs.size;
  }
  /** Moves the clock forward and runs what falls due, in order. */
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      const due = [...this.jobs.entries()].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, job] = due;
      this.now = job.at;
      if (job.every === null) this.jobs.delete(id);
      else job.at += job.every;
      job.fn();
    }
    this.now = end;
  }
}

export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
