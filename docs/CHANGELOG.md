# Changelog

Alle wichtigen Änderungen an LeitstellenDispo werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased] – Bot, Simulation & Härtetest

### Hinzugefügt
- **Bot** (`shared/src/bot/`): spielt automatisch – alarmiert passende Fahrzeuge, kauft nach Bedarf, baut (je nach Ziel) Wachen.
  Ziele: Einsätze abarbeiten, Geld maximieren, Leitstelle ausbauen, schnellste Anfahrt, Chaos-Test
- **Simulation im Zeitraffer** (`simuliere` / schrittweiser `simulationsSchritt`): spielt Stunden/Tage ohne Browser durch
- **Fehlerwächter** (`pruefeSpielstand`): prüft Invarianten (Kontostand, doppelte Alarmierung, hängende Einsätze …) und meldet Probleme
- **Härtetest** (`haerteTest`): wirft den Spielfunktionen bösartige/kaputte Daten hin und prüft, ob etwas abstürzt
  (Robustheits-/Sicherheitstest für einen späteren Server)
- **Bot-Panel im Client** (Ansicht „Bot“): grüner Start/Stopp-Knopf, Geschwindigkeit, Ziel-Auswahl, Live-Protokoll,
  Besitz-Dashboard und Härtetest-Knopf – läuft auf einem **eigenen Spielstand** (dein Spiel bleibt unberührt)
- **CLI-Bot**: `npm run bot -- --tage 7 --ziel geld` bzw. `npm run bot:haertetest`
- **Spieleraktionen als reine Funktionen** in `shared/src/aktionen.ts` (Kaufen, Wache bauen/löschen, Alarmieren) –
  von Spieler-UI und Bot gemeinsam genutzt (keine doppelte Logik mehr)
- **Deterministischer Zufallsgenerator** (`shared/src/zufall.ts`) für reproduzierbare Bot-Läufe

### Geändert / Gehärtet
- `migriereSpielstand` prüft jetzt die Struktur jedes Einsatzes/Fahrzeugs: beschädigte oder manipulierte Spielstände
  werden sauber abgewiesen, statt später den Spiel-Tick zum Absturz zu bringen (Sicherheitsgrenze zum Server hin)

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
