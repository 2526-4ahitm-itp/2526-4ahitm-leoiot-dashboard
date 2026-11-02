// The newest reading of every room, fed with broker messages.

import { parseMessage, type Reading } from './messages';

export type Listener = (room: string) => void;

export class RoomStore {
  private readonly readings = new Map<string, Reading>();
  private readonly listeners = new Set<Listener>();

  /** Applies one broker message; returns the room it changed, or null. */
  apply(topic: string, payload: string): string | null {
    const parsed = parseMessage(topic, payload);
    if (parsed.kind === 'invalid') return null;
    if (parsed.kind === 'clear') {
      if (!this.readings.delete(parsed.room)) return null;
      this.notify(parsed.room);
      return parsed.room;
    }
    const { reading } = parsed;
    const kept = this.readings.get(reading.room);
    // Two devices in one room share a topic: the newest ts wins
    if (kept && kept.ts > reading.ts) return null;
    this.readings.set(reading.room, reading);
    this.notify(reading.room);
    return reading.room;
  }

  get(room: string): Reading | undefined {
    return this.readings.get(room);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(room: string): void {
    for (const l of this.listeners) l(room);
  }
}
