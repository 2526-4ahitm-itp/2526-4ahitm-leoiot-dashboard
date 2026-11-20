# Tasks

## 1. Code

- [x] 1.1 Add the query of design D1 to `src/core/flux.ts` and its loader to `src/data/load.ts`; verify a test of the query text (room and source checked, one-minute max windows, `> 1000.0`, `count()`) and of parsing one row or none
- [x] 1.2 Use it in the day summary with the floor of design D2 (`src/core/today.ts`, `src/app.ts`), and remove the five-minute count; verify tests for a short spike (1 min), a stored count, the floor from a live reading above 1000 ppm, exactly 1000 ppm (not above), and a failed query keeping the last value

## 2. Check and ship

- [x] 2.1 Against the local collector stack, write one reading of 1034 ppm between readings near 400 ppm; verify in the browser that the summary shows 1 min and the peak 1034 ppm
- [ ] 2.2 Run `npm ci && npm test && npm run build` in `leoiot-sensors/dashboard` and `.github/ci/image-build.sh leoiot-sensors/dashboard`; open the pull request and verify `ci-ok` is green
