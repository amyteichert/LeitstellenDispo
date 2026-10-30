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
const MIGRATIONEN: Array<string | ((db: Datenbank) => void)> = [
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
  // Besucherstatistik der Website: anonym, ohne IP – besucher ist ein täglich wechselnder Code
  `
  CREATE TABLE website_aufrufe (
    id          TEXT    PRIMARY KEY,
    zeit        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    tag         TEXT    NOT NULL,
    besucher    TEXT    NOT NULL,
    seite       TEXT    NOT NULL,
    quelle_art  TEXT    NOT NULL,
    quelle_name TEXT,
    dauer_s     INTEGER NOT NULL DEFAULT 0,
    scroll      INTEGER NOT NULL DEFAULT 0,
    interaktion INTEGER NOT NULL DEFAULT 0,
    ziel        TEXT
  );
  CREATE INDEX website_aufrufe_tag ON website_aufrufe(tag);
  `,
  // Auch Aufrufe des Spiels zählen: info = leitstellendispo.de, spiel = spiel.leitstellendispo.de
  `
  ALTER TABLE website_aufrufe ADD COLUMN bereich TEXT NOT NULL DEFAULT 'info';
  `,
  // Schichtzulage (täglicher Bonus): letzter Tag und Serie pro Konto; Korrekturen bekommen eine Art (Team oder System)
  `
  CREATE TABLE schichtzulage (
    benutzer_id INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
    letzter_tag TEXT    NOT NULL,
    serie       INTEGER NOT NULL
  );
  ALTER TABLE spielstand_korrekturen ADD COLUMN art TEXT NOT NULL DEFAULT 'team';
  `,
  // Fehlermeldungen der Spieler („Fehler melden“) – mit Kontext für das Team
  `
  CREATE TABLE fehlermeldungen (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id INTEGER REFERENCES benutzer(id) ON DELETE SET NULL,
    name        TEXT    NOT NULL,
    text        TEXT    NOT NULL,
    kontext     TEXT    NOT NULL,
    zeit        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    erledigt    INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX fehlermeldungen_offen ON fehlermeldungen(erledigt, id);
  `,
  // Rolle „Tester“ erlauben. SQLite kann CHECK-Bedingungen nicht ändern, und ein Neuaufbau der Tabelle würde über
  // ON DELETE CASCADE Spielstände löschen. Daher nur die gespeicherte Tabellendefinition anpassen (SQLite-Doku, ALTER TABLE, Abschnitt 7).
  (db) => {
    const version = db.pragma('schema_version', { simple: true }) as number;
    db.pragma('writable_schema = ON');
    db.prepare(`UPDATE sqlite_schema SET sql = replace(sql, '''co_owner'', ''owner''))', '''co_owner'', ''owner'', ''tester''))')
      WHERE type = 'table' AND name = 'benutzer'`).run();
    db.pragma(`schema_version = ${version + 1}`);
    db.pragma('writable_schema = OFF');
  },
  // Ankündigungen mit Ablaufzeit: danach verschwinden sie von selbst (NULL = bis sie entfernt werden)
  `
  ALTER TABLE ankuendigung ADD COLUMN laeuft_ab TEXT;
  `,
  // Profil: Spitzname, Profilbild (Vorlage oder hochgeladen) und wann der Name zuletzt geändert wurde
  `
  ALTER TABLE benutzer ADD COLUMN spitzname TEXT;
  ALTER TABLE benutzer ADD COLUMN avatar TEXT;
  ALTER TABLE benutzer ADD COLUMN name_geaendert TEXT;
  CREATE TABLE profilbilder (
    benutzer_id INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
    daten       BLOB    NOT NULL,
    typ         TEXT    NOT NULL
  );
  `,
  // Bildprüfung: Neue Profilbilder sehen andere erst nach Freigabe durchs Team (bisherige gelten als geprüft)
  `
  ALTER TABLE profilbilder ADD COLUMN geprueft INTEGER NOT NULL DEFAULT 1;
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
    const migration = MIGRATIONEN[i];
    // Änderungen an der Tabellendefinition brauchen den „unsicheren“ Modus von better-sqlite3
    if (typeof migration !== 'string') db.unsafeMode(true);
    try {
      db.transaction(() => {
        if (typeof migration === 'string') db.exec(migration);
        else migration(db);
        db.pragma(`user_version = ${i + 1}`);
      })();
    } finally {
      if (typeof migration !== 'string') db.unsafeMode(false);
    }
  }
  return db;
}
