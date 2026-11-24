# Tasks

All paths below are in `leoiot-sensors/dashboard/` unless noted.

## 1. Logic

- [x] 1.1 Add `src/core/kiosk.ts` (D4: `tileGrid`, `kioskPages` with even split, `attention`, `kioskParams`) with Vitest tests: split 29 rooms into 15 + 14, one floor, empty list, attention order and the stale rooms left out, parameter clamping and defaults.

## 2. View

- [x] 2.1 Route `?kiosk` in `src/main.ts` (D1) and add the kiosk markup to `index.html` (header, floor page, attention column, footer) hidden in the other views.
- [x] 2.2 Add `src/kioskApp.ts` and `src/ui/kiosk.ts` (D2, D3, D5, D6): rooms source, clock, paging timer, redraw in place, nightly reload, cursor hiding, address options, DE/EN texts in `src/core/i18n.ts`; verify app tests with fake timers for paging, floor option, attention updates between pages, freshness fallback, nightly reload and that no storage is written.
- [x] 2.3 Style the view in `src/styles/app.css` (D2) for 1920 × 1080, scaling with the viewport, dark by default, light with `theme=light`, reduced motion; no colour except the lamp states and the warning triangle.

## 3. Docs and checks

- [x] 3.1 Add the kiosk view to `leoiot-sensors/DESIGN.md` and a short "Hallway display" section (address, options, browser kiosk mode) to the sensors README.
- [x] 3.2 `npm test` and `npm run build` in `leoiot-sensors/dashboard/` pass.
- [x] 3.3 Browser check with the collector's local stack and the demo at 1920 × 1080, 1280 × 720 and 3840 × 2160: paging, split floor, attention column, `floor=`, `lang=en`, `theme=light`, `seconds=5`; no scrolling.
- [x] 3.4 `openspec validate sensors-school-kiosk --strict` passes.
