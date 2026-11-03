# Design

## Context

- `leoiot-pv/` has three applications built the same way: Vite, TypeScript without a framework, Vitest, one nginx container per application that serves the build, forwards Flux queries to InfluxDB with the read token from its environment and forwards the live channel (`kiosk/nginx/kiosk.conf.template`). `leoiot-pv/shared/` holds the definitions both existing applications use (counters, the day-change and step-back rules of `platform/data-contract`, live messages, Vienna time).
- Ports on vm23: 8088 kiosk, 8089 dashboard, 8090 live bridge, 8091 3D, 8092 sensors dashboard. `/kiosk2/` currently answers with a 301 in `leoiot-platform/proxy/nginx.conf`.
- The prototype Daniel chose lies outside the repository in `/home/daniel/leoiot/previews/pv-creative-kiosk/sonnenjahr.html?sun=b`. It runs on generated sample data. It is the visual reference for every screenshot check below. Its code is a throw-away study: the application is written anew in the structure below, and the prototype's decisions are taken over as values, not as code.
- Stored readings: about one point per minute; `daily_yield` reliable before 2026-04-20, all fields after it, `total_yield` only after it.

## Goals / Non-Goals

**Goals:**

- The picture and timing of the prototype, with real readings.
- All logic that decides what is shown (data shaping, timeline, labels, durations) testable without a browser.
- Runs on unknown hardware by lowering detail, never by losing timing.

**Non-Goals:**

- A second light variant or a theme switch: only "Morgenglut".
- Interaction, sound, English texts.
- Reading anything not in `platform/data-contract`.

## Decisions

### D1. Own application `leoiot-pv/kiosk2/`, port 8093

Same layout as `kiosk/` and `dashboard/`: own `package.json`, `Dockerfile` with `build-context` `..`, nginx template with `/kiosk2/api/query` (POST only, fixed target, token from `KIOSK2_INFLUX_TOKEN`) and `/kiosk2/ws`, health check on `/healthz`. The Compose service passes the kiosk's existing read token, as the dashboard does (its design D5). Folder and address share the name so that nobody has to translate between them.

*Alternative*: a second entry point inside `kiosk/`. Rejected: the main kiosk is accepted by the teacher and stays untouched; a shared build would tie their releases together and put Three.js into the main kiosk's bundle.

### D2. Rendering with Three.js and own shaders

The look depends on three custom shaders the prototype proved: the sky with the fog sea below the horizon in one full-screen pass, the terrain whose height comes from a texture in the vertex shader, and short shadow rays against the same texture. Three.js gives the camera, geometry, buffers and the WebGL2 setup; everything visible is in the shaders. It is bundled, never loaded from a CDN.

*Alternatives*: plain WebGL2 (more code for the same result), a 2D canvas (no light, no fog, the reason the earlier attempts looked cheap).

### D3. Data: one query per year, one per today

- Year: `daily_yield` of the last 365 Vienna days, last value per 10-minute window (`window(every: 10m)`, `last()`), as `todayQuery` does with 5 minutes. About 52 000 points, read once at start and after the nightly reload (03:30, as the main kiosk does).
- Today: the same at 10-minute resolution for today only, every five minutes.
- Lifetime: last `total_yield` once a minute; between those the live channel's `totalYield` of the daily totals message.
- Live power: `pv_power_kw` from `/kiosk2/ws` through `createLiveClient` in `shared`.

Power per window = increase of the day's highest value so far, divided by the window length; the day-change and step-back rules are the ones in `shared/influx.ts` (`monotoneRows`, `validRows`) and are reused, not rewritten. A window without a point is missing (spec "Missing readings"); a day without any point is a gap.

*Alternative*: 5-minute windows (105 000 points). Rejected after estimating the CSV size (about 8 MB); 10 minutes is finer than one pixel column at 1080p across the 1000 minutes of daylight shown.

### D4. Grid of the landscape

One row per day, one column per 10-minute window between 04:00 and 20:40 (100 columns), interpolated to 300 vertices along the ridge. The prototype smooths lightly across neighbouring minutes and days; the same weights are kept (0.9 own day, 0.05 each neighbour). Heights are normalised by the highest window power of the loaded year, so a ridge's height compares across all days (spec "same height scale"). The grid is a half-float texture, sampled by the terrain and the shadows.

### D5. The film is a pure function of time and data

`film(t, data)` returns everything the frame needs: the drawn day as a fractional number (12.5 = noon of day 12), the speed blend `fast` (0 = drawn by the point of light, 1 = whole days rise), the camera, the counter, which labels are on and where. The renderer only reads that state. This makes the loop testable: the seam test compares `film(LOOP - 0.1)` and `film(0.1)`, the duration test steps through the loop at 0.05 s as the prototype's audit did, and the label test checks that every visible summit flag is not hidden by a nearer ridge.

Key times are those of the prototype (loop 98 s): first day 0–5 s, two more slow days, time-lapse, best day drawn slowly from 22 s and marked from 27.4 s, a second slow day around 44 s, today at 60 s, moments 61–90 s, rewind 90–98 s. When the real best day lies at the very start or end of the year, the slow sections are placed by day index, not by fixed times, and the time-lapse segments stretch accordingly; the loop length stays fixed.

### D6. Counter from the end backwards

`total_yield` exists only after 2026-04-20, and missing days would make a counter that adds up from the start drift. The counter is the most recent `total_yield` minus the production of the shown days after the drawn moment. It is exact at today, and a missing day only means the counter stays still while that gap is passed (spec scenario "Collector down").

### D7. Labels only where the eye can find them

A summit label (single day, best day) is placed on that day's highest window, at the height the ridge has reached in that frame, and is only chosen when none of the next twelve ridges rises above 82 % of it at the same time of day. Milestones are not anchored to a summit; the counter itself lights up and the ridge of that day glows, because a summit flag for milestones was often hidden in the prototype.

### D8. Light "Morgenglut"

Values from the prototype: sky top `#090e1a`, middle `#122433`, horizon `#b88061`, glow `#ff8c40`, sun light `#f28c4d`, ambient `#24384d`, fog low `#0f1f2b`, fog high `#4d4d54`, mountain albedo from `#0b1120` to `#755761`, sun elevation 0.02 plus up to 0.07 in summer, tone mapping `1 − e^(−1.5c)`. No sun disc. The mountain foot blends into the same fog function the sky uses below the horizon, which is why no plate and no horizon line appear; the evening darkens sky, fog and mountains with the same factor.

### D9. Typefaces and colours apart from the main kiosk

Instrument Serif (dates, large numbers, sentences) and DM Mono (counter, labels), both SIL OFL, from `@fontsource`, bundled. The data colours of the main kiosk are not used: the film has one light and one material, and green ridges did not fit any sky (Daniel, 2026-11-02). `PRODUCT.md` records this as an exception for this kiosk only.

### D10. Readable over a moving picture

Large moments get a soft dark gradient from the left edge (not a box), labels a soft glow. The contrast requirement is checked on the screenshots of D12 by measuring the darkest text pixel against the brightest background pixel within 40 px of the text.

### D11. Adapting to the device

Rendering starts at device pixel ratio 1. When fewer than 40 frames per second are measured over two windows of two seconds, the pixel ratio is lowered by 20 % down to 0.5, and as a second step the shadow rays are switched off. Timing comes from the clock, not from frame counts, so a slow device shows the same film in coarser detail.

### D12. Verification through stills at fixed times

`?t=<seconds>` renders one still and stops; `?audit` runs the logic without rendering. Fixed times for screenshots: 2, 6.5, 12, 18, 29, 42, 52, 60, 66, 79, 86, 91, 97.5 s, at 1280 × 720 and 1920 × 1080, and 66 s with the evening. A fixture with a year of real readings (anonymous, no credentials) is stored with the tests so that the stills are repeatable.

## Risks / Trade-offs

- [The TV cannot render WebGL2 or is very slow] → D11 lowers detail; if it still stutters, the acceptance on the real screen fails and the decision about the device goes to Daniel and the teacher (#120). The film then shows a message instead of a black screen when WebGL2 is missing.
- [Real days look different from the sample curves, labels or camera land badly] → stills with the real fixture are the acceptance, not the prototype stills; camera targets are computed from the data (best day, newest day), not from fixed coordinates.
- [Year query too slow on InfluxDB] → measured before building the scene (task 2.1); fallback 15-minute windows.
- [Browsers that cached the 301 of `/kiosk2/`] → noted in the proposal; no screen in the school is affected.
- [Instrument Serif is a widely used face] → kept by Daniel's decision on 2026-11-03.
- [The CO₂ factor assumes the average mix] → stated on screen as "rund" with the source and in the spec.

## Migration Plan

1. Build and test `kiosk2/` and its container locally against the legacy stack, as the main kiosk did.
2. Separate pull request for the shared files: Compose service, `leoiot-platform/proxy/nginx.conf` (`/kiosk2/` proxies to 8093 with WebSocket headers, `/kiosk2` redirects to `/kiosk2/`), documentation site.
3. Release only when Daniel says so. Daniel installs the proxy file on vm23 and reloads nginx; then `/kiosk2/` shows the film. Rollback: restore the two 301 lines and reload; the container can keep running.
