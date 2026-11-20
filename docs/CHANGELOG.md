# Changelog

Alle wichtigen Änderungen an LeitstellenDispo werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/).

---

## [0.2.0-beta] – 20.11.2026 – Beta-Start

### Geändert
- **Die Alpha ist vorbei, die Beta läuft.** Version 0.2.0-beta. Alle Einträge unten bis 0.1.0-alpha sind Teil dieser Version.
- Gäste-Profil verspricht kein Gründungs-Abzeichen mehr (gibt es nur für Konten aus der Alpha).

## [Unreleased] – Antwort auf Meldungen

### Neu
- **Spieler erfahren, wenn ihre Meldung erledigt ist:** Im Team-Bereich (Team → Meldungen) lässt sich beim Erledigen eine
  kurze Antwort schreiben (optional). Der Spieler sieht beim nächsten Spielen oben einen grünen Hinweis mit seiner Meldung
  und der Antwort und klickt ihn mit „Danke“ weg. Gilt auch für /bug aus Discord, wenn das Discord-Konto verknüpft ist.
  Ältere, schon erledigte Meldungen lösen keinen Hinweis aus.

## [Unreleased] – Spieler-Meldungen: Nachalarmieren, Fahrzeuge verkaufen, CBRN-Erkunder

### Behoben
- **Nachalarmieren während „In Bearbeitung“** (Meldung von Kyle): Sobald ein Einsatz lief, ließen sich keine Kräfte mehr
  hinzufügen. Jetzt geht das bis zum Transport; der Einsatz bleibt in Bearbeitung, die Restzeit ändert sich nicht.
  Ein später eintreffender RTW kann z. B. einen weiteren Patienten transportieren. Versehentlich nachalarmierte Fahrzeuge
  lassen sich zurückholen, solange sie noch auf Anfahrt sind. Der AAO-Vorschlag bleibt in dieser Phase leer (Bedarf gedeckt).

### Neu
- **Fahrzeuge verkaufen** (Wunsch von Kyle): Wache › Verwalten › Fahrzeuge › Fahrzeug antippen › „Verkaufen“.
  Es gibt die Hälfte des Kaufpreises zurück, der Stellplatz wird frei, die Besatzung bleibt als Personal ohne Fahrzeug an der Wache.
  Nur möglich, wenn das Fahrzeug einsatzbereit an der Wache steht.
- **CBRN-Erkundungswagen (CBRN-ErkW)** für den Gefahrgutzug (Meldung von Marcel): schneller als der GW-Mess, 4 Plätze,
  braucht Gefahrgut-Ausbildung, ab Rang Schichtführer. Zählt bei Einsätzen als Messfahrzeug („GW-Mess/CBRN-ErkW“).

## [Unreleased] – Anfänger-Test: Tutorial auf kleinen Handys und auf test

### Behoben
- **Wachenverwaltung auf kleinen Handys zu breit** (iPhone SE/mini, 320–375 px): Die Seite war breiter als der Bildschirm,
  rechts rutschten Reiter und der ✎-Knopf raus. Im Tutorial verdeckte dadurch die Hinweisbox genau den Reiter „Personal“,
  den man antippen sollte – die Tour ging nicht weiter. Ursache: Seiteninhalt als Grid-Element ohne `min-width: 0`.
- Kopf der Wachenverwaltung: „Zurück“ wird nicht mehr zusammengequetscht, lange Wachennamen werden sauber getrennt.
- **Testumgebung: Menü-Knopf unter dem gelben Balken**: Die Tour scrollte die Kopfzeile unter den festen Hinweisbalken,
  Schritt „Das Menü“ war nicht antippbar. Der Balken setzt jetzt `scroll-padding-top` auf seine Höhe.

### Geändert
- Tutorial-Texte für Einsteiger: RTW (Rettungswagen), HLF (Löschfahrzeug) und AAO (Alarm- und Ausrückeordnung) werden erklärt,
  der Funk-Schritt nennt den Knopf „Sprechaufforderung“ beim Namen.

---

## [Unreleased] – Tour-Hinweis auf sehr kleinen Handys

### Behoben
- Auf 320 px breiten Handys lag der Tour-Hinweis auf der Testumgebung teilweise unter dem gelben Balken
  (Titel und Textanfang nicht lesbar). Der Balken meldet seine Höhe jetzt als `--fester-balken`; die Tour platziert
  ihren Hinweis darunter und begrenzt seine Höhe auf den freien Bereich. Gescrollt wird nur der Fließtext –
  Fortschritt, Titel und Knöpfe bleiben immer sichtbar (vorher schob der Fokus auf „Weiter“ den Titel aus dem Bild).

## [Unreleased] – QA-Nacht 2: Datenverlust, Drosselung, Bestenliste, Oberfläche

### Behoben
- **Spielstand-Verlust bei zwei Geräten** (QA-05): Jeder gespeicherte Stand bekommt eine laufende Version. Das Spiel schickt
  sie beim Speichern mit; ist sie veraltet (ein anderes Gerät war schneller), antwortet der Server mit 409, das Spiel
  speichert nicht weiter und zeigt „Auf einem anderen Gerät weitergespielt“ mit „Neu laden“. Ältere Spiele im Browser
  (ohne Versionsangabe) speichern wie bisher – ein Deployment unterbricht also niemanden.
- **Drosselung der Speichervorgänge je Konto** (QA-06): höchstens 15 Speicherungen pro 10 Sekunden (das Spiel braucht ~1 pro 3 s),
  darüber 429 mit `Retry-After`. Andere Konten sind davon nicht betroffen.
- **Buchungsliste wächst nicht mehr endlos** (QA-07): Ab 1.000 Buchungen werden ältere zu zwei Sammelbuchungen
  zusammengefasst („Frühere Einnahmen/Ausgaben“). Die Summen in den Finanzen bleiben dadurch richtig; die
  Sammelbuchungen können kein Guthaben erklären (kein neues Schlupfloch).
- **Bestenliste: Fuhrpark und Wachen** (QA-08) kommen jetzt aus vom Server geprüften Werten mit gedeckeltem Zuwachs.
  Der Spielstand selbst bleibt unangetastet – niemand verliert Fahrzeuge, nur die Rangliste bleibt sauber.
- **nodemailer auf 10.6** (QA-09): keine offenen Sicherheitshinweise mehr (`npm audit`: 0). Mit echtem SMTP-Test abgesichert.
- **Fehlergrenze für die Oberfläche** (QA-10): Ein Absturz zeigt eine Meldung mit „Neu laden“ statt einer weißen Seite.
- **Adresssuche beim Kartenklick gedrosselt** (QA-11): erst nach 1 Sekunde Ruhe – so bleibt die Nutzungsregel von
  Nominatim (höchstens 1 Anfrage pro Sekunde) eingehalten.
- **Kopfzeile auf dem Handy** (QA-12): Der Menü-Knopf wird nicht mehr abgeschnitten.
- **Checkliste „Erste Schritte“** (QA-13) startet auf dem Handy eingeklappt und verdeckt die Karte nicht mehr.

## [Unreleased] – QA: Schummelschutz für Bestenliste und Guthaben

### Behoben (Sicherheit)
- **Erfundene Schichtzulagen/Team-Korrekturen** wurden ungeprüft anerkannt – der Server prüft sie jetzt gegen die von ihm
  vergebenen Beträge; unbestätigte Buchungen werden nicht gespeichert
- **„Dev-Werkzeug“-Gutschriften** zählen nur noch bei Team und Testern, **Kreditauszahlungen** nur mit neuem Kredit
- **„Neues Spiel“-Umgehung**: Mit neu datierter Startbuchung wurde das Guthaben nicht geprüft – jetzt Prüfung gegen einen
  leeren Start (Startbuchung höchstens 20.000 €); auch der erste Spielstand eines Kontos wird geprüft
- **Bestenliste**: EP, Einsätze und perfekte Einsätze dürfen nur so schnell wachsen, wie es das Einsatzaufkommen zulässt
  (2.000 Einsätze/Std., 150 EP je Einsatz, Sockel für Erfolge) – mehr wird gekappt und im Team-Protokoll vermerkt.
  Kaputte Laufbahn (z. B. EP als Text) → bisheriger Stand, Ruf auf 0–100 begrenzt. Team/Tester ausgenommen
- Abhängigkeiten per Patch-Update aktualisiert (vite, express, qs, body-parser, nodemailer 7.0.13 u. a.)

## [Unreleased] – Kredite

### Hinzugefügt
- **Kredite** (Finanzen → „Kredit“): Betrag wählen (Kreditrahmen wächst mit dem Rang: 10.000 € bis 500.000 €) und
  Laufzeit 4 / 12 / 24 Spielstunden mit 5 / 10 / 15 % Zinsen. Zurückgezahlt wird in festen Raten je Stunde –
  minütlich abgebucht wie die laufenden Kosten, nur solange das Spiel offen ist. Höchstens ein Kredit gleichzeitig,
  Restschuld jederzeit ohne Aufpreis ablösbar. Vorschau mit Zinsen, Rate und Gesamtbetrag vor dem Abschließen
- Logik in `shared/src/kredite.ts`, Spielstand-Feld `kredit` (manipulierte Kredite werden beim Laden/Speichern verworfen)
- Laufende Kosten und Kreditraten nutzen dieselbe stündliche Sammelbuchung (`bucheJeStunde`)

### Geändert
- Plausibilitätsprüfung: Kreditauszahlungen zählen nicht als „auffällige Einnahmen“
- Finanzen: „Einnahmen letzte Stunde“ ohne Kreditauszahlung, Bilanz zieht die Kreditrate ab

## [Unreleased] – Bestenliste

### Hinzugefügt
- **Bestenliste** (Menü → „Bestenliste“): Wertungen nach Erfahrung, Einsätzen, perfekten Einsätzen, Ruf (ab 25 Einsätzen)
  und Fuhrpark; Top 50 mit Medaillen, Rang, Profilbild und Abzeichen, der eigene Platz ist hervorgehoben und erscheint
  auch außerhalb der Top 50. Gesperrte, nicht freigeschaltete und mit Dev-Werkzeugen gespielte Konten zählen nicht.
  Gäste sehen einen Hinweis auf das kostenlose Konto
- Server: Tabelle `bestenliste` mit einer Kurzfassung je Spielstand – Datenbank-Trigger halten sie bei jedem Speichern
  und Löschen aktuell, vorhandene Spielstände werden beim Update übernommen; API `GET /api/bestenliste?kategorie=…`

## [Unreleased] – Balancing: laufende Kosten

### Geändert
- **Laufende Kosten um 50 % erhöht** (Gehälter, Zulagen, Unterhalt von Wachen, Fahrzeugen, Ausbildungsräumen und
  eigenen Krankenhäusern). Laut Bot-Simulation lagen die Kosten nur bei 2–10 % der Einnahmen, jetzt je nach Ausbau
  bei ca. 3–15 % (Rettungsdienst) bzw. 8–40 % (großer Feuerwehr-Ausbau) für einen perfekt spielenden Bot –
  Wachstum will also etwas geplant sein. Der frühere Hinweis „frühe Rettungsdienst-Phase defizitär“ trifft nicht mehr zu.

---

## [Unreleased] – Bot & Härtetest (Dev-Werkzeuge)

### Hinzugefügt
- **Bot** (`shared/src/bot/`): spielt automatisch auf einem eigenen Sandbox-Spielstand – baut die erste
  Wache, kauft und besetzt Fahrzeuge, alarmiert passende Fahrzeuge zu Einsätzen. Ziele: Einsätze abarbeiten,
  Geld maximieren, Leitstelle ausbauen, schnellste Anfahrt, Chaos-Test
- **Simulation im Zeitraffer** (`simuliere` / schrittweiser `simulationsSchritt`) mit Ruf-abhängigen Einnahmen
  und laufenden Kosten – spielt Stunden/Tage ohne Browser durch
- **Fehlerwächter** (`pruefeSpielstand`): prüft Invarianten (Kontostand, Ruf, doppelte Alarmierung,
  hängende Einsätze, verwaistes Personal …)
- **Härtetest** (`haerteTest`): wirft den Spielfunktionen bösartige/kaputte Daten hin und prüft auf Abstürze
  (Robustheits-/Sicherheitstest – der Server nimmt hochgeladene Spielstände über `migriereSpielstand` an)
- **Bot-Werkzeug als eigener Team-Reiter „Bot“** (neben „Dev-Werkzeuge“, nur für Owner & Co-Owner –
  eigenes Team-Recht `bot`): Start/Stopp, Geschwindigkeit, Ziel-Auswahl, Live-Protokoll,
  Besitz-Dashboard, Fehlerwächter und Härtetest
- Bot wirtschaftet **kostenbewusst**: behält immer einen Puffer (mehrere Stunden laufende Kosten) und
  baut nur aus, wenn es sich rechnet (Einnahmen ≥ Kosten) – statt sich durch zu viele Fahrzeuge/Wachen
  ins Minus zu bauen. (Hinweis: Die frühe Rettungsdienst-Phase ist aktuell knapp defizitär – ein
  Balancing-Thema, kein Bot-Fehler.)

### Gehärtet (Sicherheit)
- `migriereSpielstand` prüft jetzt die Struktur jedes Einsatzes/Fahrzeugs und den Kontostand: ein beschädigter
  oder manipulierter Spielstand (z. B. ein Einsatz mit kaputtem `alarmedVehicles`) wird abgewiesen, statt
  später den Spiel-Tick zum Absturz zu bringen. Der Härtetest hatte genau diese Lücke aufgedeckt.

---

## [Unreleased] – Laufende Kosten, Team-Rechte, ruhigeres Design

### Hinzugefügt
- **Laufende Kosten**: Gehälter (Grundgehalt + Zulagen je Qualifikation), Unterhalt für Wachen, Ausbauten,
  Ausbildungsräume, Fahrzeuge und eigene Krankenhäuser (`shared/src/kosten.ts`, Werte in `KOSTEN_CONFIG`).
  Minütlich abgebucht, aber nur solange das Spiel offen ist; eine Sammelbuchung je Stunde in den Finanzen
- Finanzen: Kostenaufstellung je Stunde, Einnahmen der letzten Stunde, Bilanz, Hinweis bei Minus-Konto
- Wachen: laufende Kosten je Wache in Liste und Übersicht
- Balancing-Simulation rechnet die laufenden Kosten mit ein
- **Symbole** für Feuerwachen (Helm), Rettungswachen (Stern des Lebens), Krankenhäuser (H), jede Fahrzeugart
  (RTW, KTW, NEF, Löschfahrzeug, Drehleiter, Rüstwagen, ELW) und Einsatzarten (Brand, Alarm/BMA, Patient, Herz,
  Verkehrsunfall, Technik, Baum, Wasser/Öl, Tier, Tür, Krankentransport) – auf der Karte und in den Listen gleich
  (`client/src/Kennzeichen.tsx`, Zuordnung der Einsätze in `shared/src/symbole.ts`)
- Symbole von Flaticon für Feuerwache, Rettungswache, Krankenhaus, RTW, KTW und Löschfahrzeug (`client/public/symbole`),
  Bildnachweis im Impressum
- **Besucherstatistik der Website** (nur Owner, Team-Bereich → „Website“): Besucher, Seitenaufrufe, Verhalten
  (kurz / gelesen / interagiert), Herkunft (Suchmaschine, andere Website, geteilter Link mit `?von=…`, direkt),
  beliebte Seiten und Klicks aufs Spiel. Anonym ohne Cookies und ohne IP-Speicherung (`server/src/website.ts`).
  Zählt Info-Website und Spiel (inkl. Registrierungen/Anmeldungen) – einzeln oder zusammen auswertbar
- **Schnellzugriff** auf Karte, Einsätze (mit Zahl wartender Einsätze) und Einstellungen: am PC als Reiter oben in der
  Kopfzeile, am Handy als Leiste unten; alle weiteren Bereiche bleiben im Menü oben rechts

### Geändert
- **Einsätze auf dem Handy**: Die Details klappen direkt unter dem angetippten Einsatz auf (nochmal antippen = zu),
  statt ganz unten unter der Liste; am PC bleibt die zweispaltige Ansicht
- **Rückalarmieren statt Nachbarleitstelle**: Der Knopf „An Nachbarleitstelle abgeben“ entfällt; stattdessen holt
  „Rückalarmieren“ alle Fahrzeuge eines Einsatzes zurück (ohne Abzug). Der Einsatz bleibt offen und verfällt wie jeder andere
- **Team-Rechte**: Admins moderieren (ansehen, sperren, Notizen, Passwort-Link). Konto löschen, Spielstand
  zurücksetzen, Guthaben/Ruf korrigieren und Ankündigungen erst ab Co-Owner; fremde Notizen löschen erst ab Co-Owner
- **Design**: schlichte Kopfzeile mit Signet statt Banner, neutrale Statusanzeigen mit Linien-Symbolen,
  ruhigere Buttons (kein Springen/Leuchten), einheitliche Seitenbreite und Überschriften
- Anmeldung und Passwort-Seite ohne Werbebanner, Radar-Animation und Laufband

---

## [Unreleased] – Einsatzorte, Fahrzeugbedarf, Rettungsdienst

### Hinzugefügt
- **Echte Einsatzadressen**: Jeder Einsatz hat eine Adresse (Straße, Hausnummer, PLZ, Ort) passend zu seinen Koordinaten;
  PLZ/Ort kommen von der Wache (Adresssuche bzw. Rückwärtssuche beim Kartenklick, sonst nächster bekannter Ort)
- **Zentraler Fahrzeugkatalog** mit Fähigkeiten, Geschwindigkeit, Besatzung und Organisation (`shared/src/fahrzeuge.ts`)
- **Fahrzeugbedarf mit Zuordnung**: jedes Fahrzeug füllt genau einen Platz; Bedarfsklasse „Technische Hilfe“ (LF/HLF, nicht TLF)
- Einsatz wird erst bearbeitet, wenn der Bedarf **vor Ort** gedeckt ist; überzählige Fahrzeuge auf Anfahrt blockieren nicht
- **Lagemeldungen** mit Art und Zeitstempel: Eintreffen, Nachforderung, Eskalation, Patientenstatus
- **Nachforderung** durch das erste Fahrzeug (ausgewürfelt oder wenn zu wenig alarmiert wurde)
- **Rettungsdienst**: Patienten mit Zustand, Behandlung, Transport ins Krankenhaus, Übergabe, Rückfahrt vom Krankenhaus;
  NEF wird nach der Behandlung frei; Transportvergütung
- **Krankenhäuser** (Stuttgart) als Transportziele, auf der Karte sichtbar; abgelegene Wachen bekommen automatisch ein Klinikum
- Neue Einsätze: RD 2 Verkehrsunfall, B 3 Gebäudebrand, TH 1 Ölspur / Baum auf Straße / VU / Person hinter Tür, TH 2 VU mit eingeklemmter Person
- Fahrzeugstatus nach FMS (S1–S8), Besatzung (Grundlage), Status „Patiententransport“ und „Am Krankenhaus“
- Karte: Krankenhaus-Marker, Transportfahrten, FW-Einsätze eckig / RD rund, Schnell-Alarmierung im Einsatzfenster
- Spielstand Version 3 mit Migration alter Spielstände; API `/api/fahrzeugtypen`, `/api/krankenhaeuser`
- `npm test` im Hauptordner; 80 automatische Tests

### Behoben
- Einsatzansicht auf dem Handy war breiter als der Bildschirm

---

## [0.1.0-alpha] – Phase 0 – Projekt-Setup

### Hinzugefügt
- Monorepo-Struktur mit npm Workspaces (`client`, `server`, `shared`)
- React + TypeScript Frontend (Vite)
- Node.js + Express + TypeScript Backend
- Shared-Paket mit App-Konstanten und Basis-Typen (inkl. `UserRole` für späteres Owner-System)
- Startseite mit LeitstellenDispo-Branding (hell, rot)
- Versionsanzeige V0.1.0-alpha in der Oberfläche
- API-Endpunkte: `/api/health`, `/api/info`
- README mit Start-Anleitung
- `.gitignore`

### Geplant für Phase 1 (V0.2.0-alpha)
- Login / Registrierung
- Benutzerverwaltung mit Rollen (player, admin, co_owner, owner)
- Geschützte Spiel-Seite
