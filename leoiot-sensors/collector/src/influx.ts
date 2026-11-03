// InfluxDB 2.x write API with plain HTTP (no client library).

export class WriteError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = 'WriteError';
  }
}

export interface InfluxOptions {
  url: string;
  org: string;
  bucket: string;
  token: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export function createInflux(options: InfluxOptions) {
  const fetchFn = options.fetchFn ?? fetch;
  const target =
    `${options.url}/api/v2/write?org=${encodeURIComponent(options.org)}` +
    `&bucket=${encodeURIComponent(options.bucket)}&precision=ns`;

  return {
    /** Writes the lines in one request; throws a WriteError. */
    async write(lines: string[]): Promise<void> {
      let response: Response;
      try {
        response = await fetchFn(target, {
          method: 'POST',
          headers: {
            Authorization: `Token ${options.token}`,
            'Content-Type': 'text/plain; charset=utf-8',
          },
          body: `${lines.join('\n')}\n`,
          signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
        });
      } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause?.code;
        throw new WriteError(`database not reachable: ${(error as Error).message}${cause ? ` (${cause})` : ''}`, true);
      }
      if (response.ok) return;
      const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      // 400 and 422 say the data itself is bad; retrying would block every later point.
      const retryable = response.status !== 400 && response.status !== 422;
      throw new WriteError(`database answered HTTP ${response.status} ${detail}`.trim(), retryable);
    },
  };
}

export type Influx = ReturnType<typeof createInflux>;
