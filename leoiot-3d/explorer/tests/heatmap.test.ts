import { describe, expect, it } from 'vitest';
import { cell, heatmapRooms } from '../src/core/heatmap';

const now = 1_800_000_000_000;

describe('cell', () => {
  it('no message → none', () => expect(cell('co2', undefined, now)).toEqual({ kind: 'none' }));
  it('temperature only → none in the CO₂ heatmap', () =>
    expect(cell('co2', { room: '107', ts: now, temperature: 21 }, now)).toEqual({ kind: 'none' }));
  it('current CO₂ with status', () =>
    expect(cell('co2', { room: '105', ts: now, co2: 1201 }, now)).toMatchObject({ kind: 'current', text: '1201 ppm', status: 'red' }));
  it('current temperature', () =>
    expect(cell('temperature', { room: '105', ts: now, temperature: 22.5 }, now)).toMatchObject({ kind: 'current', text: '22.5°C' }));
  it('stale is grey with the last value', () =>
    expect(cell('temperature', { room: '105', ts: now - 8 * 60_000, temperature: 21.3 }, now)).toEqual({
      kind: 'stale',
      colour: '#9e9e9e',
      value: 21.3,
      text: '21.3°C',
      status: undefined,
    }));
  it('above the scale keeps the value in the label', () =>
    expect(cell('co2', { room: '121', ts: now, co2: 2600 }, now)).toMatchObject({ colour: '#8e0000', text: '2600 ppm', status: 'red' }));
});

describe('heatmapRooms', () => {
  const rooms = ['U08', 'E10', '105', '1Aula', '203', 'T1'];
  it('only the floor itself', () => expect(heatmapRooms('1', rooms)).toEqual(['105', '1Aula']));
  it('basement', () => expect(heatmapRooms('U', rooms)).toEqual(['U08']));
  it('no heatmap in the gym', () => expect(heatmapRooms('T', rooms)).toEqual([]));
});
