// Datenzugriff für Benutzerkonten und Sitzungen
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Konto, UserRole } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';

export const SITZUNG_DAUER_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

interface BenutzerZeile {
  id: number;
  name: string;
  passwort_hash: string;
  rolle: UserRole;
  gesperrt: number;
  erstellt: string;
}

export type AnmeldeErgebnis =
  | { ok: true; konto: Konto }
  | { ok: false; grund: 'falsche_daten' | 'gesperrt' };

function zuKonto(z: BenutzerZeile): Konto {
  return { id: z.id, name: z.name, rolle: z.rolle, erstellt: z.erstellt };
}

/** Sitzungstokens werden nur gehasht gespeichert – ein Datenbank-Leak verrät keine gültigen Cookies. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function erstelleKontenDienst(db: Datenbank, optionen: { bcryptRunden?: number } = {}) {
  const runden = optionen.bcryptRunden ?? 12;
  // Vergleichs-Hash für unbekannte Namen, damit die Antwortzeit nicht verrät, ob ein Konto existiert
  const platzhalterHash = bcrypt.hashSync('platzhalter-passwort', runden);

  const sql = {
    anzahlBenutzer: db.prepare('SELECT COUNT(*) AS anzahl FROM benutzer'),
    benutzerNachName: db.prepare('SELECT * FROM benutzer WHERE name = ?'),
    benutzerAnlegen: db.prepare('INSERT INTO benutzer (name, passwort_hash, rolle) VALUES (?, ?, ?) RETURNING *'),
    sitzungAnlegen: db.prepare('INSERT INTO sitzungen (token_hash, benutzer_id, erstellt, laeuft_ab) VALUES (?, ?, ?, ?)'),
    sitzungLoeschen: db.prepare('DELETE FROM sitzungen WHERE token_hash = ?'),
    abgelaufeneLoeschen: db.prepare('DELETE FROM sitzungen WHERE laeuft_ab <= ?'),
    benutzerZurSitzung: db.prepare(`
      SELECT b.* FROM sitzungen s JOIN benutzer b ON b.id = s.benutzer_id
      WHERE s.token_hash = ? AND s.laeuft_ab > ?`),
  };

  // Anzahl prüfen und Anlegen in einer Transaktion: Nur das allererste Konto wird Owner.
  const registriereTransaktion = db.transaction((name: string, hash: string): Konto | null => {
    if (sql.benutzerNachName.get(name)) return null;
    const { anzahl } = sql.anzahlBenutzer.get() as { anzahl: number };
    const rolle: UserRole = anzahl === 0 ? 'owner' : 'player';
    return zuKonto(sql.benutzerAnlegen.get(name, hash, rolle) as BenutzerZeile);
  });

  return {
    /** Legt ein Konto an. `null`, wenn der Name (ohne Groß-/Kleinschreibung) schon vergeben ist. */
    async registriere(name: string, passwort: string): Promise<Konto | null> {
      const hash = await bcrypt.hash(passwort, runden);
      return registriereTransaktion(name, hash);
    },

    async pruefeAnmeldung(name: string, passwort: string): Promise<AnmeldeErgebnis> {
      const zeile = sql.benutzerNachName.get(name) as BenutzerZeile | undefined;
      const passt = await bcrypt.compare(passwort, zeile?.passwort_hash ?? platzhalterHash);
      if (!zeile || !passt) return { ok: false, grund: 'falsche_daten' };
      if (zeile.gesperrt) return { ok: false, grund: 'gesperrt' };
      return { ok: true, konto: zuKonto(zeile) };
    },

    /** Startet eine Sitzung und gibt das (ungehashte) Token für das Cookie zurück. */
    starteSitzung(benutzerId: number, jetzt = Date.now()): string {
      sql.abgelaufeneLoeschen.run(jetzt);
      const token = randomBytes(32).toString('base64url');
      sql.sitzungAnlegen.run(hashToken(token), benutzerId, jetzt, jetzt + SITZUNG_DAUER_MS);
      return token;
    },

    /** Konto zur Sitzung – `null` bei unbekannter/abgelaufener Sitzung oder gesperrtem Konto. */
    kontoZurSitzung(token: string, jetzt = Date.now()): Konto | null {
      const zeile = sql.benutzerZurSitzung.get(hashToken(token), jetzt) as BenutzerZeile | undefined;
      if (!zeile || zeile.gesperrt) return null;
      return zuKonto(zeile);
    },

    beendeSitzung(token: string): void {
      sql.sitzungLoeschen.run(hashToken(token));
    },
  };
}

export type KontenDienst = ReturnType<typeof erstelleKontenDienst>;
