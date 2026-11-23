---
name: LeoIoT Raumklima
description: Room-climate dashboard of HTL Leonding. One lit lamp tells whether a room needs airing.
colors:
  ground: "#eceef1"
  panel: "#ffffff"
  ink: "#14181d"
  ink-2: "#434b55"
  ink-3: "#5c6570"
  line: "#dde1e6"
  line-ctl: "#7d8692"
  housing: "#262b31"
  lamp-off: "#3b4148"
  lamp-green: "#1f9d55"
  lamp-amber: "#e3a008"
  lamp-red: "#d93a2e"
  green-ink: "#157a41"
  amber-ink: "#855c00"
  red-ink: "#b42a1f"
  band-good: "rgba(31, 157, 85, 0.08)"
  band-soon: "rgba(227, 160, 8, 0.14)"
  band-bad: "rgba(217, 58, 46, 0.1)"
  humidity: "#4d6f91"
  selection: "#d6e4f2"
typography:
  headline:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.1
  value:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  body:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
  label:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  caption:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  ctl: "9px"
  panel: "14px"
  housing: "38px"
  pill: "99px"
  round: "50%"
spacing:
  hair: "8px"
  tight: "12px"
  cell: "12px"
  gutter: "16px"
  panel-y: "20px"
  panel-x: "32px"
  page-x: "40px"
components:
  room-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "20px 32px 20px"
  chart-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "14px 22px 6px"
  lamp-housing:
    backgroundColor: "{colors.housing}"
    rounded: "{rounded.housing}"
    padding: "14px"
    width: "76px"
  lamp-off:
    backgroundColor: "{colors.lamp-off}"
    rounded: "{rounded.round}"
    size: "44px"
  lamp-green-lit:
    backgroundColor: "{colors.lamp-green}"
    rounded: "{rounded.round}"
    size: "44px"
  lamp-amber-lit:
    backgroundColor: "{colors.lamp-amber}"
    rounded: "{rounded.round}"
    size: "44px"
  lamp-red-lit:
    backgroundColor: "{colors.lamp-red}"
    rounded: "{rounded.round}"
    size: "44px"
  segment-control:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "36px"
    padding: "0 14px"
  segment-control-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
  segment-control-hover:
    backgroundColor: "{colors.ground}"
  icon-button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    size: "36px"
  identity-line:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
  small-lamp:
    backgroundColor: "{colors.lamp-off}"
    rounded: "{rounded.round}"
    size: "12px"
  today-column:
    backgroundColor: "{colors.panel}"
    width: "260px"
    padding: "0 0 0 32px"
  value-cell:
    textColor: "{colors.ink}"
    typography: "{typography.value}"
  empty-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "56px 36px"
---

# Design System: LeoIoT Raumklima

The tokens are defined in `dashboard/src/styles/tokens.css`. That file is the source; this document describes it. The values above are the light scheme. The dark scheme redefines the same names (see `.impeccable/design.json`).

## Overview

**Creative North Star: "Classroom Air Light"**

A room's air state is a lit lamp, not a number to read. A dark housing holds three round lamps (red, amber, green). One lamp is lit, and one sentence next to it says what to do: "Luft gut", "Bald lüften", "Jetzt lüften". The charts carry the same lamps as background bands.

Everything else is matte and neutral: a cool grey ground, white panels, near-black ink. Colour means the state of a value and nothing else. Controls stay grey. The page is dense but calm: the panel reads in order: the room (one line), the air state, the values with their own small lamps, and the day so far in a column on the right. Then three chart panels: CO₂ large on the left, temperature and humidity stacked on the right.

The layout refuses a wall of KPI tiles with sparklines. Values sit in fixed cells that keep their place and their width; only the content changes.

**Key Characteristics:**
- One lit lamp per room for CO₂; unlit lamps stay dark grey. Temperature and humidity get a small two-state lamp each.
- Colour only for the state of a value; controls, text and the chart lines are ink.
- Lexend throughout, tabular numerals everywhere.
- Flat panels on a grey ground; no drop shadows.
- Simulated data is dashed, never hidden.

## Colors

A neutral housing-grey palette with three traffic-light hues that appear only when they mean an air state.

### Primary
- **Lamp Green** (lamp-green): the lit lamp when CO₂ is below 800 ppm, and the small lamp of temperature or humidity inside its range. Its darker **Green Ink** (green-ink) colours the value in the same state, so text keeps contrast on white.
- **Lamp Amber** (lamp-amber): the lit lamp from 800 to 1000 ppm, and the small lamp of temperature or humidity outside its range. **Amber Ink** (amber-ink) is its text form.
- **Lamp Red** (lamp-red): the lit lamp above 1000 ppm. **Red Ink** (red-ink) is its text form.
- **Lamp Bands** (band-good, band-soon, band-bad): the same three hues at 8 to 14 % opacity, as background bands below 800, 800 to 1000 and above 1000 ppm in the CO₂ chart.

### Secondary
- **Muted Steel Blue** (humidity): the humidity line in its own chart panel. It is the only hue that is not an air state, and it keeps humidity apart from the ink-coloured CO₂ and temperature lines.

### Neutral
- **Housing Grey** (ground): page ground and hover fill of controls.
- **Panel White** (panel): top bar, room panel, chart panels, tooltips, control fill.
- **Near-Black Ink** (ink): text, the temperature and CO₂ lines, the pressed segment, the focus ring.
- **Slate** (ink-2): secondary text: the reason under the status, the room breadcrumb, notes.
- **Muted Slate** (ink-3): labels, units, axis labels, the freshness line and its dot, outdated values.
- **Hairline** (line): panel dividers, the top bar border, chart grid lines.
- **Control Edge** (line-ctl): borders of controls, the dashed limit lines at 800 and 1000 ppm, the dashed simulated tag.
- **Lamp Housing** (housing) and **Unlit Lamp** (lamp-off): the traffic-light body and its dark lamps.
- **Selection Tint** (selection): text selection only.

### Named Rules
**The Lamp-Only Colour Rule.** Green, amber and red mean the state of a value and nothing else. CO₂ has three steps (green, amber, red): the lamp housing, the value and the chart bands. Temperature and humidity have two (green inside the range, amber outside; no red, because the source, § 28 B-AStV, gives one range): the small lamp and the value. Controls, text and chart lines stay neutral; so do the freshness dot and the Heute column. The small lamps never change the CO₂ lamp or the status sentence, and the direction word ("zu kalt", "zu trocken") carries the state, so colour is never the only signal. The one other exception in the build is the warning triangle of an outdated reading, drawn in amber ink.

**The Two Schemes Rule.** Every colour exists in a light and a dark form with the same name. Light is the default; the system scheme applies until the visitor picks one with the theme button.

## Typography

**Display Font:** none; Lexend (with system-ui, sans-serif), self-hosted through `@fontsource/lexend`
**Body Font:** Lexend
**Label/Mono Font:** none; Lexend with tabular numerals

**Character:** One friendly, wide sans for everything. Weight 700 carries hierarchy; 400 carries prose. The body sets `font-variant-numeric: tabular-nums`, so numbers do not jump when they change.

### Hierarchy
- **Headline** (700, 40px, 1.1, balanced wrapping): the status sentence. 32px below 640px.
- **Value** (700, 34px): the three value cells. 24px below 640px. In the Heute column values are 22px.
- **Empty title** (700, 28px): the heading of the no-data and error panel. 22px below 640px.
- **Brand** (700, 18px): "LeoIoT" in the top bar, followed by "Raumklima" at 400 in muted slate.
- **Title** (700, 17px): chart panel headings. The identity line "Raum 105" is a title at 20px.
- **Body** (400, 17px, max 62ch): the reason under the status. The breadcrumb and units use 16px.
- **Label** (400, 14px): the direction word under a value, freshness line, chart window, notes.
- **Caption** (400, 13px): value cell labels, the Heute heading and its labels, the estimate note. Chart axis labels and the ppm and % axis names use 12px.

### Named Rules
**The Tabular Rule.** Every number is set in tabular figures. A value that changes keeps its width.

**The Weight Pair Rule.** The build uses 400 and 700 only. Do not add a third weight for emphasis.

## Layout

A single column, at most 1520px wide and centred. Page padding is 20px on top and bottom and 40px at the sides; sections are 16px apart. From 1100px width a room page with readings is exactly one window high: the room panel keeps its natural height (about 290px) and the charts take the rest, so the page fits a 1280 × 720 window at 100 % zoom. A lower window scrolls; the room list and the no-data page keep their natural height.

- **Top bar:** 60px high, white, a hairline below, 40px side padding. Brand, room breadcrumb (behind a hairline divider), the 24 h / 7 Tage segment, a spacer, the DE / EN segment, the theme button.
- **Room panel:** the identity line on top, then a three-column grid: the 76px lamp housing, the state column (status, reason, value cells, freshness line) and the Heute column (about 260px, a hairline on its left). Columns are 32px apart.
- **Value cells:** three columns of up to 210px under a hairline. Temperature and humidity reserve a second line for the direction word, so the cells keep their height whether or not a word is shown. They never reflow while values update.
- **Charts:** three boxes in a two-column grid with 16px gaps, filling the height the room panel leaves. Left: CO₂ at the full height of the chart area (chart at least 240px). Right: temperature above humidity in a 3 : 2 ratio (charts at least 110px and 80px). At 1440 × 789 the charts are about 330, 170 and 100px high; at 1920 × 960 about 500, 275 and 165px. One synced pointer runs through all three.

Responsive steps:
- **Below 1100px:** the charts stack in the order CO₂ (340px), temperature (260px), humidity (200px); the Heute block moves below the cells and spans the panel, its three pairs in a row.
- **Below 760px:** the panel is one column; the lamp housing lies horizontally under the identity line.
- **Below 640px:** the top bar wraps with 16px padding; page padding and gaps drop to 16px; the room panel pads 20px; the unit moves below the value; the Heute pairs stack.

## Elevation & Depth

Flat. Panels sit on the grey ground without shadows; depth comes from the tone step between ground and panel. The only `box-shadow` in the system is the halo of the lit lamp: a 5px ring of the lamp colour at 28 %. It is a light source, not elevation.

### Shadow Vocabulary
- **Lamp halo** (`box-shadow: 0 0 0 5px color-mix(in srgb, var(--g|--y|--r) 28%, transparent)`): only on the one lit lamp.

### Named Rules
**The Flat Panel Rule.** Panels and controls have no shadow. Separation is tone (ground against panel) and hairlines.

## Shapes

Soft rectangles and circles. Panels have gently rounded corners (14px); controls slightly tighter (9px). The lamp housing is a capsule (38px) holding circular lamps (44px). The simulated tag is a dashed pill (99px). The focus ring is a 2px ink outline, 3px away, with 6px corners; inside segments it sits 4px inside with square corners.

## Components

### Buttons and segments
Neutral, quiet controls that never take an air colour.
- **Shape:** 36px high, 1px control-edge border, 9px corners, white fill.
- **Segment:** buttons share one border, divided by control-edge lines, 14px side padding. The pressed segment is ink with white text.
- **Hover / Focus:** hover fills with ground grey; colour and background transition in 180ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Focus shows the ink ring; on a pressed segment the ring is white.
- **Icon button:** 36px square, an 18px line icon (moon or sun, stroke 1.8) for the theme.

### Room panel and lamp housing (signature)
- **Housing:** dark capsule, 14px padding, three lamps 12px apart, red on top.
- **Lamps:** dark grey when unlit. The lit lamp takes its colour and its halo; the change animates in 180ms. With no reading, all three stay dark ("Ampel aus").
- **Status:** one sentence in the headline style, one reason sentence below it. Both are announced politely to screen readers.

### Value cells
- **Style:** caption label above, value in the value style, unit at 16px in muted slate.
- **Quantity icons:** a 16px line icon before each label, 6px gap: a molecule (O=C=O) for CO₂, a thermometer for temperature, a drop for humidity. Authored inline SVG on a 24px grid with the stroke of the theme icons (1.8, round caps and joins), in muted slate like the label, never in a state colour, and `aria-hidden` (the label names the quantity).
- **State:** the CO₂ value takes the ink form of the current lamp colour. Temperature and humidity take the ink form of their small lamp (green or amber); neutral ink when the lamp is off. When the reading is outdated, all values turn muted slate and all lamps go off.
- **Empty value:** an en dash.

### Small lamp
- **Shape:** a 12px dot in front of the temperature or humidity value (the size of the room list's dots), dark grey when off, green or amber when lit, no halo. It is decorative (`aria-hidden`); the direction word below the value (14px slate: "im Bereich", "zu kalt", "zu warm", "zu trocken", "zu feucht") is the accessible state.
- **Ranges:** § 28 B-AStV: temperature 19 to 25 °C, humidity 40 to 70 % (guide value); the bounds belong to the range; compared on the shown, rounded value.

### Freshness line
- **Live:** an 8px muted-slate dot, then "Stand 10:42 · vor 12 s".
- **Outdated (no reading for 5 minutes):** the dot becomes a 16px warning triangle in amber ink and the text turns ink: "Zuletzt 10:42". The status reads "Keine aktuellen Werte".

### Identity line and simulated data
- **Style:** one line at the top of the room panel: the room as the page's `<h1>` ("Raum 105", title style at 20px, 700), then the link "Im Gebäude zeigen" in 15px slate. No device name and no "gemessen".
- **Simulated:** only simulated readings add a dashed pill "simuliert" after the link, and every chart line is dashed. Simulated values are never drawn as measurements.

### Room list
- **Header:** title, then a summary line in 15px ink-2 ("107 Räume · 11 jetzt lüften · 15 bald lüften · 1 nicht aktuell", states without a room left out), then a freshness line in 14px slate with the muted 8px dot ("Live-Werte", or "Aktualisierung jede Minute · Stand 11:14" while the stored readings are used; never coloured). One legend line, "Gestrichelter Rahmen: simulierte Werte", shows only while a simulated room is listed.
- **Floors:** the floor name with a muted count after it (" · 29 Räume · 3 jetzt lüften"), rooms in a grid of at least 240px columns with 10px gaps, in a panel padded 28px 32px 32px; one column below 640px.
- **Entry:** one line per room, a 1px bordered link with 10px padding and 8px gaps: the 12px lamp dot, the room id (17px, 700), the CO₂ value with unit, and in between a state word (13px, ink-2) only where attention is needed: "Bald lüften", "Jetzt lüften", "Kein CO₂-Wert". Good air has no visible word (it is in the DOM for screen readers), so a room with a word needs attention and a room without one does not. The word sits after the id and wraps under it only when the column is too narrow; nothing is cut off. The link's accessible name starts with the visible id ("E11, Luft gut, 726 ppm, simuliert").
- **Simulated:** a dashed outline instead of a solid one, no pill; the legend line explains it and the accessible name says "simuliert". The room page keeps its pill.
- **Outdated:** the lamp dot is replaced by a 12px warning triangle in amber ink, the word is "Zuletzt 11:07" and the value is muted slate at weight 400.
- **Load error:** when the stored readings cannot be loaded and no room is known, one line says so and that the page tries again every minute; it never says that no room is sending. Rooms already shown stay.

### Heute column
- **Icon:** "Zuletzt gelüftet" carries a 16px window icon (frame with cross bars) before its label, drawn like the quantity icons. The other two pairs have none.
- **Content:** the day since local midnight (Europe/Vienna): a caption heading "Heute", then three label and value pairs: "Über 1000 ppm" (time as "1 h 20 min", or "noch nicht"), "Höchstwert" (value, unit and time) and "Zuletzt gelüftet" ("ca. 10:45" or "heute nicht erkannt", with the caption "geschätzt aus dem CO₂-Verlauf" under a time). Without a reading today one line "Heute noch keine Werte".
- **Style:** caption labels, values at 22px, 700, ink; units and the note in muted slate. A hairline on the column's left (on top below 1100px). When the room is outdated, the values turn muted slate; the summary stays because it describes the past.
- **Not a KPI tile:** no sparkline, no colour; the charts below carry the curve.

### Chart panels
- **Container:** white panel, 14px corners, padding 14px 22px 6px.
- **Boxes:** three, one per quantity: CO₂ on the left at the full height of the chart area, temperature above humidity on the right. Humidity has its own box.
- **Heading:** the same 16px quantity icon as the value cell and the title ("CO₂", "Temperatur", "Luftfeuchte") on the left, time window with its unit (`· ppm`, `· °C`, `· %`) in label style on the right.
- **Lines:** 2.2px, no symbols, gaps where readings are missing. Temperature and CO₂ are ink; humidity is muted steel blue.
- **CO₂ bands and limits:** the three lamp bands behind the CO₂ line, and dashed control-edge lines (3 on, 4 off) at 800 and 1000 ppm.
- **Axes and tooltip:** muted-slate labels, hairline grid, no ticks. The tooltip is a white panel with a hairline border; the pointer is a muted-slate line through all three charts, shared by connecting them; each tooltip shows its own quantity.
- **Notes:** "no values", loading and error notes in 14px slate below the chart.

### Empty and error panel
White panel, 56px by 36px padding, a 28px title and a slate paragraph of at most 60ch. It replaces the room panel and the charts for rooms without data and for load errors.

## Do's and Don'ts

### Do:
- **Do** show the air state as exactly one lit lamp plus one sentence from the fixed vocabulary (Luft gut, Bald lüften, Jetzt lüften / Air is fine, Air the room soon, Air the room now).
- **Do** use the CO₂ limits 800 and 1000 ppm everywhere a CO₂ state colour appears, and the ranges of § 28 B-AStV for the small lamps.
- **Do** set every number in tabular Lexend and keep value cells at a fixed width.
- **Do** dash simulated data: the source tag outline and every chart line.
- **Do** show how current every value is, and mark outdated values in muted slate with the warning triangle.
- **Do** read chart colours from the CSS variables, so both schemes apply.

### Don't:
- **Don't** use green, amber or red for anything other than the state of a value: not for controls, links, the freshness dot, the Heute column or decoration.
- **Don't** let the small lamps of temperature and humidity drive the status sentence or the CO₂ lamp, and don't add a red step to them.
- **Don't** add shadows to panels or controls; the lamp halo is the only shadow.
- **Don't** replace the lamp with a KPI tile, a gauge or a sparkline.
- **Don't** show a missing value as zero; show an en dash and a gap in the chart.
- **Don't** add a font weight beyond 400 and 700, or a second typeface.
