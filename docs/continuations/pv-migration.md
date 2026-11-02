# Continuation: PV-Neuaufbau, offener Rest (Stand 2026-11-02, abends)

Du setzt die Arbeit an der PV-Migration von LeoIoT für Daniel Lettner fort. Antworte auf Deutsch. Vorwissen aus früheren Chats hast du nicht; alles Nötige steht hier, im Repo und in den genannten Issues und PRs.

## Stand

Change-Übersicht: `openspec list`. User Stories: #55 (PV gesamt), #64 (Dashboard).

Erledigt, liegt grün in PRs. **Prüfe zuerst mit `gh pr view`, ob sie gemergt sind.** Merge-Befehle führt Daniel aus; die Berechtigungsprüfung lehnt `gh pr merge` für den Agenten ab, das nicht umgehen.

| PR | Inhalt | Danach |
|---|---|---|
| #131 | `Closes #122`: Kiosk-Panels begründet, Tasks Dashboard 5.5 und Kiosk 5.2 abgehakt | Worktree `leoiot-pv-kiosk-why` weg |
| #132 | `Closes #121`: `leoiot-pv/docs/market-analysis.md` | Worktree `leoiot-pv-market` weg, Link in #55 von „in review“ auf die Datei ändern |
| #133 | `Refs #129`: `/pv/` auf Doku-Seite und im README, Diagramm siehe unten | Worktree `leoiot-pv-docs` erst nach den SVGs weg |
| #135 | `Closes #134`: Rücksprung-Regel im Datenvertrag, `platform-pv-counter-stepback` archiviert | Worktree `leoiot-pv-stepback` weg |
| #136 | **Entwurf**, `Refs #128`: PV-Tab wird Link, SolaX-Login und `/solax/` raus | nicht mergen, siehe unten |

Der alte lokale Branch `docs/platform-pv-counter-stepback` ist ein Rest und hat nichts mit #135 zu tun.

## Offen, in dieser Reihenfolge

1. **Merges prüfen,** Worktrees und Branches aufräumen, Issue-Haken setzen.
2. **Diagramm (#133):** Die vier `src/assets/diagrams/architecture*.svg` sind nicht neu gerendert, die `.puml`-Quellen enthalten das Dashboard schon. Heruntergeladenes PlantUML auszuführen wurde dem Agenten verweigert, und auf dem Laptop fehlen Graphviz und ein laufendes Docker. Daniel rendert, oder er erlaubt es dem Agenten. Die SVGs sind vor dem Merge von #133 am besten im selben PR; sonst ein eigener. Erst danach `pv-dashboard` Task 8.1 abhaken.
3. **#119 Collector:** Diagnose steht in #119. Ursache ist wahrscheinlich nicht `.env`: Der Client gab nach einer Ablehnung durch den alten Broker am 2026-10-22 um 08:04:38 endgültig auf. Daniel führt den Neustart aus dem Issue aus. Danach einen Tag ohne Broker-Fehler abwarten, Collector-Task 5.3 abhaken, `pv-solax-collector` Task 6.4 übernehmen und archivieren. Eigenes Issue mit zwei Punkten vorschlagen: `reconnectOnConnackError: true` in `leoiot-pv/collector/src/adapters/broker.ts`, Hinweis auf falsch abgehakte Task 5.5 im Archiv `platform-broker`.
4. **#127 Abnahme** mit dem SolaX-Portal: Daniel und Stefan.
5. **#128 fertigstellen:** nach #127 das Sensoren-Team informieren und den Link in #136 eintragen (Task 7.3). `nginx -t` nachholen (Task 7.4); lokal gibt es weder nginx noch Docker. PR aus dem Entwurf nehmen, mergen, Release nach Ansage, Daniel installiert die nginx-Datei, dann Task 7.5 prüfen. Der Fehler aus #136 läuft bis dahin live weiter: `/dashboard/` lädt beim Start keine Daten.
6. **#129 Rest:** Nach #128 aus der Doku `/solax/` und die Hinweise auf den alten PV-Tab entfernen (`operations`, `architecture`, `project`, DE und EN, `leoiot-pv/README.md`). Spec nach `openspec/specs/pv/dashboard/spec.md` übernehmen, `pv-dashboard` archivieren, #64 mit Kommentar schließen.
7. **#120 Kiosk am Bildschirm:** Gespräch mit dem Lehrer; danach Kiosk-Task 5.1 und 6.5.
8. **#123 zweiter, kreativer Kiosk: der nächste große Schritt,** gemeinsam mit Daniel: `openspec-explore`, drei klickbare Vorschauen auf localhost, er wählt. Vorgaben: konservativ-klar statt experimentell, keine dichten Seitenleisten, Inhalte der entfernten Kiosks als Vorlage (Wetter, vermiedenes CO₂, Gesamtertrag, Batterie des Tages), am TV aus der Distanz lesbar.

Warten auf andere: Stefans SSH-Zugang (Daniel gibt die `.pub`-Datei; nach Ja an `~/.ssh/authorized_keys` von `solmqadmin` anhängen). Kubernetes (#55 Kriterium 5) wartet auf den Lehrer und #54. `platform-ci-build-context` 3.2 wartet auf das Archiv von `platform-cicd-pipeline`.

## Grenzen

- **Release nur nach Ansage:** Vor jedem PR `main` → `release` sagst du Daniel, was ausgeliefert wird, und wartest auf sein Ja.
- `legacy/` bleibt eingefroren; einzige Ausnahme ist #136.
- vm23 nur lesen. sudo macht Daniel: fertige Zeile mit `ssh -t solmqadmin@vm23.htl-leonding.ac.at '…'`.
- Zugangsdaten nie ausgeben, nie in Repo, Issue, Commit. `.env` nie lesen. `legacy/dashboard-v2/dashboard.js` enthält auf `main` noch Zugangsdaten im Klartext: nur maskiert oder mit gezieltem `grep -c` lesen.
- Teile anderer Teams nur ändern, wenn danach alles gleich funktioniert; vorher und nachher prüfen.
- Der Haupt-Checkout steht auf `feat/kiosk-rebuild` mit uncommitteten Änderungen: nicht anfassen.

## Arbeitsweise

- Zuerst `AGENTS.md`, `openspec/config.yaml`, `openspec/specs/README.md`. Vor der Arbeit der passende OpenSpec-Skill.
- Eigener Worktree je Aufgabe von `origin/main`. Branches `feat/`, `fix/`, `docs/`, `ci/`, `chore/`.
- Jede Arbeit hängt an einem Issue (Format wie #134, Unter-Issue über `POST /repos/…/issues/<n>/sub_issues`). Commits enden mit `Refs #n`, PRs enthalten `Closes #n`, Release-PRs `Part of #n`.
- Commits als `DLettner`, Conventional Commits, keine Co-Author-Zeile, nur gezielt `git add <Pfad>`. PR-Beschreibung endet mit „Generated with Claude Code“.
- Vor dem Push: `.github/ci/affected.sh origin/main HEAD` und die dort genannten Prüfungen.
- Fragen an Daniel über das Menü `AskUserQuestion`.
- Berichte ehrlich: Was nicht geprüft wurde, wird so genannt.

## vm23 und Prüfwerkzeuge

- `ssh solmqadmin@vm23.htl-leonding.ac.at -o BatchMode=yes '…'`, Optionen hinter dem Hostnamen. Checkout `~/2526-4ahitm-leoiot-dashboard`.
- Datenbank lesen ohne Token: Flux per `curl -s -X POST -H "Content-Type: application/vnd.flux" --data-binary @- http://127.0.0.1:8088/kiosk/api/query` auf vm23. Zeiten über die Zeitumstellung immer nach UTC sortieren.
- Screenshots: `playwright-core` in einem Scratch-Ordner, `chromium.launch({ executablePath })` mit `~/.cache/ms-playwright/chromium_headless_shell-1248/*/chrome-headless-shell`. Feste Uhr per `page.clock`; dann Chart-Animationen ausschalten, sonst bleiben die Diagramme leer.
- Der Docker-Daemon läuft auf dem Laptop nicht; `docker compose config` geht trotzdem.
