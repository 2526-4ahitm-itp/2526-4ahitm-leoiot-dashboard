import { describe, expect, it } from 'vitest';
import { parseMessage } from '../src/core/messages';

const T = 'leoiot/room-climate/';

describe('parseMessage', () => {
  it('reads a full message and ignores unknown fields', () => {
    const p = parseMessage(T + '105', JSON.stringify({ room: '105', device: 'd', source: 'sensor', ts: 1000, co2: 850, temperature: 22.4, humidity: 40, extra: 'x' }));
    expect(p).toEqual({ kind: 'reading', reading: { room: '105', ts: 1000, co2: 850, temperature: 22.4 } });
  });

  it('a missing field stays unknown, not zero', () => {
    const p = parseMessage(T + '105', JSON.stringify({ room: '105', ts: 1, co2: 850 }));
    expect(p.kind === 'reading' && p.reading.temperature).toBe(undefined);
  });

  it('a field that is not a number is unknown', () => {
    const p = parseMessage(T + '105', JSON.stringify({ room: '105', ts: 1, co2: '850', temperature: null }));
    expect(p).toEqual({ kind: 'reading', reading: { room: '105', ts: 1 } });
  });

  it('room id with a dot', () => {
    const p = parseMessage(T + 'U74.1', JSON.stringify({ room: 'U74.1', ts: 1, co2: 500 }));
    expect(p.kind === 'reading' && p.reading.room).toBe('U74.1');
  });

  it('empty payload clears the room', () => {
    expect(parseMessage(T + '105', '')).toEqual({ kind: 'clear', room: '105' });
  });

  it.each([
    ['not JSON', T + '105', '{oops'],
    ['not an object', T + '105', '[1,2]'],
    ['null', T + '105', 'null'],
    ['no ts', T + '105', JSON.stringify({ room: '105', co2: 1 })],
    ['ts not a number', T + '105', JSON.stringify({ room: '105', ts: '1', co2: 1 })],
    ['room differs from topic', T + '105', JSON.stringify({ room: '106', ts: 1, co2: 1 })],
    ['room case differs', T + 'UBiolab', JSON.stringify({ room: 'ubiolab', ts: 1, co2: 1 })],
    ['other topic', 'leoiot/other/105', JSON.stringify({ room: '105', ts: 1 })],
    ['nested topic', T + '105/x', JSON.stringify({ room: '105/x', ts: 1 })],
  ])('ignores %s', (_, topic, payload) => expect(parseMessage(topic, payload)).toEqual({ kind: 'invalid' }));
});
