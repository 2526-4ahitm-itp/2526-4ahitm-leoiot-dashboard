import { describe, expect, it } from 'vitest';
import { assertRoomId, displayRoomId, isValidRoomId, MAX_ROOM_LENGTH, roomFromSearch } from '../src/core/room';

describe('room id from the address', () => {
  it('plain address shows room 105', () => {
    expect(roomFromSearch('')).toEqual({ id: '105', valid: true });
    expect(roomFromSearch('?room=')).toEqual({ id: '105', valid: true });
    expect(roomFromSearch('?other=1')).toEqual({ id: '105', valid: true });
  });
  it('keeps the room id exactly as written', () => {
    expect(roomFromSearch('?room=E10')).toEqual({ id: 'E10', valid: true });
    expect(roomFromSearch('?room=UBiolab')).toEqual({ id: 'UBiolab', valid: true });
    expect(roomFromSearch('?room=U74.1')).toEqual({ id: 'U74.1', valid: true });
  });
  it.each(['105', '153', 'E10', 'U08', '1Aula', 'UBiolab', 'U74.1'])('door sign %s is valid', (id) => {
    expect(isValidRoomId(id)).toBe(true);
  });
  it.each([
    ['empty', ''],
    ['slash', 'a/b'],
    ['wildcard +', 'a+b'],
    ['wildcard #', '#'],
    ['quote', '105"'],
    ['flux injection', '105" or true or r.room == "'],
    ['interpolation', '${x}'],
    ['backslash', 'a\\b'],
    ['space', '105 '],
    ['umlaut', 'Küche'],
    ['too long', 'A'.repeat(MAX_ROOM_LENGTH + 1)],
  ])('rejects %s', (_name, id) => {
    expect(isValidRoomId(id)).toBe(false);
    expect(() => assertRoomId(id)).toThrow();
  });
  it('accepts the longest allowed id', () => {
    expect(isValidRoomId('A'.repeat(MAX_ROOM_LENGTH))).toBe(true);
  });
  it('flags an invalid id from the address and keeps its text', () => {
    expect(roomFromSearch('?room=X%22%3Cb%3E')).toEqual({ id: 'X"<b>', valid: false });
  });
  it('shortens very long ids for display only', () => {
    expect(displayRoomId('A'.repeat(100)).length).toBe(41);
    expect(displayRoomId('105')).toBe('105');
  });
});
