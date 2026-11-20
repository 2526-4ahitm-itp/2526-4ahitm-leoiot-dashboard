// DEMO, not a permanent part of the system.
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRooms } from '../rooms.mjs';
import { reading } from '../model.mjs';

const rooms = demoRooms();
// Wednesday 2026-11-18, Vienna is UTC+1 in November.
const at = (day, hh, mm) => Date.parse(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+01:00`);

test('reading is deterministic', () => {
  const ts = at('2026-11-18', 10, 45);
  assert.deepEqual(reading('203', ts), reading('203', ts));
  assert.notDeepEqual(reading('203', ts), reading('204', ts));
});

test('values are rounded as specified', () => {
  const r = reading('203', at('2026-11-18', 10, 45));
  assert.ok(Number.isInteger(r.co2));
  assert.equal(r.temperature, Math.round(r.temperature * 10) / 10);
  assert.equal(r.humidity, Math.round(r.humidity * 10) / 10);
});

test('values stay in range over all rooms and many timestamps', () => {
  const start = Date.parse('2026-11-14T00:00:00+01:00');
  for (let i = 0; i < 7 * 24 * 4; i += 3) {
    const ts = start + i * 15 * 60000;
    for (const room of rooms) {
      const r = reading(room, ts);
      assert.ok(r.co2 >= 380 && r.co2 <= 2200, `co2 ${r.co2} ${room} ${ts}`);
      assert.ok(r.temperature >= 15 && r.temperature <= 29, `temperature ${r.temperature} ${room} ${ts}`);
      assert.ok(r.humidity >= 20 && r.humidity <= 70, `humidity ${r.humidity} ${room} ${ts}`);
    }
  }
});

test('weekday 10:45: green, yellow and red CO2 states and rooms outside 19 to 25 C', () => {
  const ts = at('2026-11-18', 10, 45);
  const all = rooms.map((room) => reading(room, ts));
  assert.ok(all.some((r) => r.co2 > 1000), 'some above 1000');
  assert.ok(all.some((r) => r.co2 >= 800 && r.co2 <= 1000), 'some 800 to 1000');
  assert.ok(all.some((r) => r.co2 < 800), 'some below 800');
  assert.ok(all.some((r) => r.temperature < 19 || r.temperature > 25), 'some outside 19 to 25');
});

test('night 03:00: every room near outdoor level', () => {
  const ts = at('2026-11-18', 3, 0);
  for (const room of rooms) assert.ok(reading(room, ts).co2 < 520, room);
});

test('weekend noon: near outdoor level', () => {
  const ts = at('2026-11-21', 12, 0);
  for (const room of rooms) assert.ok(reading(room, ts).co2 < 520, room);
});

test('the zone is Vienna, not the machine: summer time shifts the school day by one hour', () => {
  // 10:45 local in July is 08:45 UTC; the same instant in November would be 09:45 local.
  const summer = Date.parse('2026-07-15T10:45:00+02:00');
  const all = rooms.map((room) => reading(room, summer));
  assert.ok(all.some((r) => r.co2 > 1000));
});
