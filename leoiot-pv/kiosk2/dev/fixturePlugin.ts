// Nur für den Entwicklungs-Server: beantwortet die Abfragen mit den gespeicherten echten Messwerten
// aus tests/fixtures/year.csv, damit sich der Film ohne Datenbank ansehen lässt. Der Build enthält das nicht.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const YEAR = fileURLToPath(new URL('../tests/fixtures/year.csv', import.meta.url));

/** `mode`: '1' = Messwerte, 'empty' = leere Antwort, 'error' = Datenquelle antwortet mit Fehler. */
export function fixtureData(mode: string, total = 250_000): Plugin {
  return {
    name: 'kiosk2-fixture',
    configureServer(server) {
      server.middlewares.use('/kiosk2/api/query', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          if (mode === 'error') { res.statusCode = 502; res.end(); return; }
          res.setHeader('Content-Type', 'text/csv');
          if (mode === 'empty') { res.end(''); return; }
          if (body.includes('total_yield')) {
            res.end(`,result,table,_time,_value\n,_result,0,2026-11-03T12:30:00Z,${total}\n`);
            return;
          }
          const start = Date.parse(/start: ([0-9T:.\-Z]+)/.exec(body)?.[1] ?? '');
          const lines = readFileSync(YEAR, 'utf8').split('\n');
          if (!Number.isFinite(start) || body.includes('-365d')) { res.end(lines.join('\n')); return; }
          res.end([lines[0], ...lines.slice(1).filter((l) => Date.parse(l.split(',')[3]) >= start)].join('\n'));
        });
      });
    },
  };
}
