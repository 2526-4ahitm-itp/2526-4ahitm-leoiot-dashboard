# Spec Delta

## MODIFIED Requirements

### Requirement: Desktop first, nothing breaks on a phone
The dashboard SHALL be laid out for desktop browsers from 1280 pixels width and SHALL remain fully usable down to 360 pixels width without horizontal scrolling of the page. In a browser window of at least 1280 × 720 CSS pixels, a room page with readings SHALL show the top bar, the room panel and all three charts without vertical scrolling, and the charts SHALL take the height the room panel leaves. In a lower window the charts SHALL keep a minimum readable height and the page SHALL scroll vertically.

#### Scenario: Laptop window
- **WHEN** a room page with readings is opened in a window of 1440 × 789 pixels at 100 % zoom
- **THEN** the top bar, the room panel and all three charts are visible and the page does not scroll

#### Scenario: Larger window
- **WHEN** the same room page is opened in a window of 1920 × 960 pixels
- **THEN** the charts are taller than in the 1440 × 789 window and the page does not scroll

#### Scenario: Low window
- **WHEN** a room page with readings is opened in a window of 1280 × 600 pixels
- **THEN** the charts keep their minimum height and the page scrolls vertically, not sideways

#### Scenario: Narrow window
- **WHEN** the dashboard is opened at 360 pixels width
- **THEN** room id, lamps, status, values and all three charts are shown one below the other and the page does not scroll sideways
