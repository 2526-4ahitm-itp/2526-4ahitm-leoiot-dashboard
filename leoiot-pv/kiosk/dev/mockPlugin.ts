// Mock-Modus: bedient /kiosk/api/query und /kiosk/ws aus Beispieldaten.
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { dayRange, viennaDayStart, weekKeys } from '../src/core/time';
import { mockCountersMessage, mockPowerMessage, mockTodayCsv, mockWeekCsv } from './mockData';

const QUERY_PATH = '/kiosk/api/query';
const WS_PATH = '/kiosk/ws';

function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0];
}

/** Bedient /kiosk/api/query und /kiosk/ws aus Beispieldaten. Nur für dev und preview. */
export function kioskMock(mode: string, live: boolean): Plugin {
  const wss = new WebSocketServer({ noServer: true });

  // Gemeinsame Einrichtung für dev und preview
  function setup(server: {
    middlewares: { use: (fn: (req: IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void) => void };
    httpServer: { on: (ev: 'upgrade', fn: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) => void } | null;
  }): void {
    server.middlewares.use((req, res, next) => {
      if (pathOf(req.url) !== QUERY_PATH) return next();
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
      }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => (body += chunk));
      req.on('end', () => {
        if (mode === 'error') {
          res.statusCode = 502;
          res.end('mock: Datenquelle nicht erreichbar');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        if (mode === 'empty') {
          res.end('\r\n');
          return;
        }
        const now = new Date();
        const until = mode === 'stale' ? new Date(now.getTime() - 20 * 60_000) : now;
        const today = dayRange(now);
        if (body.includes('every: 1d')) {
          res.end(mockWeekCsv(weekKeys(now).map(viennaDayStart), until));
        } else {
          res.end(mockTodayCsv(today.start, until));
        }
      });
    });

    server.httpServer?.on('upgrade', (req, socket, head) => {
      if (pathOf(req.url) !== WS_PATH) return; // Vite-HMR nicht anfassen
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
  }

  wss.on('connection', (ws) => {
    ws.send('{"type":"hello","wsPort":0}');
    if (!live || mode === 'empty' || mode === 'error' || mode === 'stale') return;
    const dayStart = () => dayRange(new Date()).start;
    const sendCounters = () => ws.send(mockCountersMessage(new Date(), dayStart()));
    const sendPower = () => ws.send(mockPowerMessage(new Date(), dayStart()));
    sendCounters();
    sendPower();
    const powerTimer = setInterval(sendPower, 5000);
    const counterTimer = setInterval(sendCounters, 60_000);
    ws.on('close', () => {
      clearInterval(powerTimer);
      clearInterval(counterTimer);
    });
  });

  return {
    name: 'kiosk-mock',
    configureServer: setup,
    configurePreviewServer: setup,
  };
}
