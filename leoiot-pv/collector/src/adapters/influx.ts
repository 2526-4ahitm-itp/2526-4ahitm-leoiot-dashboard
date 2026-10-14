// Adapter für die InfluxDB (HTTP-API v2), Schreiben einer Line-Protocol-Zeile.

const WRITE_TIMEOUT_MS = 20000;

export interface InfluxOptions {
  url: string;
  org: string;
  bucket: string;
  token: string;
  fetchFn?: typeof fetch;
}

export function createInflux(options: InfluxOptions) {
  const fetchFn = options.fetchFn ?? fetch;
  const target =
    `${options.url}/api/v2/write?org=${encodeURIComponent(options.org)}` +
    `&bucket=${encodeURIComponent(options.bucket)}&precision=ns`;

  return {
    /** Schreibt die Zeile; wirft bei Netzfehler oder abgelehntem Schreiben. */
    async write(line: string): Promise<void> {
      const response = await fetchFn(target, {
        method: 'POST',
        headers: {
          Authorization: `Token ${options.token}`,
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: line,
        signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new Error(`InfluxDB lehnt das Schreiben ab (HTTP ${response.status}) ${detail}`.trim());
      }
    },
  };
}

export type Influx = ReturnType<typeof createInflux>;
