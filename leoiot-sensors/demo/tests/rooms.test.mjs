// DEMO, not a permanent part of the system.
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRooms, MODEL_ROOMS } from '../rooms.mjs';

test('the model list has 107 rooms', () => {
  assert.equal(MODEL_ROOMS.length, 107);
});

test('demoRooms: 106 unique ids without 105', () => {
  const rooms = demoRooms();
  assert.equal(rooms.length, 106);
  assert.equal(new Set(rooms).size, 106);
  assert.ok(!rooms.includes('105'));
  for (const id of ['UBiolab', '1Aula', 'T19', 'U74.1']) assert.ok(rooms.includes(id), id);
});

test('demoRooms: a custom skip list works', () => {
  const rooms = demoRooms(['105', 'T19']);
  assert.equal(rooms.length, 105);
  assert.ok(!rooms.includes('T19'));
  assert.equal(demoRooms([]).length, 107);
});
