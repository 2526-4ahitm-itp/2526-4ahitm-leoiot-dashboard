// The only way the page reaches the stored readings: a POST to the dashboard's own nginx, which
// adds the database token on the server side. The browser never holds a credential.

export type Query = (flux: string) => Promise<string>;

/** Sends a Flux query to `<base>api/query` and returns the CSV answer. */
export function createQuery(fetchFn: typeof fetch = fetch, base: string = import.meta.env.BASE_URL): Query {
  return async (flux) => {
    const response = await fetchFn(`${base}api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.flux', Accept: 'application/csv' },
      body: flux,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  };
}
