# Continuation: PV-Neuaufbau abschließen (Stand 2026-11-02)

Du setzt die Arbeit an der PV-Migration von LeoIoT für Daniel Lettner fort. Antworte auf Deutsch. Vorwissen aus früheren Chats hast du nicht; alles Nötige steht hier, im Repo und in den genannten Issues.

## Auftrag

**Erledige selbständig so viel wie möglich von der Liste „Allein machbar“.** Frag nur, wenn du wirklich nicht weiterkommst. Was Daniel, Stefan oder der Lehrer tun müssen, bereitest du so weit vor, dass nur noch ihr Schritt fehlt, und sammelst es für den Abschlussbericht. Den **zweiten, kreativen Kiosk (#123) fängst du nicht an**: Den macht Daniel danach gemeinsam mit dir in einem eigenen Durchgang.

## Stand

Change-Übersicht: `openspec list` im Repo. User Stories: #55 (PV gesamt) und #64 (Dashboard), jeweils mit Unter-Issues und einem Stand-Kommentar vom 2026-11-02.

- Live auf vm23: Collector (`leoiot-pv/collector`), Hauptkiosk `/kiosk/`, PV-Dashboard `/pv/`, gemeinsames Paket `leoiot-pv/shared`. `main` und `release` waren am 2026-11-02 gleich.
- Das alte Dashboard `/dashboard/` (`legacy/dashboard-v2`) hat noch seinen PV-Tab und liefert das SolaX-Login an den Browser, bis #128 erledigt ist.

## Allein machbar, in dieser Reihenfolge

1. **Abhaken:** `pv-dashboard` Task 5.5 (ausgeliefert mit #93, #95) und `pv-main-kiosk` Task 5.2 (auf vm23 am 2026-11-02: Neustarts 0, healthy, seit 2026-10-20). Vorher lesend bestätigen.
2. **#122 Kiosk-Ansichten begründen:** Im Spec-Delta von `pv-main-kiosk` für Heute, Wochenübersicht, Leistung und Energiefluss je Frage und Zielgruppe ergänzen, wie im Requirement „Four views with one question each“ von `pv-dashboard`. Zielgruppen und Abgrenzung stehen in `leoiot-pv/PRODUCT.md`. `openspec validate pv-main-kiosk --strict`.
3. **#121 Marktanalyse:** Mindestens drei bestehende PV-Dashboards vergleichen (zum Beispiel SolaX Cloud, SMA Sunny Portal, Fronius Solar.web), was sie zeigen und für wen, und benennen, was unseres anders macht. Quellen belegen, nichts erfinden. Ablage: `leoiot-pv/docs/market-analysis.md`, englisch, kurz; in #55 verlinken.
4. **#129 Doku, erster Teil:** `pv-dashboard` Task 8.1: `/pv/` auf der Doku-Seite (`architecture`, `setup`, `operations`, `interfaces`, `project`, je DE und EN, Architekturdiagramm) und in `leoiot-pv/README.md` nennen; der Abschnitt „Still in the previous system“ dort ist veraltet. Der Dashboard-Abschnitt nennt `/pv/` als aktuelle Adresse; dass der alte PV-Tab noch existiert, bleibt bis #128 erwähnt. `npm ci && npm run build` an der Wurzel. Die übrigen Punkte von #129 warten auf #128.
5. **#119 Broker-Zugang, Diagnose:** Seit 2026-10-22 meldet der Collector `Connection refused: Not authorized`. Lesend klären: Broker-Log von `leoiot-platform-mosquitto-1`, welche Benutzernamen `leoiot-platform/broker` erwartet (Doku und Compose, keine Passwörter), und welcher **Name** der Variablen in `leoiot-pv/.env` gesetzt ist, nie ihr Wert. Ergebnis als Kommentar in #119 mit der genauen Anweisung für Daniel. `.env` nicht ändern. Das Archiv `platform-broker` enthält die Übergabe, Task 5.5 dort ist abgehakt, obwohl der Collector nicht verbunden ist.
6. **`platform-pv-counter-stepback`:** Tasks 1.1, 1.2, 2.1 umsetzen. Für 1.1 nicht den Lesetoken anfassen, sondern lesend über den Kiosk-Proxy abfragen (siehe „vm23“). Spec nach `openspec/specs/platform/data-contract/spec.md` übernehmen, archivieren.
7. **#128 vorbereiten, nicht ausliefern:** `pv-dashboard` Gruppe 7 als **Entwurfs-PR** (`gh pr create --draft`) bauen: PV-Tab in `legacy/dashboard-v2` wird Link auf `/pv/`, PV-Ansicht samt SolaX-Login raus, `/solax/` aus `leoiot-platform/proxy/nginx.conf` raus (die nginx-Datei liegt seit `platform-broker` dort, `legacy/deploy/nginx.conf` ist nicht mehr die Quelle; die Tasks 5.1, 7.4 nennen noch den alten Pfad, korrigieren). Sensor-Ansicht vorher und nachher vergleichen (Task 7.1). **Nicht mergen:** Das wartet auf die Abnahme #127, und das Sensoren-Team wird vorher informiert (Task 7.3).

Nach jedem Punkt: geprüft, PR, grünes CI, mergen, Issue-Haken setzen, Worktree weg.

## Nicht allein machbar: nur vorbereiten und berichten

- #119 Zugangsdaten setzen: Daniel, auf vm23. Danach Collector-Task 5.3 abhaken, `pv-solax-collector` Task 6.4 übernehmen und archivieren.
- #127 Abnahme mit dem SolaX-Portal: Daniel und Stefan.
- #120 Kiosk am Bildschirm: Gespräch mit dem Lehrer; danach Kiosk 6.5.
- Stefans SSH-Zugang: Daniel gibt seine `.pub`-Datei; nach Ja an `~/.ssh/authorized_keys` von `solmqadmin` anhängen.
- Kubernetes (#55 Kriterium 5): wartet auf den Lehrer und #54. Kein eigenes Issue nötig, bis der Cluster feststeht.
- `platform-ci-build-context` 3.2: wartet auf das Archiv von `platform-cicd-pipeline` (Task 9.1, Sache des Plattform-Teams).

## Grenzen

- **Release nur nach Ansage:** Vor jedem PR `main` → `release` sagst du Daniel, was ausgeliefert wird, und wartest auf sein Ja. Änderungen nur an Doku-Seite und Specs brauchen keinen Release; die Doku-Seite geht beim Push auf `main` raus.
- `legacy/` bleibt eingefroren. Einzige Ausnahme ist der Entwurfs-PR für #128.
- vm23 nur lesen. sudo macht Daniel: fertige Zeile mit `ssh -t solmqadmin@vm23.htl-leonding.ac.at '…'` hinschreiben.
- Zugangsdaten nie ausgeben, nie in Repo, Issue, Commit. `.env` nie lesen. `legacy/dashboard-v2/dashboard.js` enthält Zugangsdaten im Klartext: nicht ins Terminal ausgeben (kein `head` auf die Datei), gezielt `grep -c` oder `sed` mit Zeilenfiltern nutzen.
- Teile anderer Teams nur ändern, wenn danach alles gleich funktioniert; vorher und nachher prüfen. Elias muss PV-Änderungen nicht freigeben, bei Dateien anderer Teams wird er informiert.
- Der Haupt-Checkout steht auf `feat/kiosk-rebuild` mit uncommitteten Änderungen: nicht anfassen.

## Arbeitsweise

- Zuerst `AGENTS.md`, `openspec/config.yaml`, `openspec/specs/README.md` lesen. Vor der Arbeit der passende OpenSpec-Skill: `openspec-apply-change`, `openspec-propose`, `openspec-update-change`.
- Eigener Worktree je Aufgabe von `origin/main`, nach dem Merge entfernen. Branches `feat/`, `fix/`, `docs/`, `ci/`, `chore/`.
- **Jede Arbeit hängt an einem Issue:** Fehlt eines, zuerst anlegen (Format wie #127: User Story, Akzeptanzkriterien, Labels `User Story`, `leoiot-pv`, `Size: …`, als Unter-Issue von #55 oder #64 über `POST /repos/…/issues/<n>/sub_issues`). Commits enden mit `Refs #n`, PRs enthalten `Closes #n`, Release-PRs `Part of #n`.
- Commits als `DLettner`, Conventional Commits, keine Co-Author-Zeile, nur gezielt `git add <Pfad>`. PR-Beschreibung endet mit „Generated with Claude Code“. Merge: `gh pr merge --merge`.
- Vor dem Push: `.github/ci/affected.sh origin/main HEAD` und die dort genannten Prüfungen. Größere Code-Arbeit über Sonnet-Subagents nach genauem Plan, Diffs und Screenshots selbst prüfen.
- Fragen an Daniel über das Menü `AskUserQuestion`, nicht als Text.
- Berichte ehrlich: Was nicht geprüft wurde, wird so genannt.

## vm23

- `ssh solmqadmin@vm23.htl-leonding.ac.at -o BatchMode=yes '…'`, Optionen hinter dem Hostnamen. Checkout `~/2526-4ahitm-leoiot-dashboard`, Deploy-Marke `~/.leoiot-deployed-sha`.
- Datenbank lesen ohne Token: Flux per `curl -s -X POST -H "Content-Type: application/vnd.flux" --data-binary @- http://127.0.0.1:8088/kiosk/api/query` auf vm23; der nginx des Kiosks hängt den Lesetoken selbst an. Auf vm23 gibt es kein Node.
- Screenshots: `playwright-core` in einem Scratch-Ordner installieren, `chromium.launch({ executablePath })` mit `~/.cache/ms-playwright/chromium_headless_shell-1248/*/chrome-headless-shell`. Feste Uhr per `page.clock`, weil die Abfragen ihre Zeitspanne aus dem Browser nehmen.
- Für lokale Tests eine Wegwerf-InfluxDB: Testdaten erzeugt `leoiot-pv/shared/tests/fixtures/generate-line-protocol.mjs`, Container danach entfernen.

## Abschluss

Wenn alles Machbare erledigt ist:

1. Diese Datei ersetzen: nur noch den offenen Rest und den Stand. `#123` wird dort als nächster Schritt genannt.
2. Daniel kurz berichten: was erledigt ist, was er selbst tun muss (mit fertigen Befehlen), was als Entwurf wartet, ob ein Release nötig ist und was er enthielte.
3. Danach kommt mit Daniel der kreative zweite Kiosk (#123): `openspec-explore`, drei klickbare Vorschauen auf localhost, er wählt. Vorgaben: konservativ-klar statt experimentell, keine dichten Seitenleisten, Inhalte der entfernten Kiosks als Vorlage (Wetter, vermiedenes CO₂, Gesamtertrag, Batterie des Tages), am TV aus der Distanz lesbar.
