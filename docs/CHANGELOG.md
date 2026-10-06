# Changelog

Alle wichtigen Änderungen an LeitstellenDispo werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/).

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
