# QA-Bericht LeitstellenDispo – Testnacht 16./17.11.2026

Erstellt von Claude (autonomer QA-Auftrag). Alle Zahlen sind tatsächlich gemessen; Testskripte liegen unter
`/tmp/claude-0/-home-user/edf84b6e-4d19-507c-b753-90618fca553f/scratchpad/qa/` (flüchtig – siehe Abschnitt 15).

## 1. Zusammenfassung

- Zuerst wurde versehentlich der veraltete Branch `master` (Stand 07.10.) getestet. Die dort gefundenen 8 Fehler wurden
  behoben und auf `claude/leitstellendispo-qa-night-xxnf6i` gepusht – sind auf dem aktuellen Stand aber großteils schon gelöst.
- Danach Umstieg auf den **aktuellen Stand `test`** (= live, Commit 37c4a09 vom 09.11.). Dort:
  - **Sicherheit insgesamt gut**: 49/49 Angriffs- und Rechtetests bestanden (Datenisolation, Rollen, Brute-Force-Bremse,
    Sitzungen, Upload-Prüfung, Race-Condition Schichtzulage).
  - **Schummelschutz/Bestenliste war umgehbar** (4 Wege, bestätigt) → behoben, verifiziert, 17 neue Tests, auf dem
    QA-Branch committet (Commit 6bfabfe) – noch nicht auf `test` (siehe 15).
  - **Datenverlust bei zwei Geräten/Tabs** bestätigt → offen, Lösungsvorschlag in Abschnitt 18.
  - Lasttests nur **lokal** (Test- und Live-Server teilen sich eine Maschine – ein Lasttest hätte das Live-Spiel getroffen).

## 2. Untersuchte Bereiche

| Bereich | Stand | Wie geprüft |
|---|---|---|
| Spiellogik (Einsätze, Alarmierung, Tick, Transport, Eskalation) | master + test | Unit-Tests, Langzeit-Simulator (8 Konfigurationen), 24-h-Balancing-Simulation |
| Registrierung / Anmeldung / Abmelden / Sitzungen / Passwort | test | API-Angriffstests |
| Rollen & Team-Bereich (Owner, Co-Owner, Admin, Tester, Spieler) | test | Code-Review + 14 Rechtetests |
| Spielstand-Speicherung, Schummelschutz, Bestenliste | test | API-Tests, Manipulationsversuche, echter Client |
| Profilbilder, Fahrzeuggrafiken, Fehlermeldungen, Discord-Bot-API | test | Code-Review, Upload-Tests |
| Website-Statistik (`/api/website`) | test | Spam-Test, Code-Review |
| Spieloberfläche (Anmeldung, Tour, Karte, Wache bauen, Alarmieren) | master + test | Playwright-Browsertests |
| Handy/Tablet-Darstellung | master (+ Website) | iPhone 13, Pixel 7, 768 px |
| Belastung (API, Speichern, Oberfläche) | master + test | eigene Lasttests lokal |
| Website leitstellendispo.de (11 Seiten) | main | Crawler Desktop + Handy |
| test.leitstellendispo.de | live Testserver | nur 3 lesende Anfragen + Header (bewusst keine Last) |

## 3. Anzahl der Tests

- Automatische Unit-Tests aktueller Stand: **395** (vorher 378, +17 neu). Auf master: 86 (vorher 80, +6 neu).
- Eigene Szenario-/Angriffs-/Browserprüfungen: **ca. 172 Einzelfälle** (69 auf master, 103 auf test), viele davon mehrfach
  (vor und nach einer Reparatur).

## 4. Erfolgreiche Tests

- Alle 395 Unit-Tests (aktuell) und 86 (master) grün, Builds grün.
- Sicherheit test: 49/49. Website: 23/23. Ehrlicher Spielablauf im echten Client nach der Härtung: keine Fehlkorrektur.
- Langzeit-Simulator: keine Doppelbelegung, keine Doppelabrechnung, keine inkonsistenten Fahrzeugzustände (bis 60.000 Takte).

## 5. Fehlgeschlagene Tests (= echte Befunde beim ersten Lauf)

master: Deadlock-Simulation, XSS-Test, 3 kaputte-Spielstand-Tests, Einsatzerzeugung (0 statt 4), Handy-Breite Wachen (2 Geräte),
Speicherquote. test: 3 von 4 Schummeltests, Mehrgeräte-Test. Mehrere weitere „Fehlschläge“ waren Fehler meiner Testskripte
(Selektoren, Timeouts, Registrierungsbremse) – keine App-Fehler.

## 6. Alle gefundenen Fehler

### Aktueller Stand (`test` / live)

**QA-01 – Erfundene Schichtzulagen/Team-Korrekturen werden anerkannt**
Schweregrad: HOCH · Bereich: Server, Schummelschutz · Status: **behoben (QA-Branch, Commit 6bfabfe)**
Erwartet: Nur vom Server vergebene Gutschriften zählen. Tatsächlich: Buchung „Schichtzulage – …“ über 50 Mio. € wurde
gespeichert, ohne Protokolleintrag. Reproduktion: Spielstand mit zusätzlicher Einnahme-Buchung mit diesem Label per PUT senden.
Ursache: `pruefeGuthaben` nahm Buchungen mit Server-Labels ungeprüft von der Einnahmenprüfung aus.
Dateien: `shared/src/plausibilitaet.ts`, `server/src/spielstand.ts`. Regression: 395 Tests, echter Client-Ablauf mit echter
Schichtzulage → keine Korrektur.

**QA-02 – „Neues Spiel“-Umgehung, erster Spielstand ungeprüft**
HOCH · Server · **behoben (QA-Branch)**. Neu datierte Startbuchung → Guthaben wurde gar nicht geprüft (777 Mio. € angenommen);
der erste Spielstand eines Kontos ebenfalls nicht. Jetzt Prüfung gegen leeren Start, Startbuchung max. 20.000 €.

**QA-03 – Bestenliste frei manipulierbar (EP, Einsätze, Perfekt, Ruf)**
HOCH · Server/Bestenliste · **behoben (QA-Branch)**. EP 999.999.999 → Platz 1. Zusätzlich: EP als Text („999999999“) wurde von der
Bestenlisten-SQL trotzdem als Zahl gewertet; Ruf ohne Grenze. Jetzt: Zuwachs je Echtzeit begrenzt (2.000 Einsätze/h,
150 EP/Einsatz, Sockel 20.000 EP – real sind ca. 38 Einsätze/h), kaputte Laufbahn → bisheriger Stand, Ruf 0–100,
Protokolleintrag „Laufbahn korrigiert“. Team/Tester ausgenommen.

**QA-04 – Kredit- und Dev-Werkzeug-Label umgehen die Prüfung**
MITTEL · **behoben (QA-Branch)**. Kreditauszahlungen zählen nur mit neu aufgenommenem Kredit, Dev-Buchungen nur bei Team/Testern.

**QA-05 – Datenverlust bei gleichzeitigem Spielen auf zwei Geräten/Tabs**
HOCH · Speicherung · **offen**. Gerät A baut Wache (−12.000 €), Gerät B (älterer Stand) speichert beim nächsten Autospeichern
und überschreibt alles (bestätigt im Browser, < 90 s). Ursache: kein Konfliktschutz („letzter gewinnt“).

**QA-06 – Kein Limit für Spielstand-Speicherungen, große Stände blockieren den Server**
MITTEL · Server/Performance · **offen**. 3-MB-Stand ≈ 90 ms CPU je Speichern (11/s); ein Konto mit 4 parallelen
4-MB-Schleifen hebt die Antwortzeit für alle von 2 ms auf ~80 ms (max. 190 ms).

**QA-07 – Transaktionsverlauf wächst unbegrenzt**
MITTEL · Langzeit · **offen**. ~38 Buchungen/Spielstunde; nach ca. 700 Spielstunden über 5 MB → Server antwortet 413, der
Client wiederholt alle 3 s still → Fortschritt geht verloren. Kappen ändert „Einnahmen/Ausgaben gesamt“ in den Finanzen
(Design-Entscheidung, daher nicht umgesetzt).

**QA-08 – Bestenliste „Wachen/Fuhrpark“ weiter manipulierbar**
NIEDRIG · **offen**. Fahrzeuge/Wachen werden nicht gegen Käufe geprüft.

**QA-09 – nodemailer 7 mit 8 Sicherheitshinweisen**
NIEDRIG · **offen**. Fix nur per Major-Update auf 10. In der Nutzung (validierter Empfänger, reiner Text) praktisch nicht
ausnutzbar. Alle anderen Abhängigkeiten per Patch-Update aktualisiert (im Commit 6bfabfe).

**QA-10 – Fehlende Fehlergrenze im Client** · NIEDRIG · offen (Render-Absturz → weiße Seite; auf master behoben).
**QA-11 – Nominatim-Rückwärtssuche ohne Drosselung** · OPTIMIERUNG · offen (Nutzungsregel max. 1 Anfrage/s; auf master behoben).
**QA-12 – Ansichts-Knopf oben rechts auf dem Handy abgeschnitten** · NIEDRIG · offen. iPhone 13 / Pixel 7: Kopfzeile passt
nicht in 390–412 px, der Knopf zeigt nur „Eins…“/„Kart…“ (kein seitliches Scrollen, Bedienung über untere Leiste möglich).
**QA-13 – Hinweisboxen verdecken beim ersten Start auf dem Handy die halbe Ansicht** · OPTIMIERUNG · offen
(Willkommen + Schichtzulage + „Erste Schritte“ übereinander, Karte kaum sichtbar, bis man sie schließt).

Verdachtsfälle (nicht bestätigbar ohne Serverzugang):
- **V-01** Brute-Force-Bremse nutzt `X-Forwarded-For` (vertraut Loopback). Lokal fälschbar; sicher nur, wenn nginx den Header
  anhängt statt ungeprüft durchzureichen → nginx-Konfiguration prüfen.
- **V-02** Sitzungs-Cookie bekommt `Secure` nur bei `NODE_ENV=production` → in `config.env` prüfen.
- **V-03** `grafikId` aus dem Spielstand landet ungeprüft in `<img src>`, solange die Grafikliste noch nicht geladen ist
  (nur eigener Spielstand betroffen, nicht ausgenutzt).

### Veralteter Stand `master` (bereits behoben auf Branch `claude/leitstellendispo-qa-night-xxnf6i`)

| ID | Titel | Schwere | Auf `test`? |
|---|---|---|---|
| M-01 | Dispositions-Deadlock (RTW wartet auf NEF, NEF auf RTW, keine Rückalarmierung) | HOCH | schon gelöst (Rückalarmierung) |
| M-02 | Einsatzerzeugung stockt bei viel Betrieb (0 statt 4 Einsätze in 100 s) | HOCH | schon gelöst |
| M-03 | Script-Injection über Funkrufname im Karten-Marker | MITTEL | schon gelöst |
| M-04 | Kaputter Spielstand → weiße Seite | MITTEL | Server lehnt kaputte Stände ab; Fehlergrenze fehlt (QA-10) |
| M-05 | localStorage voll (~25.000 Buchungen) → Speichern scheitert still | MITTEL | entspricht QA-07 |
| M-06 | Wachen-Ansicht auf dem Handy zu breit | NIEDRIG | neue Oberfläche, nicht separat geprüft |
| M-07 | Server-Fehlerseite mit Stacktrace/Pfaden | NIEDRIG | schon gelöst |
| M-08 | Nominatim ohne Drosselung | OPTIMIERUNG | offen (QA-11) |

## 7. Behobene Fehler
QA-01 bis QA-04 (aktueller Stand, verifiziert, Commit 6bfabfe auf dem QA-Branch), M-01 bis M-08 (master, gepusht).

## 8. Offene Fehler
QA-05 bis QA-13, V-01 bis V-03.

## 9. Durchgeführte Belastungstests (alle lokal)
- master-API: 10 / 50 / 200 / 1.000 parallele Verbindungen, je 8 s.
- test: Speichern mit 20 Konten (8 KB), 50 Konten (314 KB), 10 Konten (3 MB); Flutung durch ein Konto (4 × 4,3 MB parallel).
- Oberfläche: Riesen-Spielstand (40 Wachen, 400 Fahrzeuge, 300 Einsätze) in Dev- und Produktions-Build.
- Spiellogik: Simulator bis 300 gleichzeitige Einsätze / 400 Fahrzeuge.

## 10. Performance-Ergebnisse
| Test | Ergebnis |
|---|---|
| master-API 1.000 Verbindungen | 7.515 Anfragen/s, 0 Fehler, p95 221 ms |
| Speichern 8 KB, 20 Konten | 2.066/s, p95 18 ms, 0 Fehler |
| Speichern 314 KB, 50 Konten | 121/s, p95 643 ms, 0 Fehler |
| Speichern 3 MB, 10 Konten | 11/s, p95 4,3 s, max 8 s, 0 Fehler |
| Spiel-Tick bei 300 Einsätzen | Ø 3,7 ms, max 26 ms |
| Oberfläche Riesen-Stand (Produktion) | Laden 441 ms, 1 Hänger (87 ms) in 15 s, 23 MB Heap |
| Server-RAM unter Last | 90 MB → 400 MB (3-MB-Stände), kein Absturz |

## 11. Sicherheitsprüfung
Bestanden: Passwort-Hashing (bcrypt), gehashte Sitzungs-/Reset-Tokens, keine Konto-Aufzählung, Brute-Force-Bremsen,
Rollen-/Rangprüfung, Datenisolation (kein IDOR), parametrisierte SQL-Abfragen (Injection-Versuche abgelehnt),
Bildprüfung per Magic Bytes, CSRF-Schutz über SameSite + CORS ohne Credentials, Bot-API zeitkonstant + nur lokal,
Discord-OAuth mit `state`, Security-Header auf test.leitstellendispo.de (HSTS, X-Frame-Options, nosniff, Referrer-Policy;
keine CSP). Befunde: QA-01–04 (behoben), QA-06, QA-08, QA-09, V-01–V-03.

## 12. Serverabstürze und Neustarts
Keine Abstürze, auch nicht unter Volllast. Es wurde **kein** echter Server neu gestartet: Es gibt keinen Zugang (SSH/
systemd) zu `test`/live, keine Neustart-Workflows im Repo. Lokale Testserver habe ich selbst gestartet/beendet.

## 13. Technische Änderungen (aktueller Stand, Commit 6bfabfe)
- `pruefeGuthaben` mit optionalen Server-Regeln (Gutschriften gegen `spielstand_korrekturen`, Dev-Recht, Kredit);
  nicht gedeckte Buchungen werden nicht gespeichert; Standardverhalten unverändert.
- Neues Spiel/erster Stand gegen leeren Start, `begrenzeStartbuchung`, `erlaubteKreditAuszahlung`, `pruefeLaufbahn`.
- Ruf-Begrenzung und Laufbahn-Validierung beim Speichern; Protokolleinträge „Laufbahn korrigiert“.
- Patch-Updates der Abhängigkeiten (`package-lock.json`).

## 14. Geänderte Dateien
Aktueller Stand (Commit 6bfabfe): `shared/src/plausibilitaet.ts`, `shared/src/plausibilitaet.test.ts`, `server/src/spielstand.ts`,
`server/src/spielstand.test.ts`, `docs/CHANGELOG.md`, `package-lock.json`, dieser Bericht.
master-Stand (gepusht, Commits fdb5a83 + b577460): `client/src/App.tsx`, `App.css`, `main.tsx`, `Fehlergrenze.tsx` (neu),
`useSpiel.ts`, `views/EinsaetzeView.tsx`, `views/WachenView.tsx`, `server/src/index.ts`, `shared/src/alarmierung.ts`
(+Test), `shared/src/spielstand.ts` (+Test), `shared/src/konfig.ts`, `docs/CHANGELOG.md`, `package-lock.json`.

## 15. GitHub-Aktivitäten
- Branch `claude/leitstellendispo-qa-night-xxnf6i`:
  - 2 frühe Commits auf Basis des veralteten `master` (fdb5a83, b577460)
  - Härtung auf Basis von `test`: Commit 6bfabfe, danach Merge 37398e9 (Strategie „ours“: die alten master-Commits stehen
    in der History, der Dateistand ist exakt `test` + Härtung). Kein Force-Push.
  - Zwischenzeitlich hatte die Sicherheitsprüfung der Sitzung einen Force-Push und kurz auch `git log` blockiert.
- **Nicht** auf `test` gepusht (wäre ein automatisches Deployment auf test.leitstellendispo.de ohne Freigabe).
  Übernahme z. B. per `git checkout feature/ruf-und-wachenverwaltung && git pull --rebase origin test &&
  git cherry-pick 6bfabfe` und danach wie gewohnt auf `test`.
- Keine Pull Requests, keine Änderungen an GitHub Actions.

## 16. Nicht getestete Bereiche
Echter Mailversand (SMTP), Discord-Bot selbst (eigener Dienst), OSRM-Straßenrouting (lokal nicht vorhanden),
Funktionstests auf test.leitstellendispo.de (dort brauchen Konten eine Freischaltung), Live-Server, Wetter/Kredit/Ausbildung/
AAO/Krankenhausbau in der Oberfläche einzeln (nur über Unit-Tests abgedeckt), Team-Bereich in der Oberfläche,
Bot-Werkzeug, Datensicherung/Wiederherstellung. (Handy-Ansicht der neuen Oberfläche nachträglich geprüft: Karte, Einsätze,
Einstellungen auf iPhone 13 und Pixel 7 → QA-12, QA-13.)

## 17. Verbleibende Risiken
- Spiel läuft im Browser: Einnahmen aus Einsätzen kann der Server grundsätzlich nicht nachrechnen – der Schummelschutz
  bleibt eine Plausibilitätsprüfung (jetzt deutlich härter, aber nicht lückenlos).
- Mehrgeräte-Datenverlust (QA-05) vor dem Beta-Start wahrscheinlich das größte Spielerrisiko.
- Bereits manipulierte Bestenlisten-Einträge bleiben nach dem Deployment bestehen.
- Test und Live teilen sich eine Maschine: Last oder Fehler auf test können live treffen.

## 18. Konkrete Empfehlungen (nach Priorität)
1. Härtung QA-01–04 (Commit 6bfabfe) prüfen und auf `test` bringen; auf test.leitstellendispo.de Schichtzulage, Team-Korrektur,
   Kredit aufnehmen/ablösen und „Neues Spiel“ einmal durchspielen; danach live. Bestenliste anschließend sichten.
2. QA-05 vor der Beta: Versionsnummer beim Laden mitgeben, beim Speichern mitschicken, Server antwortet bei veraltetem
   Stand mit 409, Client zeigt „Dein Spiel wurde auf einem anderen Gerät geändert – neu laden?“ und speichert nicht weiter.
3. QA-06: Speichern pro Konto drosseln (z. B. max. 1 PUT/s, 429), langfristig Stand verkleinern.
4. QA-07: Transaktionsverlauf auf z. B. 1.000 Einträge kappen und Summen separat führen; bei 413 Spieler sichtbar warnen.
5. nginx-Konfiguration (V-01) und `NODE_ENV=production` (V-02) prüfen.
6. nodemailer auf 10.x mit einem echten Test-Mailversand aktualisieren.
7. Fehlergrenze und Nominatim-Drosselung aus dem master-Branch übernehmen (QA-10, QA-11).
8. Mittelfristig: Test-Server auf eigene Maschine, um Live vor Testlast zu schützen.
