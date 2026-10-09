# LeitstellenDispo

**Deine Leitstelle. Deine Einsätze. Deine Entscheidungen.**

Browserbasierte Leitstellen-Simulation – eigenständiges Projekt, inspiriert vom Spielprinzip von Leitstellenspiel.de.

**Aktuelle Version:** V0.1.0-alpha (Phase 0 – Projekt-Setup)

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) Version 20 oder höher (LTS empfohlen)
- npm (wird mit Node.js mitgeliefert)
- [Git](https://git-scm.com/) (optional, für Versionskontrolle)

> **Hinweis:** Node.js muss einmalig installiert werden. Danach Terminal/Cursor neu starten, damit `npm` erkannt wird.

---

## Installation

Im Projektordner `LeitstellenSpiel` im Terminal ausführen:

```bash
npm install
npm run build --workspace=shared
```

---

## Entwicklung starten

```bash
npm run dev
```

Das startet gleichzeitig:

- **Frontend** (React): http://localhost:5173
- **Backend** (Express): http://localhost:3001

---

## Projektstruktur

```
LeitstellenDispo/
├── client/     → Frontend (React + TypeScript + Vite)
├── server/     → Backend (Node.js + Express + TypeScript)
├── shared/     → Gemeinsame Konstanten und Typen
└── docs/       → Dokumentation und Changelog
```

---

## API (Phase 0)

| Endpunkt       | Beschreibung              |
|----------------|---------------------------|
| GET /api/health | Server-Status prüfen     |
| GET /api/info   | App-Name, Version, etc.  |
| GET /api/einsaetze | Beispiel-Einsätze (mit Adresse) |
| GET /api/fahrzeugtypen | Zentraler Fahrzeugkatalog (Preis, Geschwindigkeit, Besatzung, Fähigkeiten) |

---

## Tests

```bash
npm test
```

Prüft die Typen und führt alle Tests der Spiellogik (`shared`) aus.

---

## Entwicklungsphasen

| Phase | Version         | Status |
|-------|-----------------|--------|
| 0     | V0.1.0-alpha    | ✅ Aktuell |
| 1     | V0.2.0-alpha    | Geplant |
| 2     | V0.3.0-alpha    | Geplant |

Details siehe `docs/CHANGELOG.md`.

---

## Kosten

Entwicklung läuft **komplett kostenlos lokal**. Es werden keine kostenpflichtigen Dienste verwendet.
