# Tasks

## 1. Charts

- [x] 1.1 Split `airOption` into `co2Option` and `humidityOption` in `src/core/chartOptions.ts`; verify the chart option tests for bands, limit lines, axis extents, gaps and dashed simulated lines pass for the new options
- [x] 1.2 Create three instances in one connected group in `src/ui/charts.ts` and wire them in `src/app.ts`; verify a test that all three join `room-climate` and get their option on render
- [x] 1.3 Add the third panel to `index.html` and render headings, time windows, notes and accessible names for all three in `src/ui/render.ts`; verify render tests in German and English

## 2. Layout and docs

- [x] 2.1 Lay out CO₂ left at full height and temperature above humidity on the right, stacking below 1100 px; check 1440, 1100 and 360 pixels, light and dark, in the browser against a local stack and verify no horizontal scrolling
- [x] 2.2 Update the chart panels in `leoiot-sensors/DESIGN.md` and the FIRST VIEWPORT of `leoiot-sensors/.impeccable/surfaces/dashboard.md`; verify they match the built page
- [x] 2.3 Run `npm ci && npm test && npm run build` and `.github/ci/image-build.sh leoiot-sensors/dashboard`; open the pull request and verify `ci-ok` is green
