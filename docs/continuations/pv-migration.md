# Continuation: Spec für den zweiten, kreativen PV-Kiosk (Stand 2026-11-02, abends)

Du arbeitest mit Daniel Lettner an LeoIoT. Antworte auf Deutsch. Vorwissen aus früheren Chats hast du nicht; alles Nötige steht hier, im Repo und in den genannten Issues.

## Auftrag

**Schreibe gemeinsam mit Daniel die Spec für den zweiten, kreativen Kiosk (#123, Teil von #55 Kriterium 4).** Daniel entscheidet mit, das ist ausdrücklich kein Alleingang: Du baust in dieser Sitzung nichts am Kiosk, bevor die Spec steht und er sie freigegeben hat.

Ablauf:

1. Skill `openspec-explore`: gemeinsam klären, was der Kiosk sein soll. Fragen nacheinander über das Menü `AskUserQuestion`, Vorschlag als erste Option mit „(Empfohlen)“, kurze Begründung dazu.
2. Wenn Daniel Beispiele braucht, drei klickbare Vorschauen auf localhost mit Beispieldaten, per `python3 -m http.server` in `/home/daniel/leoiot/previews/`; er wählt. Keine Karten mit Farbchips oder Textbeschreibungen.
3. Skill `openspec-propose`: Change `pv-…` im eigenen Worktree von `origin/main`, gebunden an #123. `openspec validate <change> --strict`, dann PR.

## Vorgaben von Daniel

- Konservativ-klar statt experimentell, dezente Animation, keine dichten Seitenleisten, luftig mit einer klaren Aussage oben.
- Soll aus dem Vorbeigehen auffallen (#123, #55: „creative and not boring“) und am TV aus der Distanz lesbar bleiben.
- Inhalte der entfernten Kiosks als Vorlage, soweit noch gewünscht: Wetter, vermiedenes CO₂, Gesamtertrag, Batterie des Tages.

## Was die Spec klären muss

- **Eigene Adresse.** Der Hauptkiosk bleibt unter `/kiosk/`. Eine neue Adresse braucht einen Eintrag in `leoiot-platform/proxy/nginx.conf`, in `.github/ci/smoke-routes` und einen eigenen Port, also auch Daniels Schritt auf vm23.
- **Frage und Zielgruppe je Ansicht**, wie „Four panels with one question each“ in `pv-main-kiosk`. Abgrenzung zum Hauptkiosk und zum Dashboard: `leoiot-pv/PRODUCT.md`.
- **Daten. Vertrag zuerst:** Es gilt `openspec/specs/platform/data-contract/spec.md`. Gesamtertrag (`total_yield`) und Batterie des Tages (`daily_charged`, `daily_discharged`) sind da, ein Ladestand steht nicht im Vertrag. Wetter steht nicht im Vertrag und braucht vorher einen `platform-…`-Change; außerdem darf der Kiosk zur Laufzeit nichts von fremden Servern laden.
- **Vermiedenes CO₂:** `PRODUCT.md` sagt, es gibt keinen belegten CO₂-Faktor und es wird keiner erfunden. Daniel muss eine belegte Quelle wählen oder den Wert streichen.
- **Technik:** eigene App neben `leoiot-pv/kiosk/`, gemeinsames Paket `leoiot-pv/shared` (Definitionen aller Größen), Farben und Namen wie im Hauptkiosk, keine Zugangsdaten im Browser, Anzeige ab 1280 × 720 ohne Scrollen.

Die alten Kiosks wurden in `e16f393` entfernt, lesbar mit `git show e16f393^:legacy/kiosk4/kiosk4.js`. Sie können Zugangsdaten im Klartext enthalten: nur maskiert oder gezielt per `grep` lesen und nie ausgeben. Alte Logik wird neu spezifiziert, nie kopiert. Die Marktanalyse `leoiot-pv/docs/market-analysis.md` nennt Solarfox als vergleichbare öffentliche Anzeige.

## Daneben offen, nicht Teil dieser Sitzung

- **#119:** Der Collector ist seit 2026-11-02 18:30 UTC wieder am Broker. Ab 2026-11-03 18:30 UTC Kriterium 3 prüfen (`docker logs --since 24h` ohne `Broker nicht erreichbar` und ohne `MQTT-Fehler`). Dann Collector-Task 5.3 abhaken, `pv-solax-collector` Task 6.4 übernehmen und archivieren. Eigenes Issue vorschlagen: `reconnectOnConnackError: true` in `leoiot-pv/collector/src/adapters/broker.ts`; Task 5.5 im Archiv `platform-broker` ist zu Unrecht abgehakt.
- **#127** Abnahme mit dem SolaX-Portal: Daniel und Stefan.
- **#128, Entwurf #136:** nach #127 das Sensoren-Team informieren (Task 7.3), `nginx -t` nachholen (Task 7.4), mergen, Release nach Ansage, Daniel installiert die nginx-Datei, Task 7.5. Bis dahin lädt `/dashboard/` beim Start keine Daten.
- **#129 Rest:** nach #128 `/solax/` und den alten PV-Tab aus der Doku nehmen, Spec nach `openspec/specs/pv/dashboard/spec.md`, `pv-dashboard` archivieren, #64 schließen.
- **#120:** Kiosk am Bildschirm, Gespräch mit dem Lehrer; danach Kiosk-Tasks 5.1 und 6.5.
- Warten auf andere: Stefans SSH-Zugang, Kubernetes (#54), `platform-ci-build-context` 3.2.

## Grenzen und Arbeitsweise

- Zuerst `AGENTS.md`, `openspec/config.yaml`, `openspec/specs/README.md` lesen.
- Eigener Worktree je Aufgabe von `origin/main`. Der Haupt-Checkout steht auf `feat/kiosk-rebuild` mit uncommitteten Änderungen: nicht anfassen. Die Worktrees `wt-pv-*` sind alt und nicht von dieser Arbeit.
- Jede Arbeit hängt an einem Issue. Commits als `DLettner`, Conventional Commits, Ende `Refs #n`, keine Co-Author-Zeile, nur gezielt `git add <Pfad>`. PRs enthalten `Closes #n` und enden mit „Generated with Claude Code“.
- `gh pr merge` wird dem Agenten verweigert: nicht umgehen, Daniel führt `! gh pr merge <n> --merge` aus. Dasselbe gilt für heruntergeladene Programme wie PlantUML.
- Release nur nach Ansage. vm23 nur lesen, sudo macht Daniel. `.env` nie lesen, Zugangsdaten nie ausgeben.
- Berichte ehrlich: Was nicht geprüft wurde, wird so genannt.

## Werkzeuge

- vm23: `ssh solmqadmin@vm23.htl-leonding.ac.at -o BatchMode=yes '…'`. Datenbank lesen ohne Token: Flux per `curl -s -X POST -H "Content-Type: application/vnd.flux" --data-binary @- http://127.0.0.1:8088/kiosk/api/query` auf vm23.
- Screenshots: `playwright-core` in einem Scratch-Ordner, `chromium.launch({ executablePath })` mit `~/.cache/ms-playwright/chromium_headless_shell-1248/*/chrome-headless-shell`. Bei fester Uhr Chart-Animationen ausschalten.
- Docker startet Daniel mit `sudo systemctl start docker`.
