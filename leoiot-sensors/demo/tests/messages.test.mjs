// DEMO, not a permanent part of the system.
import test from 'node:test';
import assert from 'node:assert/strict';
import { liveMessage, lineFor, escapeTag } from '../messages.mjs';

const r = { co2: 812, temperature: 21.4, humidity: 41.2 };

test('liveMessage has the demo shape', () => {
  assert.deepEqual(liveMessage('203', 1763460300000, r), {
    room: '203',
    device: 'demo',
    source: 'simulated',
    demo: true,
    ts: 1763460300000,
    co2: 812,
    temperature: 21.4,
    humidity: 41.2,
  });
});

test('lineFor writes the exact line for a normal room', () => {
  assert.equal(
    lineFor('U74.1', 1763460300000, r),
    'room_climate,device=demo,room=U74.1,source=simulated co2=812,temperature=21.4,humidity=41.2 1763460300000',
  );
});

test('lineFor escapes comma, equals and space in the room', () => {
  assert.equal(escapeTag('a b,c=d'), 'a\\ b\\,c\\=d');
  assert.ok(lineFor('a b,c', 1, r).startsWith('room_climate,device=demo,room=a\\ b\\,c,source=simulated '));
});
