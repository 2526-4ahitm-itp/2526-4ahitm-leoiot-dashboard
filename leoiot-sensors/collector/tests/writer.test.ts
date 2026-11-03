import { afterEach, describe, expect, it } from 'vitest';
import { createWriteBuffer } from '../src/buffer.js';
import { createInflux } from '../src/influx.js';
import { logCollector, startFakeInflux, TEST_TOKEN } from './helpers.js';

const servers: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

async function setup(maxAgeMs = 3_600_000, batchSize?: number) {
  const fake = await startFakeInflux();
  servers.push(fake);
  const influx = createInflux({ url: fake.url, org: 'leoiot', bucket: 'server_data', token: TEST_TOKEN, timeoutMs: 2000 });
  const clock = { t: 1_000_000 };
  const { log, lines } = logCollector();
  const events: string[] = [];
  const buffer = createWriteBuffer({
    write: (l) => influx.write(l),
    maxAgeMs,
    batchSize,
    now: () => clock.t,
    log,
    onWriteOk: () => events.push('ok'),
    onWriteFail: () => events.push('fail'),
  });
  const point = (i: number, receivedMs = clock.t) => ({ line: `room_climate,device=d,room=1,source=sensor co2=${i} ${i}`, receivedMs });
  return { fake, buffer, clock, lines, events, point };
}

describe('Influx write request', () => {
  it('posts line protocol to the v2 write endpoint with org, bucket, ns precision and the token header', async () => {
    const { fake, buffer, point } = await setup();
    buffer.add(point(1));
    buffer.add(point(2));
    await buffer.flush();
    expect(fake.requests).toHaveLength(1);
    const [request] = fake.requests;
    expect(request!.method).toBe('POST');
    expect(request!.url).toBe('/api/v2/write?org=leoiot&bucket=server_data&precision=ns');
    expect(request!.headers.authorization).toBe(`Token ${TEST_TOKEN}`);
    expect(request!.body).toBe(`${point(1).line}\n${point(2).line}\n`);
    expect(buffer.size()).toBe(0);
  });

  it('writes nothing when nothing is queued', async () => {
    const { fake, buffer } = await setup();
    await buffer.flush();
    expect(fake.requests).toHaveLength(0);
  });

  it('batches points that arrive between two flushes into one request', async () => {
    const { fake, buffer, point } = await setup();
    for (let i = 0; i < 10; i++) buffer.add(point(i));
    await buffer.flush();
    expect(fake.requests).toHaveLength(1);
    expect(fake.accepted).toHaveLength(10);
  });

  it('splits very large queues into several requests in order', async () => {
    const { fake, buffer, point } = await setup(3_600_000, 4);
    for (let i = 0; i < 10; i++) buffer.add(point(i));
    await buffer.flush();
    expect(fake.requests.map((r) => r.body.split('\n').filter(Boolean).length)).toEqual([4, 4, 2]);
    expect(fake.accepted).toEqual(Array.from({ length: 10 }, (_, i) => point(i).line));
  });
});

describe('The collector recovers by itself (database)', () => {
  it('keeps points when the database answers with an error and writes them in order later', async () => {
    const { fake, buffer, point, events, lines } = await setup();
    fake.setStatus(503);
    buffer.add(point(1));
    await buffer.flush();
    buffer.add(point(2));
    await buffer.flush();
    expect(buffer.size()).toBe(2);
    expect(events).toEqual(['fail', 'fail']);
    // Logged once, not on every retry.
    expect(lines.filter((l) => l.includes('Writing to the database failed'))).toHaveLength(1);
    fake.setStatus(204);
    buffer.add(point(3));
    await buffer.flush();
    expect(fake.accepted).toEqual([point(1).line, point(2).line, point(3).line]);
    expect(buffer.size()).toBe(0);
    expect(events.at(-1)).toBe('ok');
    expect(lines).toContain('Database can be written again');
  });

  it('keeps points when the database is not reachable at all', async () => {
    const { fake, buffer, point, lines } = await setup();
    await fake.close();
    buffer.add(point(1));
    await buffer.flush();
    expect(buffer.size()).toBe(1);
    expect(lines.join('\n')).toContain('database not reachable');
  });

  it('Database unreachable for ten minutes: every reading is stored later with its original time', async () => {
    const { fake, buffer, clock, point } = await setup();
    fake.setStatus(500);
    const expected: string[] = [];
    // One value every 3 s for ten minutes, flushed every 2 s by the real timer.
    for (let s = 0; s < 600; s += 2) {
      clock.t += 2000;
      if (s % 3 === 0 || s % 3 === 1) {
        const p = point(expected.length);
        expected.push(p.line);
        buffer.add(p);
      }
      await buffer.flush();
    }
    expect(buffer.size()).toBe(expected.length);
    expect(fake.accepted).toHaveLength(0);
    fake.setStatus(204);
    clock.t += 2000;
    await buffer.flush();
    expect(fake.accepted).toEqual(expected);
    expect(buffer.size()).toBe(0);
  });

  it('drops the oldest readings beyond one hour and logs how many', async () => {
    const { fake, buffer, clock, point, lines } = await setup(3_600_000);
    fake.setStatus(500);
    const start = clock.t;
    // 90 minutes of one reading per minute with the database down.
    for (let m = 0; m < 90; m++) {
      clock.t = start + m * 60_000;
      buffer.add(point(m));
      await buffer.flush();
    }
    // Readings older than one hour (receipt before now - 60 min) are gone.
    expect(buffer.size()).toBe(61);
    const dropped = lines.filter((l) => l.startsWith('Dropped')).join('\n');
    expect(dropped).toMatch(/Dropped 1 reading\(s\) older than 60 min/);
    fake.setStatus(204);
    await buffer.flush();
    expect(fake.accepted).toEqual(Array.from({ length: 61 }, (_, i) => point(i + 29).line));
    // Logged counts add up to what was lost.
    const total = lines
      .map((l) => /^Dropped (\d+) reading/.exec(l)?.[1])
      .filter(Boolean)
      .reduce((sum, n) => sum + Number(n), 0);
    expect(total).toBe(29);
  });

  it('drops data the database rejects as invalid (HTTP 400) instead of blocking later points', async () => {
    const { fake, buffer, point, lines, events } = await setup();
    fake.setStatus(400);
    buffer.add(point(1));
    await buffer.flush();
    expect(buffer.size()).toBe(0);
    expect(lines.join('\n')).toContain('Database rejected 1 reading(s), dropped');
    fake.setStatus(204);
    buffer.add(point(2));
    await buffer.flush();
    expect(fake.accepted).toEqual([point(2).line]);
    expect(events).toEqual(['fail', 'ok']);
  });

  it('retries after an authorisation error (HTTP 401), because the token may be fixed', async () => {
    const { fake, buffer, point } = await setup();
    fake.setStatus(401);
    buffer.add(point(1));
    await buffer.flush();
    expect(buffer.size()).toBe(1);
  });

  it('does not put the token into any log line', async () => {
    const { fake, buffer, point, lines } = await setup();
    fake.setStatus(401);
    buffer.add(point(1));
    await buffer.flush();
    expect(lines.join('\n')).not.toContain(TEST_TOKEN);
  });

  it('overlapping flushes write each point once', async () => {
    const { fake, buffer, point } = await setup();
    buffer.add(point(1));
    await Promise.all([buffer.flush(), buffer.flush(), buffer.flush()]);
    expect(fake.accepted).toEqual([point(1).line]);
  });
});
