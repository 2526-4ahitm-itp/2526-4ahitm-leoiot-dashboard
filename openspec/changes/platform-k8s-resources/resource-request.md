# LeoIoT – Ressourcenbedarf

Stefan Schachner (Team PV-Dashboard) · Stand 2026-10-20 · Issue [#54](https://github.com/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard/issues/54)

## Was LeoIoT braucht

| Ressource | Garantiert | Maximal |
|---|---|---|
| CPU | 0,5 Kerne | 4 Kerne |
| Arbeitsspeicher | 1 GiB | 3 GiB |
| Speicher für Datenbank und Dienste | 27 GiB (davon Datenbank 25 GiB) | |
| Speicher für Backups, **auf einem anderen System** | 30 GiB, wächst auf ca. 100 GiB in 2 Jahren | |

Als einzelne VM entspricht das: **2 vCPU, 4 GiB RAM, 60 GB Festplatte**, plus Backup-Speicher auf einem anderen System.

## Wie die Zahlen zustande kommen

Gemessen am laufenden System auf vm23 am 2026-10-20:

| | Wert |
|---|---|
| Arbeitsspeicher aller Container | 0,77 GiB (von 3,8 GiB der VM) |
| CPU aller Container | unter 2 % eines Kerns |
| Datenbank | 5,6 GiB, Wachstum ca. 0,65 GiB pro Monat (Durchschnitt seit Jänner 2026) |
| Backups | 8 Stück, zusammen 18 GiB, auf derselben Platte wie die Datenbank |
| Festplatte der VM | 85 % belegt, 15 GiB frei |

- **CPU und RAM:** Im Alltag ist LeoIoT fast im Leerlauf. Das Maximum liegt bei mindestens dem 1,5-fachen des gemessenen Werts, damit Lastspitzen keinen Dienst abstürzen lassen.
- **Datenbank:** Messwerte werden ohne Ablaufdatum gespeichert. Geplant sind 2 Jahre: 5,6 GiB + 24 × 0,65 GiB + 20 % Reserve ≈ 25 GiB.
- **Backups:** 11 Sicherungen à derzeit ca. 2,3 GiB. Mit der Datenbank wachsen auch die Sicherungen.

## Backup-Konzept

- **Was:** die komplette Datenbank (Messwerte, Benutzer, Zugangs-Tokens). Alles andere wird aus dem Git-Repository neu erzeugt.
- **Wie oft:** täglich, automatisch. Im schlimmsten Fall geht ein Tag an Daten verloren, bisher war es eine Woche.
- **Wo:** auf einem anderen System als die Datenbank. Bisher liegen die Sicherungen auf derselben Platte und würden bei einem Ausfall mit verloren gehen.
- **Wie lange:** die letzten 7 Tage und 4 Wochen (11 Sicherungen).
- **Wiederherstellung:** am 2026-10-20 erfolgreich getestet (Details in `restore-test.md`).

## Offene Fragen an die Schule

1. Läuft LeoIoT künftig in einem Kubernetes-Cluster oder weiter auf einer VM?
2. Wo können die Backups außerhalb der VM bzw. des Clusters liegen?
3. Wer verwahrt eine Kopie der Zugangsdaten?

Technische Details pro Dienst: `design.md`.
