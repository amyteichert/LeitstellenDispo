// Datenzugriff für Benutzerkonten, Sitzungen und Passwort-Zurücksetzung
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { normalisiereEmail, type Konto, type UserRole } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';

export const SITZUNG_DAUER_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage
/** So lange gilt ein Link zum Zurücksetzen des Passworts */
export const PASSWORT_TOKEN_DAUER_MS = 60 * 60 * 1000; // 1 Stunde

interface BenutzerZeile {
  id: number;
  name: string;
  passwort_hash: string;
  rolle: UserRole;
  gesperrt: number;
  erstellt: string;
  email: string | null;
}

export type AnmeldeErgebnis =
  | { ok: true; konto: Konto }
  | { ok: false; grund: 'falsche_daten' | 'gesperrt' };

export type RegistrierErgebnis =
  | { ok: true; konto: Konto }
  | { ok: false; grund: 'name_vergeben' | 'email_vergeben' };

function zuKonto(z: BenutzerZeile): Konto {
  return { id: z.id, name: z.name, rolle: z.rolle, erstellt: z.erstellt, email: z.email };
}

/** Tokens werden nur gehasht gespeichert – ein Datenbank-Leak verrät keine gültigen Cookies oder Links. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function erstelleKontenDienst(db: Datenbank, optionen: { bcryptRunden?: number } = {}) {
  const runden = optionen.bcryptRunden ?? 12;
  // Vergleichs-Hash für unbekannte Namen, damit die Antwortzeit nicht verrät, ob ein Konto existiert
  const platzhalterHash = bcrypt.hashSync('platzhalter-passwort', runden);

  const sql = {
    anzahlBenutzer: db.prepare('SELECT COUNT(*) AS anzahl FROM benutzer'),
    benutzerNachId: db.prepare('SELECT * FROM benutzer WHERE id = ?'),
    benutzerNachName: db.prepare('SELECT * FROM benutzer WHERE name = ?'),
    benutzerNachEmail: db.prepare('SELECT * FROM benutzer WHERE email = ?'),
    benutzerAnlegen: db.prepare('INSERT INTO benutzer (name, email, passwort_hash, rolle) VALUES (?, ?, ?, ?) RETURNING *'),
    emailSetzen: db.prepare('UPDATE benutzer SET email = ? WHERE id = ?'),
    passwortSetzen: db.prepare('UPDATE benutzer SET passwort_hash = ? WHERE id = ?'),
    sitzungAnlegen: db.prepare('INSERT INTO sitzungen (token_hash, benutzer_id, erstellt, laeuft_ab) VALUES (?, ?, ?, ?)'),
    sitzungLoeschen: db.prepare('DELETE FROM sitzungen WHERE token_hash = ?'),
    andereSitzungenLoeschen: db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ? AND token_hash != ?'),
    alleSitzungenLoeschen: db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ?'),
    abgelaufeneLoeschen: db.prepare('DELETE FROM sitzungen WHERE laeuft_ab <= ?'),
    benutzerZurSitzung: db.prepare(`
      SELECT b.* FROM sitzungen s JOIN benutzer b ON b.id = s.benutzer_id
      WHERE s.token_hash = ? AND s.laeuft_ab > ?`),
    tokenAnlegen: db.prepare('INSERT INTO passwort_tokens (token_hash, benutzer_id, laeuft_ab) VALUES (?, ?, ?)'),
    tokensDesBenutzersLoeschen: db.prepare('DELETE FROM passwort_tokens WHERE benutzer_id = ?'),
    abgelaufeneTokensLoeschen: db.prepare('DELETE FROM passwort_tokens WHERE laeuft_ab <= ?'),
    benutzerZumToken: db.prepare(`
      SELECT b.* FROM passwort_tokens t JOIN benutzer b ON b.id = t.benutzer_id
      WHERE t.token_hash = ? AND t.laeuft_ab > ?`),
  };

  const emailVergeben = (email: string, ausserId?: number) => {
    const zeile = sql.benutzerNachEmail.get(email) as BenutzerZeile | undefined;
    return Boolean(zeile && zeile.id !== ausserId);
  };

  // Anzahl prüfen und Anlegen in einer Transaktion: Nur das allererste Konto wird Owner.
  const registriereTransaktion = db.transaction((name: string, email: string, hash: string): RegistrierErgebnis => {
    if (sql.benutzerNachName.get(name)) return { ok: false, grund: 'name_vergeben' };
    if (emailVergeben(email)) return { ok: false, grund: 'email_vergeben' };
    const { anzahl } = sql.anzahlBenutzer.get() as { anzahl: number };
    const rolle: UserRole = anzahl === 0 ? 'owner' : 'player';
    return { ok: true, konto: zuKonto(sql.benutzerAnlegen.get(name, email, hash, rolle) as BenutzerZeile) };
  });

  const pruefePasswortVon = async (id: number, passwort: string) => {
    const zeile = sql.benutzerNachId.get(id) as BenutzerZeile | undefined;
    return Boolean(zeile && await bcrypt.compare(passwort, zeile.passwort_hash));
  };

  return {
    /** Legt ein Konto an. Name und E-Mail müssen (ohne Groß-/Kleinschreibung) frei sein. */
    async registriere(name: string, email: string, passwort: string): Promise<RegistrierErgebnis> {
      const hash = await bcrypt.hash(passwort, runden);
      return registriereTransaktion(name, normalisiereEmail(email), hash);
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

    /** E-Mail ändern bzw. nachtragen – nur mit aktuellem Passwort. */
    async aendereEmail(id: number, email: string, passwort: string): Promise<'ok' | 'falsches_passwort' | 'email_vergeben'> {
      if (!(await pruefePasswortVon(id, passwort))) return 'falsches_passwort';
      const neu = normalisiereEmail(email);
      if (emailVergeben(neu, id)) return 'email_vergeben';
      sql.emailSetzen.run(neu, id);
      return 'ok';
    },

    /** Passwort ändern – nur mit dem alten. Alle anderen Sitzungen (andere Geräte) werden beendet. */
    async aenderePasswort(id: number, altesPasswort: string, neuesPasswort: string, aktuellesSitzungsToken: string): Promise<boolean> {
      if (!(await pruefePasswortVon(id, altesPasswort))) return false;
      const hash = await bcrypt.hash(neuesPasswort, runden);
      db.transaction(() => {
        sql.passwortSetzen.run(hash, id);
        sql.andereSitzungenLoeschen.run(id, hashToken(aktuellesSitzungsToken));
        sql.tokensDesBenutzersLoeschen.run(id);
      })();
      return true;
    },

    /** Konto zu einer E-Mail-Adresse (für „Passwort vergessen“). */
    kontoNachEmail(email: string): Konto | null {
      const zeile = sql.benutzerNachEmail.get(normalisiereEmail(email)) as BenutzerZeile | undefined;
      return zeile && !zeile.gesperrt ? zuKonto(zeile) : null;
    },

    /** Neues Zurücksetzungs-Token (ältere des Kontos werden ungültig). Gibt das ungehashte Token zurück. */
    erstellePasswortToken(benutzerId: number, jetzt = Date.now()): { token: string; laeuftAb: number } {
      const token = randomBytes(32).toString('base64url');
      const laeuftAb = jetzt + PASSWORT_TOKEN_DAUER_MS;
      db.transaction(() => {
        sql.abgelaufeneTokensLoeschen.run(jetzt);
        sql.tokensDesBenutzersLoeschen.run(benutzerId);
        sql.tokenAnlegen.run(hashToken(token), benutzerId, laeuftAb);
      })();
      return { token, laeuftAb };
    },

    /** Setzt das Passwort per Token. Danach sind das Token und alle Sitzungen des Kontos ungültig. */
    async setzePasswortMitToken(token: string, neuesPasswort: string, jetzt = Date.now()): Promise<Konto | null> {
      const zeile = sql.benutzerZumToken.get(hashToken(token), jetzt) as BenutzerZeile | undefined;
      if (!zeile || zeile.gesperrt) return null;
      const hash = await bcrypt.hash(neuesPasswort, runden);
      db.transaction(() => {
        sql.passwortSetzen.run(hash, zeile.id);
        sql.tokensDesBenutzersLoeschen.run(zeile.id);
        sql.alleSitzungenLoeschen.run(zeile.id);
      })();
      return zuKonto(zeile);
    },
  };
}

export type KontenDienst = ReturnType<typeof erstelleKontenDienst>;
