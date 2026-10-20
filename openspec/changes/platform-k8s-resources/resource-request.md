# LeoIoT – Ressourcenbedarf und Backup-Konzept

**Ressourcenanfrage für den Betrieb von LeoIoT an der HTL Leonding**

| | |
|---|---|
| Projekt | LeoIoT (Raumklima, PV-Anlage, 3D-Gebäudemodell) |
| Issue | [#54 – Estimate Kubernetes resources and backup concept](https://github.com/2526-4ahitm-itp/2526-4ahitm-leoiot-dashboard/issues/54) |
| Erstellt von | Stefan Schachner (Team PV-Dashboard) |
| Stand | 2026-10-20 – **vorläufig**: Werte mit *Schätzung* werden durch die Messung auf vm23 ersetzt (Abschnitt 6) |
| Technische Details | `design.md` im selben Ordner |

## 1. Kurzfassung: Was wir brauchen

| Ressource | Garantiert (Request) | Maximal (Limit) | Quelle |
|---|---|---|---|
| CPU | **1 Kern** (Summe 0,55) | **4 Kerne** (Summe 3,7) | Schätzung + lokale Messung |
| Arbeitsspeicher | **1,5 GiB** (Summe 1,2 GiB) | **3 GiB** (Summe 2,6 GiB) | Schätzung + lokale Messung |
| Speicher im Cluster | **12 GiB** | | Schätzung (Datenbank 10 GiB, Broker 1 GiB, Grafana 1 GiB) |
| Backup-Speicher außerhalb des Clusters | **25 GiB** | | Schätzung (11 Sicherungen) |

**Garantiert** heißt: Diese Menge ist für LeoIoT immer reserviert. **Maximal** heißt: Mehr darf LeoIoT auch unter Last nicht verbrauchen. Im Normalbetrieb liegt der Verbrauch nahe am garantierten Wert, weil alle Dienste die meiste Zeit kaum etwas zu tun haben.

**Falls LeoIoT weiterhin auf einer einzelnen VM statt in Kubernetes läuft**, entspricht das ungefähr: **2 vCPU, 4 GiB RAM, 40 GB Festplatte** (Betriebssystem und Docker ca. 10 GB, Container-Images ca. 3 GB, Datenbank 10 GB, Reserve) – plus Backup-Speicher auf einem anderen System.

## 2. Was läuft

| # | Dienst | Aufgabe | Team |
|---|---|---|---|
| 1 | MQTT-Broker (Mosquitto) | nimmt die Messwerte der Sensoren und der PV-Anlage entgegen und verteilt sie | Plattform |
| 2 | Datenbank (InfluxDB 2.7) | speichert alle Messwerte dauerhaft | Plattform |
| 3 | Telegraf | schreibt Sensorwerte vom Broker in die Datenbank | Plattform |
| 4 | WebSocket-Bridge | schickt Live-Werte an die Browser | Plattform |
| 5 | Grafana | Auswertungs-Dashboards (falls es bleibt) | Plattform |
| 6 | PV-Collector | holt jede Minute die Werte der PV-Anlage aus der SolaX-Cloud | PV |
| 7 | PV-Kiosk | Anzeige auf den Bildschirmen im Haus (`/kiosk/`) | PV |
| 8 | PV-Dashboard | PV-Auswertung im Browser (`/pv/`) | PV |
| 9 | Sensor-Dienst | Raumklima-Daten (CO₂, Temperatur) | Sensoren |
| 10 | 3D-Gebäudemodell | Startseite mit Navigation (`/`) | 3D |
| 11 | Backup-Job | sichert die Datenbank einmal täglich (läuft nur wenige Minuten) | Plattform |

Nicht mitgerechnet: der Ingress bzw. Reverse Proxy (stellt der Cluster bereit) und die Testdaten-Generatoren des alten Systems.

## 3. CPU und Arbeitsspeicher pro Dienst

1000 m = 1 CPU-Kern.

| # | Dienst | CPU garantiert | CPU maximal | RAM garantiert | RAM maximal | Grundlage |
|---|---|---|---|---|---|---|
| 1 | MQTT-Broker | 10 m | 200 m | 32 MiB | 128 MiB | lokal gemessen: 4 MiB |
| 2 | Datenbank | 250 m | 1000 m | 512 MiB | 1024 MiB | lokal gemessen (leer): 209 MiB; *Schätzung* mit Daten |
| 3 | Telegraf | 20 m | 200 m | 64 MiB | 128 MiB | *Schätzung* |
| 4 | WebSocket-Bridge | 20 m | 200 m | 64 MiB | 256 MiB | *Schätzung* |
| 5 | Grafana | 50 m | 500 m | 128 MiB | 256 MiB | *Schätzung* |
| 6 | PV-Collector | 20 m | 200 m | 64 MiB | 128 MiB | *Schätzung* |
| 7 | PV-Kiosk | 10 m | 100 m | 32 MiB | 64 MiB | lokal gemessen: 10 MiB |
| 8 | PV-Dashboard | 10 m | 100 m | 32 MiB | 64 MiB | lokal gemessen: 10 MiB |
| 9 | Sensor-Dienst | 50 m | 500 m | 128 MiB | 256 MiB | *Schätzung*, noch nicht gebaut |
| 10 | 3D-Gebäudemodell | 10 m | 200 m | 32 MiB | 64 MiB | *Schätzung*, wie Kiosk |
| 11 | Backup-Job | 100 m | 500 m | 128 MiB | 256 MiB | *Schätzung* |
| | **Summe** | **550 m** | **3700 m** | **1216 MiB** | **2624 MiB** | |

Regel für die Werte: Der garantierte RAM entspricht dem üblichen Verbrauch, das Maximum mindestens dem 1,5-fachen des höchsten gemessenen Verbrauchs. Beim RAM sind wir großzügig, weil ein Dienst beim Überschreiten beendet wird; bei der CPU wird er nur gebremst.

## 4. Speicherplatz

Die Datenbank ist der einzige Dienst, dessen Speicherbedarf wächst. Messwerte werden derzeit **ohne zeitliche Begrenzung** aufbewahrt, deshalb planen wir für **zwei Jahre** im Voraus:

```
Datenbank = aktuelle Größe + 24 × Wachstum pro Monat + 20 % Reserve
```

| Größe | Wert | Quelle |
|---|---|---|
| Aktuelle Größe der Datenbank | *offen* | Messung vm23 |
| Wachstum pro Monat | *offen* | Messung vm23 |
| **Benötigter Speicher Datenbank** | **10 GiB** | *Schätzung*, wird aus den zwei Zeilen darüber berechnet |

Zur Einordnung: Die PV-Anlage allein liefert nur wenige Dutzend MB pro Jahr. Den Großteil machen die Raumsensoren aus; bei 100 Räumen mit einem Wert alle 10 Sekunden ist das grob 1 GB pro Jahr.

Backup-Speicher = 11 Sicherungen × Größe einer Sicherung (Abschnitt 5). Mit einer Sicherung von ca. 2 GiB ergibt das 22 GiB, angefragt werden 25 GiB.

## 5. Backup-Konzept

| Frage | Antwort |
|---|---|
| **Was** wird gesichert? | die komplette Datenbank: alle Messwerte und die Verwaltungsdaten (Benutzer, Zugangs-Tokens) |
| Was wird **nicht** gesichert? | Programme, Webseiten, Dashboards und Broker-Daten – sie werden aus dem Git-Repository neu erzeugt bzw. von den Sensoren innerhalb einer Minute neu gesendet |
| **Wie oft?** | täglich um 02:00 Uhr, automatisch; im schlimmsten Fall geht ein Tag an Messwerten verloren |
| **Wo?** | außerhalb des Clusters, damit ein Ausfall des Servers nicht auch die Sicherungen zerstört – Speicherort ist mit der Schule zu klären |
| **Wie lange?** | die letzten 7 täglichen und 4 wöchentlichen Sicherungen (11 Stück); ältere werden automatisch gelöscht |
| **Zugangsdaten** | liegen als Secret im Cluster, nie im Repository; eine Kopie verwahrt die Lehrkraft oder der Projektleiter |
| **Wiederherstellung** | schreibende Dienste anhalten, Sicherung einspielen (`influx restore --full`), Werte prüfen, Dienste wieder starten |

Im Vergleich zum aktuellen System behebt das drei Schwächen: Bisher wird nur **wöchentlich** gesichert, die Sicherungen liegen **auf derselben VM** wie die Datenbank, und der Zugangs-Token steht **im Klartext im Skript**.

### Restore-Test

Am 2026-10-20 wurde eine Sicherung lokal in eine zweite, getrennte Datenbank eingespielt: 28 Tage Testdaten (ca. 5,1 Millionen Messwerte). **Ergebnis: bestanden.** Alle Werte waren vollständig da, und die Zugangs-Tokens der gesicherten Datenbank funktionierten danach. Details: `restore-test.md`.

## 6. Wie gemessen wurde

| Messung | Methode | Stand |
|---|---|---|
| Neue Container (Kiosk, Dashboard, Broker, Datenbank leer) | lokal mit Docker, `docker stats`, 12 Stichproben im Leerlauf | ✔ erledigt (2026-10-19) |
| Laufendes System auf vm23 | einmalige Momentaufnahme während der Schulzeit (Befehl unten) | ⏳ offen |
| Restore | lokale Sicherung und Wiederherstellung mit Testdaten | ✔ erledigt (2026-10-20) |

Befehl auf vm23 (liest nur, ändert nichts, braucht keine Zugangsdaten der Datenbank):

```bash
docker stats --no-stream; docker exec influxdb sh -c 'du -sh /var/lib/influxdb2/engine/data/*; du -sk /var/lib/influxdb2/engine/data/*/autogen/*'; ls -l --full-time ~/influxdb-backups/ 2>/dev/null; du -sh ~/influxdb-backups/* 2>/dev/null; df -h /
```

Er liefert CPU und RAM jedes laufenden Containers, die Größe der Datenbank, ihre Größe pro Woche (daraus das Wachstum) und die Größe der vorhandenen Sicherungen.

### Messwerte vm23

| Container | CPU | RAM |
|---|---|---|
| *wird nach der Messung eingetragen* | | |

| Größe | Wert |
|---|---|
| Datenbank gesamt | *offen* |
| Wachstum pro Woche / Monat | *offen* |
| Größe einer Sicherung | *offen* |
| Freier Platz auf vm23 | *offen* |

Eine Momentaufnahme zeigt keine Lastspitzen. Deshalb liegen die Maximalwerte mindestens beim 1,5-fachen des gemessenen Werts, und vier Wochen nach dem Umzug werden die Werte mit dem tatsächlichen Verbrauch verglichen.

## 7. Offene Fragen an die Schule

1. Welche Infrastruktur steht zur Verfügung: ein Kubernetes-Cluster (wie viele Nodes, welche Storage-Class, gibt es einen Ingress) oder weiterhin eine VM?
2. Wo dürfen die Sicherungen außerhalb des Clusters bzw. der VM liegen (Netzlaufwerk, S3-kompatibler Speicher, zweite VM)?
3. Wer verwahrt die Kopie der Zugangsdaten (Lehrkraft oder Projektleiter)?
