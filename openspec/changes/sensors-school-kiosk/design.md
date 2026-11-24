# Design

## Context

The room list (`src/listApp.ts`) reads every room through `startRoomsSource()` (retained live messages, with the stored readings as fallback), turns them into `FloorEntries[]` with `listEntries()` and counts them with `summarise()`; the list renderer keeps DOM nodes and only updates text. `src/main.ts` starts the room page when `?room=` is set and the list otherwise. The room list already has a floor filter (`floor` in the address, `floorFromParam()`), dashed outlines for simulated rooms and the outdated marking. DESIGN.md: colour means the state of a value only; flat panels; Lexend 400/700; tabular numbers.

## Goals / Non-Goals

**Goals:** readable from 3–5 m on a 1920 × 1080 TV; the rooms that need airing always visible; every room of the school shown within one cycle (about 1–2 minutes); runs unattended for weeks; same rules and data as the list.

**Non-Goals:** interaction, a map, charts, per-screen configuration beyond the address.

## Decisions

**D1. Route.** `main.ts`: `?room=` → room page; otherwise `kiosk` present in the query (any value, also empty) → `startKioskApp()`; otherwise the list. The kiosk sets `data-view="kiosk"` on `#app` (or a dedicated `<main id="kiosk">` in `index.html` that is hidden in the other views) and hides the top bar.

**D2. Layout (1920 × 1080).** A CSS grid filling the viewport (`100vh`, no scrolling, `overflow: hidden`): header (about 110px), main area and attention column (about 420px wide) side by side, footer (about 64px). 32px outer padding. All sizes in `clamp()`/`vmin` units so that a 1280 × 720 or 3840 × 2160 screen scales proportionally.
- **Header:** "Raumklima" title (40px, 700) with "LeoIoT · HTL Leonding" smaller; the summary line (24px) below; on the right the clock (64px, 700, tabular, `HH:MM`) above the date ("Dienstag, 24. November") and the freshness line ("Live-Werte" / "Aktualisierung jede Minute · Stand 11:14"), with the warning triangle when the whole display is outdated (no successful update for 5 minutes).
- **Floor page:** the floor name (36px, 700) with its counts and "1/2" when split; a grid of tiles, columns and rows computed from the area (D4).
- **Tile:** panel background, 1px border (dashed for simulated), 14px corners; a 20px lamp dot, the room id (34px, 700) and the CO₂ value (34px, 700, in the lamp's ink colour; unit 18px muted). Below the id a 20px state word only for "Bald lüften", "Jetzt lüften", "Kein CO₂-Wert" or, for outdated rooms, the triangle and "Zuletzt 11:07" with the value muted at 400 — exactly the list's rules, larger.
- **Attention column:** heading "Jetzt lüften" with count, then those rooms (room id 30px, value 30px, red lamp dot), then "Bald lüften" with its rooms; sorted by CO₂ descending; rooms whose floor is on screen are not repeated specially. When more rooms than fit: the last line "+ 4 weitere". When none: "Alle Räume haben gute Luft." (or, with outdated rooms only, that text plus nothing else). Outdated rooms are not listed here; they are counted in the header.
- **Footer:** the floors present in the data, in building order, as words in a row (24px); the current one in ink 700, the others muted; under the current one a 3px ink progress line that fills during the page time (CSS animation restarted per page; with `prefers-reduced-motion: reduce` it is a static full line). Below or to the right, the legend "Gestrichelter Rahmen: simulierte Werte" when a simulated room exists.

**D3. Theme and language.** Dark by default (`data-theme="dark"` set by the kiosk), `theme=light` in the address switches; the saved theme of the visitor's browser is ignored. `lang=en` or `lang=de` from the address, default German; the saved language is ignored. Nothing is written to storage.

**D4. Paging (pure, `src/core/kiosk.ts`).** `tileGrid(width, height)` → `{ cols, rows }` from the main area's size with a minimum tile of 220 × 120 px (scaled with the same factor as D2). `kioskPages(entries, perPage)` → `{ floor, part, parts, rooms }[]`: one page per floor, a floor with more rooms than `perPage` split into equal parts (`ceil(n / perPage)` parts, rooms spread evenly, not 28 + 1). `attention(entries)` → `{ bad: RoomEntry[], soon: RoomEntry[] }` sorted by CO₂ descending, live rooms only. `kioskParams(search)` → `{ floor, lang, theme, seconds }` with `seconds` clamped to 5–120, default 15. All unit-tested.

**D5. Cycle.** The app keeps the index of the current page. Every `seconds` it advances; pages are recomputed on every data change and on resize, and the current position is kept by floor and part (if the floor vanished, it continues with the next one). With `floor=` set, only that floor's pages cycle; with one page only, no cycling and no progress line. Data updates redraw the current page in place (the list renderer's keep-the-nodes approach) without restarting the page timer.

**D6. Running unattended.** The clock ticks every second (text only). Ages are judged every 5 seconds as in the list. Once a day at 03:30 local time the page calls `location.reload()` (a timer computed from now; tested with fake time). The cursor is hidden after 3 seconds without mouse movement. No storage writes, no network beyond the rooms source.

**D7. Accessibility.** The display is not interactive; it still uses headings (h1 title, h2 floor, h2 attention) and text, not images, so it can be read with a screen reader or zoomed. The page title is "Raumklima · LeoIoT". The cycling region is not `aria-live` (it would talk every 15 s).

## Risks / Trade-offs

- Rooms on long floors are only visible on their part's page; the attention column covers the rooms that matter.
- A full cycle with 5 floors and two parts for the biggest floor takes about 90–105 s at 15 s per page.
- TVs may render at 1080p with overscan; the 32px padding leaves some margin.
