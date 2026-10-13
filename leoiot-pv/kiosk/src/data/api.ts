// Zugriff auf den Proxy des Kiosks (kein Token im Browser).

/** Schickt eine Flux-Abfrage an den Proxy des Kiosks und liefert die CSV-Antwort. */
export async function queryInflux(
  flux: string,
  fetchFn: typeof fetch = fetch,
  base: string = import.meta.env.BASE_URL,
): Promise<string> {
  const response = await fetchFn(base + 'api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd.flux', Accept: 'application/csv' },
    body: flux,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.text();
}

/**
 * Adressen des Live-Kanals, passend zum Protokoll der Seite. Zuerst der Pfad des Kiosks,
 * danach `/ws`: ein vorgeschalteter nginx reicht unter dem Kiosk-Pfad nicht immer WebSockets weiter.
 */
export function liveUrls(loc: { protocol: string; host: string }, base: string = import.meta.env.BASE_URL): string[] {
  const origin = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host;
  return [...new Set([origin + base + 'ws', origin + '/ws'])];
}
