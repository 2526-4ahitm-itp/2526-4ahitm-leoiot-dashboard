# Design

## Context

The date segment (`#datesBtn` in `index.html`) carries a 16px calendar icon and the text "Zeitraum wählen", or the chosen range. `src/ui/datesPanel.ts` opens `#datesPanel` (a `popover`, with a hidden/shown fallback) holding two `<input type="date">` fields, validates them with `validateDates()` from `src/core/ranges.ts` (format, order, span from `allowedDates()`), and calls `apply(from, to)`. The rest of the date range (bounds, windows, queries, chart labels, `datesSegmentText()`) stays as it is.

The room list (`src/listApp.ts`, `src/ui/roomList.ts`, `src/core/roomList.ts`) is redrawn every 5 seconds and on every message; `renderRoomList()` keeps one `<li>` per room and one section per floor and only moves elements when the set changes. `listEntries()` groups rooms by `floorOf()` into `FloorEntries[]`. `main.ts` starts the room page when `?room=` is in the address and the list otherwise.

## Goals / Non-Goals

**Goals:** a booking-style range calendar without a library; a compact segment; search and floor filter that survive redraws, reloads and the back button; nothing in colour beyond the lamp rule.

**Non-Goals:** a general date picker component, times of day, presets, filtering by state.

## Decisions

**D1. Segment text.** While the selection is not `dates`, `#datesText` is empty and hidden and the button's `aria-label` is `t.datesPick`; the button is square-ish (36px high, 10px side padding). With dates the text shows as today. `title` mirrors the accessible name so mouse users get a tooltip.

**D2. Pure calendar logic in `src/core/calendar.ts`.** `monthGrid(year, month)` returns the weeks of a month (Monday first) as `YYYY-MM-DD` strings with leading/trailing nulls; `pickDay(state, day)` implements the click rule (`{from:null}` → `{from:day,to:null}`; `{from, to:null}` and `day >= from` → `{from, to:day}`; `day < from` or a complete range → `{from:day, to:null}`); `dayState(day, pick, hover, allowed)` returns `start | end | single | inside | none` plus `disabled` and `today`. All string-based on calendar days, no time zones involved; "today" and the allowed span come from `localDate()` / `allowedDates()` as now. Tested with Vitest.

**D3. Calendar UI in `src/ui/rangeCalendar.ts`.** Renders into `#datesPanel`: a status line (`aria-live="polite"`), a header with previous/next buttons and the two month names, two `role="grid"` tables with weekday headers (`Mo Di Mi Do Fr Sa So` / `Mo Tu We Th Fr Sa Su`) and day buttons, the error line (kept, now only for "no day picked"), and "Anzeigen". Day buttons carry `aria-label` with the full date ("Montag, 16. November 2026"), `aria-pressed` for first/last day and `aria-disabled` outside the span; one roving `tabindex=0`. Keys: arrows ±1/±7 days, Home/End start/end of week, Page Up/Down ±1 month (Shift ±1 year), Enter/Space picks, Escape closes. Moving focus past the shown months turns the page. The two months shown: the month of the current last day (or today) on the right and the one before it on the left; below 640px only the right one. Previous is disabled at the first allowed month, next at the current month. The status line reads "Ersten Tag wählen" → "16.11. gewählt – letzten Tag wählen" → "16.11. – 20.11. · 5 Tage".

**D4. Look.** Within DESIGN.md: first and last day are 36px ink squares with white text (the pressed-segment style, 9px corners on the outer side), days inside the range get the ground-grey band, hover preview the same band at lower contrast, today gets a 1px ink underline, disabled days are muted slate at 40 % and not clickable. No colour; no shadow. The panel keeps its hairline frame and padding. `prefillDates()` seeds the pick from the shown dates; with no dates the calendar opens empty showing the current month.

**D5. Apply.** Enter and Space on a day pick it; "Anzeigen" (or Ctrl/⌘+Enter anywhere in the panel) calls `apply(from, to ?? from)`. With nothing picked it shows the error line "Bitte einen Tag wählen." `validateDates()` stays as a guard. The "first after last" message disappears from the UI because the calendar cannot produce it.

**D6. Filter model.** `src/core/roomList.ts` gets `filterEntries(entries, { floor: FloorId | 'all' | 'other', query })`: query trimmed, lower-cased, spaces removed, matched as a substring of the lower-cased room id and of `displayRoomId()`; floor keeps one group. Floors that end up empty are dropped. `summarise()` keeps counting all rooms (the summary line describes the building); floor headings count the rooms shown.

**D7. Toolbar.** A row between the legend and the floors: a search field (`type="search"`, magnifier icon, placeholder "Raum suchen" / "Find room", 36px control style, 240px wide) and a segment "Alle" + one button per floor present in the list (full floor names, `aria-pressed`), in a `role="group"` labelled "Stockwerk". Below 640px the search takes the full width and the segment scrolls sideways inside itself. A result line under the toolbar, only while a filter is active: "12 von 107 Räumen" (`aria-live="polite"`). No match: "Kein Raum passt zu „xyz“." and a button "Filter zurücksetzen". Escape in the field clears it; "/" focuses it when focus is not in a field. A floor that disappears from the data while selected falls back to "Alle".

**D8. Address.** `listApp` reads `floor` and `q` from `location.search` at start and writes them back with `history.replaceState` (no new history entries), leaving out empty values. `main.ts` still decides by `room` only. The room links stay `?room=…`, so the back button returns to the list address with its filter.

## Risks / Trade-offs

- A self-made calendar is more code than native fields (rejected in `sensors-history-date-range`); it is now asked for explicitly, and the logic is kept pure and tested.
- Redraws every 5 seconds must not reset the search field or move focus: the toolbar is static HTML and only the list below it is synced.
