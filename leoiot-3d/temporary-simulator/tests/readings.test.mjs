import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEVICE, reading, ROOMS } from '../readings.mjs';

const status = (ppm) => (ppm < 600 ? 'green' : ppm <= 1200 ? 'yellow' : 'red');

function modelRooms(file) {
  const gltf = JSON.parse(readFileSync(new URL(`../../explorer/models/${file}`, import.meta.url), 'utf8'));
  return gltf.nodes.map((n) => n.name ?? '').filter((n) => /^[UE12T]/.test(n)).map((n) => n.split('_')[0]);
}

test('the rooms are exactly those of the building model', () => {
  const expected = new Set([...modelRooms('ModelFull.gltf'), ...modelRooms('ModelT.gltf')]);
  assert.equal(ROOMS.length, 107);
  assert.deepEqual(new Set(ROOMS), expected);
});

test('a reading has the shape of the contract and is marked as simulated', () => {
  const r = reading('U74.1', 1_800_000_000_000);
  assert.equal(r.room, 'U74.1');
  assert.equal(r.source, 'simulated');
  assert.equal(r.device, DEVICE);
  assert.equal(r.ts, 1_800_000_000_000);
  assert.ok(Number.isFinite(r.co2) && Number.isFinite(r.temperature));
});

test('all three CO2 states occur at any moment', () => {
  for (let ts = 1_800_000_000_000; ts < 1_800_000_000_000 + 3_600_000; ts += 300_000) {
    assert.equal(new Set(ROOMS.map((room) => status(reading(room, ts).co2))).size, 3);
  }
});

test('values stay in their range and change over time', () => {
  const a = reading('105', 1_800_000_000_000);
  const b = reading('105', 1_800_000_000_000 + 600_000);
  assert.notEqual(a.co2, b.co2);
  for (const room of ROOMS) {
    const { co2, temperature } = reading(room, 1_800_000_000_000);
    assert.ok(co2 >= 420 && co2 <= 1400);
    assert.ok(temperature >= 19 && temperature <= 26);
  }
});
