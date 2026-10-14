import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

export type Handler = (req: Recorded, res: ServerResponse) => void;

/** Lokaler Fake-Server auf einem freien Port; merkt sich alle Anfragen. */
export async function startFake(handler: Handler): Promise<{
  url: string;
  requests: Recorded[];
  server: Server;
  close: () => Promise<void>;
}> {
  const requests: Recorded[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const recorded: Recorded = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      requests.push(recorded);
      handler(recorded, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function json(res: ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Eine vollständige, erfundene Cloud-Antwort ("result"). */
export function sampleResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    plantLocalTime: '2026-10-14 12:00:00',
    dailyYield: 20.5,
    dailyExported: 5.25,
    dailyImported: 3,
    dailyCharged: 4.5,
    dailyDischarged: 2.5,
    totalYield: 12345.5,
    extraField: 'bleibt erhalten',
    ...overrides,
  };
}

export function collectLog(): { lines: string[]; log: (m: string) => void } {
  const lines: string[] = [];
  return { lines, log: (m) => lines.push(m) };
}
