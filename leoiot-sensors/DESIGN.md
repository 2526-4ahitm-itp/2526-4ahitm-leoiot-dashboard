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
  display:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "128px"
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: "-0.035em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "44px"
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
  cell: "14px"
  gutter: "24px"
  panel-y: "28px"
  panel-x: "36px"
  page-x: "40px"
components:
  room-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "28px 36px"
  chart-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "22px 26px 12px"
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

Everything else is matte and neutral: a cool grey ground, white panels, near-black ink. Colour means air state and nothing else. Controls stay grey. The page is dense but calm: one large room id, one status line, three fixed value cells, a freshness line, and two chart panels.

The layout refuses a wall of KPI tiles with sparklines. Values sit in fixed cells that keep their place and their width; only the content changes.

**Key Characteristics:**
- One lit lamp per room; unlit lamps stay dark grey.
- Colour only for air state; controls, text and the temperature line are ink.
- Lexend throughout, tabular numerals everywhere.
- Flat panels on a grey ground; no drop shadows.
- Simulated data is dashed, never hidden.

## Colors

A neutral housing-grey palette with three traffic-light hues that appear only when they mean an air state.

### Primary
- **Lamp Green** (lamp-green): the lit lamp when CO₂ is below 800 ppm. Its darker **Green Ink** (green-ink) colours the CO₂ value in the same state, so text keeps contrast on white.
- **Lamp Amber** (lamp-amber): the lit lamp from 800 to 1000 ppm. **Amber Ink** (amber-ink) is its text form.
- **Lamp Red** (lamp-red): the lit lamp above 1000 ppm. **Red Ink** (red-ink) is its text form.
- **Lamp Bands** (band-good, band-soon, band-bad): the same three hues at 8 to 14 % opacity, as background bands below 800, 800 to 1000 and above 1000 ppm in the CO₂ chart.

### Secondary
- **Muted Steel Blue** (humidity): the humidity line in the lower chart panel. It is the only hue that is not an air state, and it exists only to tell the second series apart.

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
**The Lamp-Only Colour Rule.** Green, amber and red appear only as the current air state: the lit lamp, the CO₂ value, and the chart bands. The freshness dot, the controls and the other values stay neutral. The one exception in the build is the warning triangle of an outdated reading, drawn in amber ink.

**The Two Schemes Rule.** Every colour exists in a light and a dark form with the same name. Light is the default; the system scheme applies until the visitor picks one with the theme button.

## Typography

**Display Font:** Lexend (with system-ui, sans-serif), self-hosted through `@fontsource/lexend`
**Body Font:** Lexend
**Label/Mono Font:** none; Lexend with tabular numerals

**Character:** One friendly, wide sans for everything. Weight 700 carries hierarchy; 400 carries prose. The body sets `font-variant-numeric: tabular-nums`, so numbers do not jump when they change.

### Hierarchy
- **Display** (700, 128px, line-height 0.86, -0.035em): the room id, exactly as on the door sign. 84px below 640px.
- **Headline** (700, 44px, 1.1, balanced wrapping): the status sentence. 32px below 640px.
- **Value** (700, 34px): the three value cells. 24px below 640px.
- **Empty title** (700, 28px): the heading of the no-data and error panel. 22px below 640px.
- **Brand** (700, 18px): "LeoIoT" in the top bar, followed by "Raumklima" at 400 in muted slate.
- **Title** (700, 17px): chart panel headings.
- **Body** (400, 17px, max 62ch): the reason under the status. The breadcrumb and units use 16px.
- **Label** (400, 14px): identity line, freshness line, chart window, notes.
- **Caption** (400, 13px): value cell labels. Chart axis labels and the ppm and % axis names use 12px.

### Named Rules
**The Tabular Rule.** Every number is set in tabular figures. A value that changes keeps its width.

**The Weight Pair Rule.** The build uses 400 and 700 only. Do not add a third weight for emphasis.

## Layout

A single column, at most 1520px wide and centred. Page padding is 28px on top and 40px at the sides and bottom; sections are 24px apart.

- **Top bar:** 60px high, white, a hairline below, 40px side padding. Brand, room breadcrumb (behind a hairline divider), the 24 h / 7 Tage segment, a spacer, the DE / EN segment, the theme button.
- **Room panel:** a three-column grid: identity (room id and identity line), the 76px lamp housing, and the state column (status, reason, value cells, freshness line). Columns are 40px apart.
- **Value cells:** three columns of 170 to 210px under a hairline. They never reflow while values update.
- **Charts:** two panels side by side. Left: temperature. Right: CO₂ above humidity, one shared time axis and one synced pointer. Charts are 340px high.

Responsive steps:
- **Below 1100px:** the charts stack; the state column moves below identity and lamp.
- **Below 640px:** the top bar wraps with 16px padding; page padding and gaps drop to 16px; the room panel pads 20px; the unit moves below the value.

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
- **State:** the CO₂ value takes the ink form of the current lamp colour. When the reading is outdated, all values turn muted slate.
- **Empty value:** an en dash.

### Freshness line
- **Live:** an 8px muted-slate dot, then "Stand 10:42 · vor 12 s".
- **Outdated (no reading for 5 minutes):** the dot becomes a 16px warning triangle in amber ink and the text turns ink: "Zuletzt 10:42". The status reads "Keine aktuellen Werte".

### Identity line and simulated data
- **Style:** 14px muted slate: "Sensorbox nili3 · gemessen".
- **Simulated:** the source word gets a dashed pill outline, and every chart line is dashed. Simulated values are never drawn as measurements.

### Chart panels
- **Container:** white panel, 14px corners, padding 22px 26px 12px.
- **Heading:** title on the left, time window in label style on the right.
- **Lines:** 2.2px, no symbols, gaps where readings are missing. Temperature and CO₂ are ink; humidity is muted steel blue.
- **CO₂ bands and limits:** the three lamp bands behind the CO₂ line, and dashed control-edge lines (3 on, 4 off) at 800 and 1000 ppm.
- **Axes and tooltip:** muted-slate labels, hairline grid, no ticks. The tooltip is a white panel with a hairline border; the pointer is a muted-slate line through both panels.
- **Notes:** "no values", loading and error notes in 14px slate below the chart.

### Empty and error panel
White panel, 56px by 36px padding, a 28px title and a slate paragraph of at most 60ch. It replaces the room panel and the charts for rooms without data and for load errors.

## Do's and Don'ts

### Do:
- **Do** show the air state as exactly one lit lamp plus one sentence from the fixed vocabulary (Luft gut, Bald lüften, Jetzt lüften / Air is fine, Air the room soon, Air the room now).
- **Do** use the CO₂ limits 800 and 1000 ppm everywhere a state colour appears.
- **Do** set every number in tabular Lexend and keep value cells at a fixed width.
- **Do** dash simulated data: the source tag outline and every chart line.
- **Do** show how current every value is, and mark outdated values in muted slate with the warning triangle.
- **Do** read chart colours from the CSS variables, so both schemes apply.

### Don't:
- **Don't** use green, amber or red for anything other than the air state: not for controls, links, the freshness dot or decoration.
- **Don't** add shadows to panels or controls; the lamp halo is the only shadow.
- **Don't** replace the lamp with a KPI tile, a gauge or a sparkline.
- **Don't** show a missing value as zero; show an en dash and a gap in the chart.
- **Don't** add a font weight beyond 400 and 700, or a second typeface.
