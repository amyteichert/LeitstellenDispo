# LeitstellenDispo – Entwicklungsplan

Dieses Dokument ist ein laufender Planungsstand für das Projekt. Es ist eine Roadmap für die langfristige Entwicklung und kein bindendes Abschlussdokument. Alle technischen und fachlichen Details bleiben bewusst offen, bis sie gemeinsam mit Amy konkretisiert werden.

## 1. Ausgangslage

Das Projekt ist aktuell in einer frühen Phase mit einer sauberen technischen Grundlage:

- Monorepo mit den Bereichen client, server und shared
- client: React + TypeScript + Vite
- server: Node.js + Express + TypeScript
- shared: gemeinsame Typen und Konstanten
- Projektziel: browserbasierte Leitstellen-Simulation mit Einsatzmanagement und Karte

Der aktuelle technische Stand stellt die Basis dar, aber noch nicht die eigentliche Spiel-Logik.

## 2. Ziel des Projekts

LeitstellenDispo soll langfristig eine browserbasierte Leitstellen-Simulation werden, die sich vom Spielprinzip an Leitstellenspiel orientiert, aber ein eigenes, deutlich umfangreicheres und realistischeres System bekommt.

Das Spiel soll in Zukunft umfassen:

- echte Weltkarte
- Organisationen wie Feuerwehr und Rettungsdienst
- Wachen und Standortmodellierung
- Fahrzeuge mit Typen, Fähigkeiten und Zuständen
- Einsatzgenerierung und Einsatzmanagement
- Disposition und Alarmierung
- Einsatzverlauf und Rückkehr zur Wache
- spätere Erweiterungen für Benutzer, Rollen, Persistenz und Mehrbenutzerfähigkeit

## 3. Grundprinzipien für die Entwicklung

- Keine Codeänderungen ohne gemeinsame Zustimmung.
- Keine Umsetzung großer Schritte nur wegen einer Roadmap.
- Keine erfundenen Anforderungen, wenn sie nicht von Amy genannt wurden.
- Vorschläge und technische Annahmen sind immer nur Vorschläge, keine feste Spezifikation.
- Erst Grundlagen bauen, dann komplexere Spielmechanik ergänzen.
- Bestehenden Code und bestehende Projektstruktur möglichst sauber erweitern.
- Zukünftige Erweiterbarkeit im Blick behalten, ohne die erste Phase unnötig zu überladen.

## 4. Überblick über die Projektphasen

Der Plan ist in große Phasen gegliedert. Jede Phase soll später in kleine Arbeitsschritte zerlegt werden.

1. Phase 0 – bestehender Projektstand und Basis verstehen
2. Phase 1 – Domänenverständnis und gemeinsame Grundlagen
3. Phase 2 – Architektur und Datenfluss
4. Phase 3 – Organisationen und Wachen
5. Phase 4 – Fahrzeuge und Fahrzeugtypen
6. Phase 5 – Einsätze und Einsatzarten
7. Phase 6 – Disposition und Alarmierung
8. Phase 7 – Statussystem 1–6
9. Phase 8 – Karte, Einsatzorte und Bewegung
10. Phase 9 – UI/UX der Leitstellenoberfläche
11. Phase 10 – Persistenz, Qualität und Sicherheit
12. Phase 11 – spätere Erweiterungen und Skalierung

## 5. Phase 0 – bestehender Projektstand und Basis verstehen

Ziel:
- den bestehenden Stand sauber verstehen
- das Projekt als Grundlage nutzen
- offene Punkte sammeln

Mögliche Inhalte:
- bestehende Struktur prüfen
- bestehende Dokumentation aufnehmen
- vorhandene APIs und Frontend-Basis verstehen
- technische Einschränkungen und offene Punkte erheben

Hinweis:
- Dies ist der aktuelle Startpunkt und kein neuer Entwurf, sondern der Ausgangszustand.

## 6. Phase 1 – Domänenverständnis und gemeinsame Grundlagen

Ziel:
- die relevanten Begriffe des Spiels verständlich und sauber modellieren
- die zentrale Sprache für das Projekt festlegen

Mögliche Inhalte:
- Organisationen
- Wachen
- Fahrzeuge
- Einsätze
- Einsatzorte
- Statusbegriffe
- Nutzer-/Rollenkonzepte (nur als späterer Bereich)

Wichtig:
- Das Statussystem 1–6 darf hier nicht als festgelegt betrachtet werden.
- Die genaue Bedeutung und Logik muss mit Amy gemeinsam definiert werden.
- Viele Detailentscheidungen müssen später konkretisiert werden.

## 7. Phase 2 – Architektur und Datenfluss

Ziel:
- Verantwortlichkeiten zwischen client, server und shared definieren
- die technische Struktur als Grundlage für spätere Erweiterungen aufbauen

Mögliche Inhalte:
- Trennung von UI, Logik und Daten
- gemeinsame Typen und Datenmodelle
- serverseitige Spielzustandslogik
- API-Konzept für spätere Interaktionen
- klare Datenflüsse zwischen Client und Server

Wichtig:
- Eine konkrete Datenbankstrategie, Auth-Strategie oder Deployment-Vision bleibt offen und wird nicht als festgelegt behandelt.

## 8. Phase 3 – Organisationen und Wachen

Ziel:
- die Organisations- und Standortbasis des Spiels schaffen

Mögliche Inhalte:
- Organisationen definieren
- Wachen als Spielobjekte modellieren
- Standorte und Zuordnungen berücksichtigen
- Beziehung zwischen Organisation und Wache herstellen
- Grundlage für Karten- und Einsatzlogik schaffen

Wichtig:
- Feuerwehr und Rettungsdienst sind bisher benannte erste Organisationen, aber die genaue Umsetzung bleibt offen.

## 9. Phase 4 – Fahrzeuge und Fahrzeugtypen

Ziel:
- Fahrzeugverwaltung aufbauen

Mögliche Inhalte:
- Fahrzeugtypen modellieren
- Fahrzeugzuordnung zu Wachen und Organisationen
- Fahrzeugattribute und -zustände definieren
- spätere Fahrzeugfähigkeiten als Erweiterungsbereich vorbereiten

Beispiele, die bisher genannt wurden:
- LF 10
- LF 20
- RTW

Wichtig:
- Diese Beispiele sind Hinweise, keine feste Reihe von Fahrzeugtypen.
- Andere Fahrzeugtypen können später hinzukommen.

## 10. Phase 5 – Einsätze und Einsatzarten

Ziel:
- die Grundlage für Einsatzmanagement schaffen

Mögliche Inhalte:
- Einsatzarten
- Einsatzorte
- Einsatzstichworte
- benötigte Fahrzeuge
- Einsatzstatus
- Priorität und Dringlichkeit
- Einsatzverlauf und Abschlusslogik

Wichtig:
- Die Reihenfolge und konkrete Details werden später noch mit Amy abgestimmt.

## 11. Phase 6 – Disposition und Alarmierung

Ziel:
- die Leitstellen-Logik als Kernstück des Spiels modellieren

Mögliche Inhalte:
- Einsatz auswählen
- Fahrzeuge prüfen
- geeignete Einsatzmittel auswählen
- Alarmierung vorbereiten
- Einsatzzuweisungen überwachen
- Einsatzbetreuung und Abschlusslogik

Wichtig:
- Dies ist ein Kernbereich des Projekts, aber die konkrete Logik muss mit Amy gemeinsam definiert werden.

## 12. Phase 7 – Statussystem 1–6

Ziel:
- die Bedeutung und Logik des Statussystems mit Amy gemeinsam definieren

Wichtig:
- Das Statussystem 1–6 darf nicht eigenständig als feste Anforderung definiert werden.
- Die genaue Bedeutung, Übergänge und Wirkungen müssen noch gemeinsam festgelegt werden.
- Diese Phase dient der fachlichen Definition, nicht der Umsetzung ohne Abstimmung.

## 13. Phase 8 – Karte, Einsatzorte und Bewegung

Ziel:
- die räumliche Komponente des Spiels einbinden

Mögliche Inhalte:
- echte Weltkarte
- Wachen auf der Karte
- Einsatzorte auf der Karte
- Fahrzeugpositionen und Bewegungsmodell
- Platzierung von Objekten und Lagebezügen

Wichtig:
- MapLibre + OpenStreetMap werden als Vorschlag genannt, aber diese technische Wahl ist noch nicht als feste Anforderung zu behandeln.

## 14. Phase 9 – UI/UX der Leitstellenoberfläche

Ziel:
- die Oberfläche für die Leitstellen-Interaktion aufbauen

Mögliche Inhalte:
- Karte
- Einsatzlisten
- Fahrzeuglisten
- Detailansichten
- Dispositionswerkzeuge
- Statusanzeigen
- Bedienkonzepte

Wichtig:
- Das konkrete visuelle Design bleibt offen.
- Das bisher genannte „hell, rot, Leitstellen-Optik“ ist nur ein Vorschlag und darf nicht als festes Feature gelten.

## 15. Phase 10 – Persistenz, Qualität und Sicherheit

Ziel:
- das Projekt stabil und technisch sauber halten

Mögliche Inhalte:
- Datenpersistenz
- Fehlerbehandlung
- Validierung und Randfälle
- Teststrategie
- Logging
- Stabilität und Wartbarkeit

Wichtig:
- Datenbank- und Sicherheitsentscheidungen bleiben offen.
- Dieser Bereich wird nur nach der fachlichen Grundarchitektur sinnvoll umgesetzt.

## 16. Phase 11 – spätere Erweiterungen und Skalierung

Ziel:
- das Projekt offen und erweiterbar halten

Mögliche Inhalte:
- Benutzer / Accounts
- Rollen und Berechtigungen
- Mehrbenutzerfähigkeit
- Realtime-Updates
- zusätzliche Organisationen
- umfangreichere Einsatzlogik
- Deployment und Betrieb

Wichtig:
- Diese Bereiche sind als spätere Planungsfelder zu verstehen und nicht als sofort umzusetzen.

## 17. Arbeitsweise für die zukünftige Umsetzung

Für spätere Schritte gilt folgende Arbeitsweise:

1. Ein Arbeitsschritt wird abgeschlossen.
2. Es wird kurz gezeigt, was erledigt wurde.
3. Es wird kurz gezeigt, welche Dateien geändert oder neu erstellt wurden.
4. Es wird erklärt, was sich dadurch im Projekt verändert hat.
5. Es werden Tests ausgeführt, sofern sinnvoll.
6. Es wird geprüft, ob der Schritt wirklich vollständig abgeschlossen ist.
7. Danach wird ausdrücklich gefragt:

„Fertig. Soll ich jetzt mit dem nächsten Schritt weitermachen?“

Wenn der nächste Schritt Entscheidungen braucht:
- Was genau soll gemacht werden?
- Warum ist dieser Schritt jetzt sinnvoll?
- Welche Dateien wären wahrscheinlich betroffen?
- Welche Entscheidung braucht Amy?

Erst danach darf die Umsetzung beginnen.

## 18. Noch nicht entschieden / Entscheidung durch Amy erforderlich

Diese Punkte brauchen noch eine Entscheidung durch Amy:

- Welche Datenbankstrategie soll später verwendet werden?
- Welche Authentifizierungsstrategie ist für die spätere Umsetzung passend?
- Soll die erste produktive Phase eher ein lokaler Einzelspieler-Betrieb sein oder bereits ein Mehrbenutzer-/Servermodell?
- Wie realistisch soll die Kartenlogik in frühen Phasen sein?
- Welche Organisationen sollen konkret in den frühen Schritten berücksichtigt werden?
- Wie genau soll das Statussystem 1–6 definiert werden?
- Wie detailliert soll die Fahrzeugmodellierung in den frühen Phasen sein?
- Welche Einsatzarten sollen früh als relevant gelten?
- Wie breit soll die Persistenzstrategie in frühen Schritten sein?
- Was ist für Amy wichtiger: Spielbarkeit, realistische Simulation, technische Einfachheit oder spätere Erweiterbarkeit?
- Wie stark soll die Leitstellenoberfläche in frühen Phasen visuell ausgebaut werden?
- Wie groß soll das erste brauchbare spielbare System sein?

## 19. Offene technische und fachliche Hinweise

- Das bestehende Projekt ist derzeit technisch vorbereitet, aber noch nicht spieldesign-technisch vollständig definiert.
- Die bisher genannten Anforderungen haben Vorrang vor technischen Annahmen.
- Die Roadmap ist keine automatische To-do-Liste.
- Die Roadmap ist eine Orientierung für die langfristige Projektentwicklung, nicht eine festgeschriebene Spezifikation.

## 20. Kurzfazit

Die bestehende Grundlage ist gut, aber das Projekt ist noch nicht in die eigentliche Spielwelt und Spielmechanik vorgedrungen. Der richtige Weg ist ein schrittweises Vorgehen:

- gemeinsame Begriffe und Domäne klären
- Struktur und Datenfluss definieren
- Organisationen und Wachen einführen
- Fahrzeuge und Einsätze modellieren
- Leitstellenlogik und Statussystem definieren
- Karte, UI und Persistenz ergänzen
- spätere Erweiterungen erst nach stabilen Grundlagen einbauen

Damit bleibt das Projekt langfristig erweiterbar, ohne dass zukünftige Anforderungen durch eine zu einfache frühe Architektur blockiert werden.
