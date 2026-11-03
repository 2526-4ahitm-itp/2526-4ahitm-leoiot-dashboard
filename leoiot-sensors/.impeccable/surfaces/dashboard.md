---
version: 1
slug: "dashboard"
primary_target: "dashboard"
related_targets: []
---

# Surface brief: room-climate dashboard

Scope: `leoiot-sensors/dashboard/` (planned; first try shows room 105 only). Mode: Operate. Audience and product truth: `leoiot-sensors/PRODUCT.md`. Direction chosen by Elias Pointinger on 2026-10-23 (Classroom Air Light, the roll); the alternative "The School Day" (lesson grid as time axis) was not taken.

Job: anyone at the school sees within seconds whether the air in a room is fine now, how current the values are, and how temperature, CO₂ and humidity developed over the last 24 hours or 7 days. Charts: temperature alone; CO₂ and humidity as two panels on one shared time axis with a synced pointer. Ranges: 24 h (default) and 7 days. States that matter: live, outdated (no reading for 5 minutes), no data, simulated.

Open: URL path, room selection once more rooms have real data, the sensor overview (the split-flap board's fixed-cell rows fit it).

## Direction contract

THESIS: The room's air state is a lit lamp, not a number to interpret: one of three lamps is lit and one sentence says what to do; the charts carry the same lamp bands. Refuses the KPI-tile wall with sparklines.

OWN-WORLD: Cool matte housing grey ground, white panels, near-black ink; a dark lamp housing with three round lamps (green, amber, red), unlit lamps dark grey; Atkinson Hyperlegible Next, tabular numerals; colour appears only as air state; controls neutral.

STORY: A visitor opens room 105, reads the lit lamp and the status line (Luft gut, Bald lüften, Jetzt lüften), checks the values and their age, then reads the day or week in the charts, where the bands show when the air crossed 800 and 1000 ppm.

FIRST VIEWPORT: Top bar (brand, room, 24 h / 7 Tage, DE/EN, theme). Room panel: room id at about 128px, lamp housing, status line at about 44px, three fixed value cells, freshness line. Below, two chart panels side by side: temperature; CO₂ above humidity.

FORM: Classroom CO₂ traffic light with raises: fixed cells that change in place (split-flap), colour only for state (warm app), one message per line (terminal yellow), strict state vocabulary (acetate manual), fixed identity furniture (character catalog), exact time windows (j-card). Position 7 on my ordered list; seed:b4dbcad7698bbcf1

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
