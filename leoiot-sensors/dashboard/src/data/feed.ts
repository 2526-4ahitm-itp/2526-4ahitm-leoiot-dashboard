// The live channel with its fallback (spec "Live values have a fallback"): values arrive over MQTT
// from `/mqtt`; whenever that channel is not working, the latest values are fetched from the stored
// readings once a minute, until the channel works again. The client and the timers are injected, so
// that tests need neither a broker nor real time.
import { liveTopic, parseLiveMessage } from '../core/live';
import type { LiveReading } from '../core/snapshot';

/** The few members of an mqtt.js client that are used. */
export interface MqttLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown;
  subscribe(topic: string, callback?: (error: Error | null, granted?: { qos: number }[]) => void): unknown;
  end(force?: boolean): unknown;
}

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type FeedMode = 'connecting' | 'live' | 'fallback';

export interface FeedOptions {
  room: string;
  /** Opens the connection; may load the MQTT library first. A rejection starts the fallback. */
  connect: () => MqttLike | Promise<MqttLike>;
  /** Fetches the latest values from the stored readings and applies them. */
  poll: () => Promise<void>;
  onReading: (reading: LiveReading) => void;
  onMode: (mode: FeedMode) => void;
  timers?: Timers;
  pollMs?: number;
  /** How long the first connection may take before the fallback starts. */
  connectGraceMs?: number;
}

export const POLL_MS = 60_000;
export const CONNECT_GRACE_MS = 8_000;

export interface Feed {
  mode(): FeedMode;
  stop(): void;
}

export function startFeed(options: FeedOptions): Feed {
  const timers: Timers = options.timers ?? (globalThis as unknown as Timers);
  const pollMs = options.pollMs ?? POLL_MS;
  const topic = liveTopic(options.room);
  let mode: FeedMode = 'connecting';
  let poller: unknown = null;
  let grace: unknown = null;
  let stopped = false;

  const setMode = (next: FeedMode) => {
    if (stopped || next === mode) return;
    mode = next;
    options.onMode(next);
  };
  const poll = () => {
    options.poll().catch(() => undefined); // the page shows its own error state; the next round tries again
  };
  const startFallback = () => {
    setMode('fallback');
    if (poller === null && !stopped) {
      poll();
      poller = timers.setInterval(poll, pollMs);
    }
  };
  const stopFallback = () => {
    if (poller !== null) timers.clearInterval(poller);
    poller = null;
  };

  let client: MqttLike | null = null;
  grace = timers.setTimeout(() => {
    if (mode === 'connecting') startFallback();
  }, options.connectGraceMs ?? CONNECT_GRACE_MS);

  const attach = (c: MqttLike) => {
    if (stopped) return void c.end(true);
    client = c;
    c.on('connect', () => {
      c.subscribe(topic, (error, granted) => {
        // A refused subscription (QoS 128) is as bad as no connection.
        if (error || (granted ?? []).some((g) => g.qos === 128)) return startFallback();
        if (grace !== null) timers.clearTimeout(grace);
        grace = null;
        stopFallback();
        setMode('live');
      });
    });
    for (const event of ['close', 'offline', 'error'] as const) c.on(event, startFallback);
    c.on('message', (_topic: string, payload: Uint8Array) => {
      const reading = parseLiveMessage(payload, options.room);
      if (reading) options.onReading(reading);
    });
  };
  try {
    Promise.resolve(options.connect()).then(attach, startFallback);
  } catch {
    startFallback();
  }

  return {
    mode: () => mode,
    stop() {
      stopped = true;
      stopFallback();
      if (grace !== null) timers.clearTimeout(grace);
      client?.end(true);
    },
  };
}
