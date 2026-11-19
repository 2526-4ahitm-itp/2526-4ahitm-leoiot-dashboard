import { describe, expect, it } from 'vitest';
import { resolveRoom, roomFromAddress } from '../src/core/roomAddress';

describe('roomFromAddress', () => {
  it.each([
    ['?room=153', '153'],
    ['?room=U74.1', 'U74.1'],
    ['?room=1Aula&x=1', '1Aula'],
    ['?room=X99', 'X99'],
  ])('%s → %s', (search, room) => expect(roomFromAddress(search)).toBe(room));

  it.each(['', '?room=', '?other=105'])('%s names no room', (search) => expect(roomFromAddress(search)).toBeNull());

  it('a very long value is cut to 32 characters', () => {
    expect(roomFromAddress(`?room=${'A'.repeat(100)}`)).toHaveLength(32);
  });
});

describe('resolveRoom', () => {
  // The rooms of a small model: floor 1 has 153 and 1Aula, the basement U74 and U74.1.
  const model: Record<string, string[]> = { '1': ['153', '1Aula'], U: ['U74', 'U74.1'], E: [], '2': [], T: [] };
  const hasRoom = (floor: string, room: string) => model[floor]?.includes(room) ?? false;

  it('a room of the model: its floor', () => {
    expect(resolveRoom('153', hasRoom)).toEqual({ found: true, floor: '1' });
    expect(resolveRoom('1Aula', hasRoom)).toEqual({ found: true, floor: '1' });
  });

  it('a room id with a dot is that room, not the one without it', () => {
    expect(resolveRoom('U74.1', hasRoom)).toEqual({ found: true, floor: 'U' });
  });

  it.each(['X99', '154', 'E10', '153"><b>', 'U74.2'])('%s is not found', (room) => {
    expect(resolveRoom(room, hasRoom)).toEqual({ found: false });
  });
});
