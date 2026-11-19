# Tasks

## 1. Layout

- [x] 1.1 Tighten the desktop spacing in `leoiot-sensors/dashboard/src/styles/app.css` as in design D1, leaving the rules below 640 px unchanged; verify in the browser that the room panel is about 290 px high at 1440 px width
- [x] 1.2 Make the room page one window high from 1100 px width (design D2) and set the minimum chart heights (design D3); verify at 1280 × 720, 1440 × 789 and 1920 × 960 that `document.documentElement.scrollHeight` equals the window height and the charts redraw at their new sizes
- [x] 1.3 Check the other cases against a local stack: 1280 × 600 scrolls vertically with the minimum chart heights; 1024 and 360 px width stack as before; the room list, a room without data and the loading state keep their natural height; light and dark; no horizontal scrolling anywhere

## 2. Docs and checks

- [x] 2.1 Update spacing and layout in `leoiot-sensors/DESIGN.md` and the FIRST VIEWPORT of `leoiot-sensors/.impeccable/surfaces/dashboard.md`; verify they match the built page
- [ ] 2.2 Run `npm ci && npm test && npm run build` in `leoiot-sensors/dashboard` and `.github/ci/image-build.sh leoiot-sensors/dashboard`; open the pull request and verify `ci-ok` is green
