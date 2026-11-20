# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: History is shown in two charts`
- TO: `### Requirement: History is shown in three charts`

## MODIFIED Requirements

### Requirement: History is shown in three charts
The dashboard SHALL show the history in three charts, each in its own box: CO₂, temperature and humidity, each with its own scale and on the same time range. On desktop the CO₂ chart SHALL take the left half at the full height of the chart area, and the temperature chart and, below it, the humidity chart SHALL share the right half. The CO₂ chart SHALL mark the ranges below 800, from 800 to 1000 and above 1000 ppm in the colours of the lamps. Pointing at a time in any chart SHALL show the values at that time in every chart. A time without readings SHALL be shown as a gap, never as zero.

#### Scenario: Pointing at a time
- **WHEN** a visitor points at 9:30 in the temperature chart
- **THEN** all three charts mark 9:30 and the values at 9:30 are shown

#### Scenario: Gap in the readings
- **WHEN** the box delivered nothing between 2:00 and 3:00
- **THEN** every chart shows a gap between 2:00 and 3:00

#### Scenario: Layout on a desktop
- **WHEN** the dashboard is opened at 1440 pixels width
- **THEN** the CO₂ chart is on the left at the full height of the chart area, and the temperature chart is on the right above the humidity chart
