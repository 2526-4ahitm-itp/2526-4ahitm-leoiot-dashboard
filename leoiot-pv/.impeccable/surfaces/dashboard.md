---
version: 1
slug: "dashboard"
primary_target: "dashboard"
related_targets: []
---

# Surface brief: PV dashboard (`/pv/`)

Scope: `leoiot-pv/dashboard/`. Mode: Operate. Audience, job and states: `openspec/changes/pv-dashboard/specs/pv/dashboard/spec.md`. Visual system: documentation-site tokens plus kiosk data colours (PRODUCT.md, Brand Commitments). Preview chosen by Daniel on 2026-10-19: `/home/daniel/leoiot/previews/pv-dashboard/a-bericht/` (outside the repository); structure B (side rail archive) was rejected outright.

## Direction contract

THESIS: The period is told before it is charted: one or two plain sentences state what the plant produced, what the school used and how much did not come from the grid, and the chart proves the sentence. Refuses the KPI-tile wall with a chart underneath.

OWN-WORLD: White (dark: #0b0f14) ground, `--bg-soft` top bar with a hairline, system sans, large semibold lead type, tabular numerals; quantity colours `--c-pv`, `--c-verbrauch`, `--c-netz`, `--c-batterie`, outgoing flows hatched; standard segmented tabs, stepper, date input, table toggle.

STORY: A student opens a day or month, reads one sentence, knows the answer; points at a number and sees where it lives in the chart; opens the table when exact values are needed. Gaps are said in words, never shown as zero.

FIRST VIEWPORT: Top bar (brand, Tag/Woche/Monat/Jahr, stepper with date and Heute, DE/EN, theme). Below: lead sentence at clamp(24px, 2.7vw, 34px), weight 600, max ~38ch, with inline value chips; under it the live line for today; then the full-width chart with legend. Figures grid and ratios follow below the fold on desktop.

FORM: Plain-language report with linked value chips (signature move: hovering or focusing a chip highlights its series in the chart). Position 4 on my ordered list; seed key b4fad8c4.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
