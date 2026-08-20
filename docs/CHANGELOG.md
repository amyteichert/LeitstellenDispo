# Changelog

Alle wichtigen Änderungen an LeitstellenDispo werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/).

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
