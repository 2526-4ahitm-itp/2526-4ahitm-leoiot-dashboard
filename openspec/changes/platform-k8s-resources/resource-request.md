# LeoIoT – Ressourcenbedarf

Stefan Schachner (Team PV-Dashboard) · Stand 2026-10-20 · Issue [#54](https://github.com/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard/issues/54)

## Was LeoIoT braucht

> **2 CPU-Kerne · 4 GB RAM · 60 GB Festplatte**
>
> **+ Backup-Speicher auf einem anderen System: 30 GB, wächst auf ca. 100 GB in 2 Jahren**

> ⚠️ **vm23 heute:** Die Festplatte ist zu **85 % voll** (15 GB frei). Die Backups (18 GB) liegen auf derselben Platte wie die Datenbank: Fällt die Platte aus, sind auch alle Backups weg.

Falls LeoIoT in einen Kubernetes-Cluster umzieht, entspricht das:

| Ressource | Immer reserviert | Höchstens |
|---|---|---|
| CPU | 0,5 Kerne | 4 Kerne |
| Arbeitsspeicher | 1 GB | 3 GB |
| Speicher im Cluster | 27 GB (davon Datenbank 25 GB) | |
| Backups außerhalb des Clusters | wie oben | |

## Wie die Zahlen zustande kommen

Gemessen am laufenden System auf vm23 am 2026-10-20:

| | Wert |
|---|---|
| Arbeitsspeicher aller Container | 0,77 GB (von 3,8 GB der VM) |
| CPU aller Container | unter 2 % eines Kerns |
| Datenbank | 5,6 GB, Wachstum ca. 0,65 GB pro Monat (Durchschnitt seit Jänner 2026) |
| Backups | 8 Stück, zusammen 18 GB, auf derselben Platte wie die Datenbank |
| Festplatte der VM | 85 % belegt, 15 GB frei |

- **CPU und RAM:** Im Alltag ist LeoIoT fast im Leerlauf. Das Maximum liegt bei mindestens dem 1,5-fachen des gemessenen Werts, damit Lastspitzen keinen Dienst abstürzen lassen.
- **Datenbank:** Messwerte werden ohne Ablaufdatum gespeichert. Geplant sind 2 Jahre: 5,6 GB + 24 × 0,65 GB + 20 % Reserve ≈ 25 GB.
- **Backups:** 11 Sicherungen à derzeit ca. 2,3 GB. Mit der Datenbank wachsen auch die Sicherungen.

## Backup-Konzept

- **Was:** die komplette Datenbank (Messwerte, Benutzer, Zugangs-Tokens). Alles andere wird aus dem Git-Repository neu erzeugt.
- **Wie oft:** täglich, automatisch. Im schlimmsten Fall geht ein Tag an Daten verloren, bisher war es eine Woche.
- **Wo:** auf einem anderen System als die Datenbank. Bisher liegen die Sicherungen auf derselben Platte und würden bei einem Ausfall mit verloren gehen.
- **Wie lange:** die letzten 7 Tage und 4 Wochen (11 Sicherungen).
- **Wiederherstellung:** am 2026-10-20 mit Testdaten erfolgreich getestet (Details in `restore-test.md`).

## Offene Fragen an die Schule

1. Läuft LeoIoT künftig in einem Kubernetes-Cluster oder weiter auf einer VM?
2. Wo können die Backups außerhalb der VM bzw. des Clusters liegen?
3. Wer verwahrt eine Kopie der Zugangsdaten?

Technische Details pro Dienst: `design.md`.
