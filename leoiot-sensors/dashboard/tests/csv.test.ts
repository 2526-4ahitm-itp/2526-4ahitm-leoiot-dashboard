import { describe, expect, it } from 'vitest';
import { parseAnnotatedCsv } from '../src/core/csv';
import { fixture } from './helpers';

describe('annotated CSV', () => {
  it('reads a recorded answer of the latest query', () => {
    const rows = parseAnnotatedCsv(fixture('latest105.csv'));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r._field).sort()).toEqual(['co2', 'humidity', 'temperature']);
    expect(rows[0]).toMatchObject({ result: '_result', table: '0', device: 'nili3', source: 'sensor' });
  });
  it('an answer without rows is empty', () => {
    expect(parseAnnotatedCsv(fixture('latestX99.csv'))).toEqual([]);
    expect(parseAnnotatedCsv('')).toEqual([]);
  });
  it('keeps empty cells as empty text', () => {
    const rows = parseAnnotatedCsv(fixture('history24h.csv'));
    expect(rows.some((r) => r.co2 === '' && r.humidity === '' && r.temperature === '')).toBe(true);
  });
  it('skips annotation rows and starts a new header after an empty line', () => {
    const text = ['#datatype,string,long', '#group,false,false', '#default,_result,', ',result,table', ',_result,0', '', ',result,table,x', ',_result,1,hello', ''].join('\r\n');
    expect(parseAnnotatedCsv(text)).toEqual([
      { result: '_result', table: '0' },
      { result: '_result', table: '1', x: 'hello' },
    ]);
  });
  it('handles quoted cells with commas, doubled quotes and line breaks', () => {
    const text = ',a,b\n,"x,y","say ""hi""\nnow"\n';
    expect(parseAnnotatedCsv(text)).toEqual([{ a: 'x,y', b: 'say "hi"\nnow' }]);
  });
  it('accepts Unix line breaks and a missing final line break', () => {
    expect(parseAnnotatedCsv(',a\n,1\n,2')).toEqual([{ a: '1' }, { a: '2' }]);
  });
  it('throws the server message of an error table', () => {
    expect(() => parseAnnotatedCsv('error,reference\r\nfailed to parse query,897\r\n')).toThrow(/failed to parse query/);
  });
});
