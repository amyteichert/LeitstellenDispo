import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type Datenbank = Database.Database;

/** Standardpfad: server/data/leitstellendispo.db (gilt für src/ und dist/ gleichermaßen) */
export const STANDARD_DATENBANK_PFAD = fileURLToPath(new URL('../data/leitstellendispo.db', import.meta.url));

/**
 * Schema-Migrationen in fester Reihenfolge. Der Stand wird in `PRAGMA user_version` gemerkt;
 * neue Änderungen kommen immer als weiterer Eintrag hinten dazu, alte Einträge bleiben unverändert.
 */
const MIGRATIONEN: string[] = [
  `
  CREATE TABLE benutzer (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    passwort_hash TEXT    NOT NULL,
    rolle         TEXT    NOT NULL DEFAULT 'player'
                  CHECK (rolle IN ('player', 'admin', 'co_owner', 'owner')),
    gesperrt      INTEGER NOT NULL DEFAULT 0,
    erstellt      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE sitzungen (
    token_hash  TEXT    PRIMARY KEY,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    erstellt    INTEGER NOT NULL,
    laeuft_ab   INTEGER NOT NULL
  );
  CREATE INDEX sitzungen_benutzer ON sitzungen(benutzer_id);

  -- Wird ab Phase 2 (Spielstand pro Konto) befüllt
  CREATE TABLE spielstaende (
    benutzer_id  INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
    daten        TEXT    NOT NULL,
    aktualisiert TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,
  // 2: Markierung für Konten, die Dev-Werkzeuge benutzt haben (zählen nicht für die Bestenliste)
  `
  ALTER TABLE benutzer ADD COLUMN dev_markiert INTEGER NOT NULL DEFAULT 0;
  `,
  // 3: E-Mail-Adresse (Pflicht für neue Konten, ältere tragen sie nach) und Tokens zum Zurücksetzen des Passworts
  `
  ALTER TABLE benutzer ADD COLUMN email TEXT;
  CREATE UNIQUE INDEX benutzer_email ON benutzer(email) WHERE email IS NOT NULL;

  CREATE TABLE passwort_tokens (
    token_hash  TEXT    PRIMARY KEY,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    laeuft_ab   INTEGER NOT NULL
  );
  `,
  // 4: Team-Werkzeuge – Aktivitäts-Protokoll, Notizen zu Konten, Ankündigung an alle, Spielstand-Korrekturen
  `
  -- Ziel ohne Fremdschlüssel: Einträge bleiben auch nach dem Löschen eines Kontos erhalten
  CREATE TABLE team_protokoll (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    zeit      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    von_name  TEXT    NOT NULL,
    aktion    TEXT    NOT NULL,
    ziel_name TEXT,
    details   TEXT
  );

  CREATE TABLE konto_notizen (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    von_name    TEXT    NOT NULL,
    text        TEXT    NOT NULL,
    zeit        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX konto_notizen_benutzer ON konto_notizen(benutzer_id);

  -- Höchstens eine aktive Ankündigung
  CREATE TABLE ankuendigung (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    text     TEXT    NOT NULL,
    art      TEXT    NOT NULL DEFAULT 'info' CHECK (art IN ('info', 'wartung', 'wichtig')),
    von_name TEXT    NOT NULL,
    zeit     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE spielstand_korrekturen (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id        INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    guthaben_aenderung INTEGER NOT NULL DEFAULT 0,
    ruf_neu            INTEGER,
    grund              TEXT    NOT NULL,
    von_name           TEXT    NOT NULL,
    zeit               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    eingebucht         INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX spielstand_korrekturen_offen ON spielstand_korrekturen(benutzer_id, eingebucht);
  `,
];

/** Öffnet (bzw. erstellt) die Datenbank und bringt das Schema auf den neuesten Stand. */
export function oeffneDatenbank(pfad: string = STANDARD_DATENBANK_PFAD): Datenbank {
  if (pfad !== ':memory:') mkdirSync(dirname(pfad), { recursive: true });

  const db = new Database(pfad);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const version = db.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRATIONEN.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONEN[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
  return db;
}
