import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIdle } from '../src/ui/idle';

afterEach(() => vi.useRealTimers());

function setup() {
  vi.useFakeTimers();
  const calls: boolean[] = [];
  const idle = createIdle((a) => calls.push(a));
  return { calls, idle };
}

describe('createIdle', () => {
  it('poke meldet sofort true', () => {
    const { calls, idle } = setup();
    idle.poke();
    expect(calls).toEqual([true]);
  });
  it('meldet false nach 5000 ms, nicht früher', () => {
    const { calls, idle } = setup();
    idle.poke();
    vi.advanceTimersByTime(4999);
    expect(calls).toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual([true, false]);
  });
  it('ein zweites poke verlängert, true kommt nur einmal', () => {
    const { calls, idle } = setup();
    idle.poke();
    vi.advanceTimersByTime(3000);
    idle.poke();
    vi.advanceTimersByTime(2000); // 5000 ms
    expect(calls).toEqual([true]);
    vi.advanceTimersByTime(3000); // 8000 ms
    expect(calls).toEqual([true, false]);
  });
  it('nach stop kommt kein false mehr', () => {
    const { calls, idle } = setup();
    idle.poke();
    idle.stop();
    vi.advanceTimersByTime(10000);
    expect(calls).toEqual([true]);
  });
});
