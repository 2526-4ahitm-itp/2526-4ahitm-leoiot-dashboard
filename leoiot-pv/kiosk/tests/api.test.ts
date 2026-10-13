import { describe, it, expect, vi } from 'vitest';
import { liveUrls, queryInflux } from '../src/data/api';

describe('queryInflux', () => {
  it('schickt die Abfrage per POST ohne Authorization und liefert den Text', async () => {
    const fetchStub = vi.fn(async (_url: unknown, _init?: unknown) => new Response('x,y\r\n'));
    const text = await queryInflux('abc', fetchStub as unknown as typeof fetch, '/leogreen/');
    expect(text).toBe('x,y\r\n');
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/leogreen/api/query');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('abc');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/vnd.flux');
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization');
  });

  it('wirft bei Status 500', async () => {
    const fetchStub = vi.fn(async () => new Response('fehler', { status: 500 }));
    await expect(queryInflux('abc', fetchStub as unknown as typeof fetch, '/leogreen/')).rejects.toThrow('HTTP 500');
  });
});

describe('liveUrls', () => {
  it('wählt wss bei https und ws bei http', () => {
    expect(liveUrls({ protocol: 'https:', host: 'vm.example' }, '/leogreen/')[0]).toBe('wss://vm.example/leogreen/ws');
    expect(liveUrls({ protocol: 'http:', host: 'localhost:8087' }, '/leogreen/')[0]).toBe(
      'ws://localhost:8087/leogreen/ws',
    );
  });

  it('nennt /ws als Ausweichpfad', () => {
    expect(liveUrls({ protocol: 'https:', host: 'vm.example' }, '/leogreen/')).toEqual([
      'wss://vm.example/leogreen/ws',
      'wss://vm.example/ws',
    ]);
  });

  it('nennt jede Adresse nur einmal', () => {
    expect(liveUrls({ protocol: 'http:', host: 'h' }, '/')).toEqual(['ws://h/ws']);
  });
});
