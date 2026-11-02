# Market analysis: PV dashboards

Status 2026-11-02. Compares three vendor portals and one public-display product with the LeoIoT kiosk and dashboard, as asked for in #55. The sources are vendor pages and documentation read on that date. Nobody on the team tested these products with an account, so this describes what the vendors state, not what the products do in use. Feature lists change, and marketing pages say more than they prove.

## What they show and for whom

| Product | Made for | Shows | Public view |
|---|---|---|---|
| **SolaX Cloud** [1] | home owners, commercial energy managers, installers and asset managers | PV generation, household consumption, battery status, grid export, eco and economic figures, custom-date statistics, report export, tariff scheduling, device control | none described; users can turn selected figures into images for social media |
| **SMA Sunny Portal powered by ennexOS** [2][3] | system owners and operators, installers, professionals managing several systems | dashboard with live status, energy flows, device status and yield; real-time energy balance with forecasts and prices; fault analysis in 5-minute resolution; tariffs and consumer priorities; reports and alerts; Cloud API | selected pages can be released, sent by email, linked or embedded in a website (documented for Sunny Home Manager; not confirmed for ennexOS) |
| **Fronius Solar.web** [4][5] | system owners and installers | real-time system data, yield and consumption analysis, service messages, remote inverter settings; Premium adds simulations of added storage | Public Display: a web page for large screens, Premium only, one system, cannot show other content; Solar.TV is no longer developed |
| **Solarfox** [6] | not stated on the page; the vendor also lists public displays and a school package | a slideshow of performance, yield, power and consumption, taken from the portal of the plant | this is its purpose: a display placed anywhere with an internet connection |

## What they have in common

The three portals are built for whoever owns, runs or services a system. They answer "does my system work, and how do I get more out of it?": faults, device status, tariffs, control, several plants in one account. They sit behind a login. Showing a system to the public is an add-on, and in Fronius' case a paid one. Solarfox covers the public screen, but as a separate product that shows the data of a portal.

## What ours does differently

- **Made for people who do not own the system.** The audience is students, teachers and visitors. Each view states one question and its audience (`openspec/specs/pv/`, change `pv-dashboard` and `pv-main-kiosk`), and neither surface has fault lists, device settings or tariffs.
- **Two surfaces with separate jobs.** The kiosk shows now and today on a TV, read from a distance, without operation. The dashboard is for looking things up on one's own device. No compared product states this split; Fronius and Solarfox offer a public screen, but next to an owner's portal.
- **No login.** `/pv/` and `/kiosk/` open directly. The vendor portals' main views need an account.
- **One definition of every number.** Self-consumption and consumption are computed the same way in every panel and view, the names and colours are the same, and the dashboard explains each one in German and English with its formula.
- **Honest about gaps.** Missing values are shown as unknown and never as zero, old data is marked as old, and a period shows how complete it is. No savings or CO₂ figures are invented; SolaX in contrast advertises eco and economic metrics, whose basis we did not check.
- **Runs inside the school network.** Nothing is loaded from foreign servers at run time, and the readings are stored on the school's own server.

## Where the others are ahead

This is not a replacement for a vendor portal, and it does not try to be.

- The data comes from SolaX Cloud: the collector reads its API once a minute, so we depend on it, and if it fails we have no readings.
- No alerts, no fault analysis, no device control, no forecasts, no tariffs and no money figures.
- One plant only.
- The SolaX portal stays the reference: our numbers are compared against it (#127).

## Sources

All read on 2026-11-02.

1. SolaX Power, "SolaXCloud energy management software": <https://www.solaxpower.com/blogs/solaxcloud-energy-management-software.html>
2. SMA, "Sunny Portal powered by ennexOS" (Benelux product page): <https://www.sma-benelux.com/producten/apps-digitale-producten/sunny-portal-ennexos>
3. SMA, Sunny Home Manager 2.0 manual, "Releasing and publishing pages": <https://manuals.sma.de/HM-20/en-US/7917876235.html>
4. Fronius, "PV system monitoring: Solar.web": <https://www.fronius.com/en-us/usa/solar-energy/installers-partners/products-solutions/monitoring-digital-tools/pv-system-monitoring-solarweb>
5. Fronius, Solar.web FAQ (Spanish, source for Public Display and Solar.TV): <https://www.fronius.com/es/faq-online-tools/faq-solar-energy/solarweb>
6. Solarfox, "Fronius Inverter / Fronius Monitoring": <https://www.solar-fox.com/en/fronius.html>
