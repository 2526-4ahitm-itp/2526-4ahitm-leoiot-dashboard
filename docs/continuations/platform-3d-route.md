# platform-3d-route

Continuation prompt for the reverse-proxy route of the new 3D building explorer. Planned 2026-10-28 by the 3D-Modell team (Paul Kreinecker, Jonas Leitner) together with the change `model3d-building-explorer`; read that change for the 3D app itself. Nothing of this is implemented yet.

## State

- **Branch / change:** route merged with branch `feat/platform-3d-route`; no OpenSpec change. The 3D app is the change `model3d-building-explorer`.
- **Next steps:**
  1. Promote `main` to `release` (`AGENTS.md`, "Shipping"). The deployment starts the 3D container on `127.0.0.1:8091`.
  2. Someone with access to vm23 copies `leoiot-platform/proxy/nginx.conf` to `/etc/nginx/sites-available/leoiot`, runs `nginx -t` and reloads nginx: it is not updated by the deployment (`operations.md`). Agents do not do this.
- **Order:** the smoke route `/3d/` fails until both are done, so the deployment is marked failed if nginx is not applied first; the next deployment repeats the check. Applying nginx before the promotion avoids that: it does no harm while nothing listens on 8091, `/3d/` just answers 502.
- **After that:** the later iteration below stays open; delete this prompt when it is done or dropped.

## Later iteration (not now): `/` opens the new 3D app

Until another page becomes the main page, `/` could open the new explorer instead of the legacy one. Another platform pull request then adds to `nginx.conf`:

```nginx
# Main page: the 3D explorer, until another page becomes the main page
location = / { return 302 /3d/; }
```

- 302 (temporary), not 301 (permanent): browsers remember a 301 and would keep jumping to `/3d/` after the main page changes again; a 302 is asked anew every time.
- `location = /` matches only the bare `/`; the legacy catch-all `location /` stays for all other paths until legacy is switched off.
- Update the `/` row in `operations.md`; `smoke-routes` already has `/` (redirects are followed).
- Apply on vm23 by hand as above.
- **Before** this redirect ships, a `model3d-…` change removes the temporary "Last reading" time from the info panel (spec `model3d/room-climate-view`, requirement "The info panel shows the time of the last reading, for now"; decision D12 of `model3d-building-explorer`).
