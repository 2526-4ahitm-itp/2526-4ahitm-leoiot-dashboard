import { describe, expect, it } from 'vitest';
import { parseValue, quoteReceived } from '../src/reading.js';
import { createLiveState } from '../src/live.js';
import { nili3 } from './helpers.js';

describe('Invalid values are dropped (parsing)', () => {
  it('accepts plain numbers', () => {
    expect(parseValue('temperature', '22.4')).toEqual({ ok: true, value: 22.4 });
    expect(parseValue('co2', '868')).toEqual({ ok: true, value: 868 });
    expect(parseValue('co2', ' 868\n')).toEqual({ ok: true, value: 868 });
    expect(parseValue('temperature', '-3.5')).toEqual({ ok: true, value: -3.5 });
    expect(parseValue('humidity', '4.7e1')).toEqual({ ok: true, value: 47 });
  });

  it('rejects everything that is not a finite decimal number', () => {
    for (const text of ['nan', 'NaN', 'unavailable', 'unknown', '', ' ', 'inf', 'Infinity', '-Infinity', '0x10', '22,4', '1_000', '22.4.1', '12 ppm', 'null', '1e999']) {
      expect(parseValue('co2', text).ok, JSON.stringify(text)).toBe(false);
    }
  });

  it('applies the ranges: CO2 0..10000, temperature -40..85, humidity 0..100', () => {
    const cases: [Parameters<typeof parseValue>[0], string, boolean][] = [
      ['co2', '0', true],
      ['co2', '10000', true],
      ['co2', '-1', false],
      ['co2', '10000.1', false],
      ['temperature', '-40', true],
      ['temperature', '85', true],
      ['temperature', '-40.1', false],
      ['temperature', '85.1', false],
      ['humidity', '0', true],
      ['humidity', '100', true],
      ['humidity', '140', false],
      ['humidity', '-0.1', false],
    ];
    for (const [quantity, text, ok] of cases) expect(parseValue(quantity, text).ok, `${quantity} ${text}`).toBe(ok);
  });

  it('quotes and cuts the received text for the log', () => {
    expect(quoteReceived('nan')).toBe('"nan"');
    expect(quoteReceived('a\nb')).toBe('"a\\nb"');
    expect(quoteReceived('x'.repeat(100))).toBe(`"${'x'.repeat(40)}..."`);
  });
});

describe('Readings are published as the contract specifies (message shape)', () => {
  const [device] = nili3();

  it('Live message after a reading: all known values, the time of the newest', () => {
    const live = createLiveState();
    live.update(device!, 'co2', 868, 1000);
    live.update(device!, 'humidity', 47, 2000);
    const message = live.update(device!, 'temperature', 22.4, 3000);
    expect(message.topic).toBe('leoiot/room-climate/105');
    expect(JSON.parse(message.payload)).toEqual({
      room: '105',
      device: 'nili3',
      source: 'sensor',
      ts: 3000,
      co2: 868,
      temperature: 22.4,
      humidity: 47,
    });
  });

  it('First reading after a restart: only the delivered quantity', () => {
    const live = createLiveState();
    const message = live.update(device!, 'co2', 868, 5000);
    expect(JSON.parse(message.payload)).toEqual({ room: '105', device: 'nili3', source: 'sensor', ts: 5000, co2: 868 });
    expect(message.payload).not.toContain('temperature');
    expect(message.payload).not.toContain('humidity');
  });

  it('a newer value of a quantity replaces the older one', () => {
    const live = createLiveState();
    live.update(device!, 'co2', 868, 1);
    const message = live.update(device!, 'co2', 900, 2);
    expect(JSON.parse(message.payload).co2).toBe(900);
  });

  it('keeps room ids as written (case-sensitive)', () => {
    const live = createLiveState();
    const message = live.update({ ...device!, room: 'UBiolab' }, 'co2', 500, 1);
    expect(message.topic).toBe('leoiot/room-climate/UBiolab');
    expect(JSON.parse(message.payload).room).toBe('UBiolab');
  });
});
