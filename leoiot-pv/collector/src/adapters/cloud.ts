// Adapter für die SolaX-Cloud: Anmeldung, Datenabfrage, Sitzung verwerfen.

const SUCCESS_CODE = 10000; // Daten-Endpunkt
const TOKEN_SUCCESS_CODE = 0; // Anmelde-Endpunkt
const REQUEST_TIMEOUT_MS = 20000;

export interface CloudOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  plantId: string;
  fetchFn?: typeof fetch;
}

export class CloudError extends Error {}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
  } catch {
    // fällt in den Fehler unten
  }
  throw new CloudError(`Antwort ohne gültiges JSON (HTTP ${response.status})`);
}

export function createCloud(options: CloudOptions) {
  const fetchFn = options.fetchFn ?? fetch;
  let token: string | null = null;

  async function login(): Promise<string> {
    const response = await fetchFn(`${options.baseUrl}/openapi/auth/get_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        grant_type: 'CICS',
        username: options.username,
        password: options.password,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new CloudError(`Anmeldung abgelehnt (HTTP ${response.status})`);
    const body = await readJson(response);
    const result = body.result as Record<string, unknown> | undefined;
    if (body.code !== TOKEN_SUCCESS_CODE || typeof result?.access_token !== 'string') {
      throw new CloudError(`Anmeldung fehlgeschlagen (Cloud-Code ${String(body.code)})`);
    }
    return result.access_token;
  }

  return {
    /** Ob gerade eine Sitzung gehalten wird (für Tests). */
    hasSession: () => token !== null,

    /**
     * Holt die aktuellen Werte der Anlage und liefert das Feld "result" der Antwort.
     * Ohne Sitzung wird zuerst angemeldet; schlägt das fehl, wird erst im nächsten
     * Zyklus erneut versucht. Wirft CloudError bei jedem Fehler.
     */
    async fetchRealtime(): Promise<unknown> {
      if (!token) {
        token = await login();
      }
      const url =
        `${options.baseUrl}/openapi/v2/plant/realtime_data` +
        `?plantId=${encodeURIComponent(options.plantId)}&businessType=4`;
      const response = await fetchFn(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 401 || response.status === 403) {
        token = null;
        throw new CloudError(`Sitzung abgelehnt (HTTP ${response.status}), im nächsten Zyklus wird neu angemeldet`);
      }
      if (!response.ok) throw new CloudError(`Datenabfrage fehlgeschlagen (HTTP ${response.status})`);
      const body = await readJson(response);
      if (body.code !== SUCCESS_CODE) {
        token = null;
        throw new CloudError(`Cloud-Fehlercode ${String(body.code)}, im nächsten Zyklus wird neu angemeldet`);
      }
      return body.result;
    },
  };
}

export type Cloud = ReturnType<typeof createCloud>;
