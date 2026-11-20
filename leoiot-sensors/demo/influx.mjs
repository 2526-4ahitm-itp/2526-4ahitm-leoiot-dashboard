// DEMO, not a permanent part of the system: see README.md.
// InfluxDB 2 over plain fetch: write line protocol, delete the demo's points.

const BATCH = 5000;

function endpoint(cfg, path, extra = '') {
  const org = encodeURIComponent(cfg.org);
  const bucket = encodeURIComponent(cfg.bucket);
  return `${cfg.url}${path}?org=${org}&bucket=${bucket}${extra}`;
}

async function check(response, what) {
  if (response.ok) return;
  const body = await response.text().catch(() => '');
  throw new Error(`${what} failed: HTTP ${response.status} ${body}`.trim());
}

/** Writes lines (timestamps in ms) in batches of 5000; throws on a non-2xx answer. */
export async function writeLines(cfg, lines) {
  for (let i = 0; i < lines.length; i += BATCH) {
    const response = await fetch(endpoint(cfg, '/api/v2/write', '&precision=ms'), {
      method: 'POST',
      headers: { Authorization: `Token ${cfg.token}`, 'Content-Type': 'text/plain; charset=utf-8' },
      body: lines.slice(i, i + BATCH).join('\n'),
    });
    await check(response, 'Writing to InfluxDB');
  }
}

/** Deletes every room_climate point with device = demo; leaves all others untouched. */
export async function deleteDemo(cfg) {
  const response = await fetch(endpoint(cfg, '/api/v2/delete'), {
    method: 'POST',
    headers: { Authorization: `Token ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start: '1970-01-01T00:00:00Z',
      stop: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      predicate: '_measurement="room_climate" AND device="demo"',
    }),
  });
  await check(response, 'Deleting demo points');
}
