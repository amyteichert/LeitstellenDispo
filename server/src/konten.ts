// Datenzugriff für Benutzerkonten, Sitzungen und Passwort-Zurücksetzung
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getNameAenderbarAb, normalisiereEmail, type Konto, type OffenesBild, type UserRole } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';

export const SITZUNG_DAUER_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage
/** So lange gilt ein Link zum Zurücksetzen des Passworts */
export const PASSWORT_TOKEN_DAUER_MS = 60 * 60 * 1000; // 1 Stunde
/** So lange wartet ein neues Konto auf Freischaltung, danach wird es gelöscht */
export const FREISCHALTUNG_FRIST_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

interface BenutzerZeile {
  id: number;
  name: string;
  passwort_hash: string;
  rolle: UserRole;
  gesperrt: number;
  erstellt: string;
  email: string | null;
  spitzname: string | null;
  avatar: string | null;
  name_geaendert: string | null;
  freigegeben: number;
}

export type AnmeldeErgebnis =
  | { ok: true; konto: Konto }
  | { ok: false; grund: 'falsche_daten' | 'gesperrt' | 'nicht_freigegeben' };

export type RegistrierErgebnis =
  | { ok: true; konto: Konto; wartetAufFreischaltung: boolean }
  | { ok: false; grund: 'name_vergeben' | 'email_vergeben' };

function zuKonto(z: BenutzerZeile): Konto {
  return {
    id: z.id, name: z.name, rolle: z.rolle, erstellt: z.erstellt, email: z.email,
    spitzname: z.spitzname, avatar: z.avatar, nameGeaendert: z.name_geaendert,
  };
}

/** Tokens werden nur gehasht gespeichert – ein Datenbank-Leak verrät keine gültigen Cookies oder Links. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function erstelleKontenDienst(db: Datenbank, optionen: { bcryptRunden?: number; freischaltungNoetig?: boolean } = {}) {
  const runden = optionen.bcryptRunden ?? 12;
  const freischaltungNoetig = optionen.freischaltungNoetig ?? false;
  // Vergleichs-Hash für unbekannte Namen, damit die Antwortzeit nicht verrät, ob ein Konto existiert
  const platzhalterHash = bcrypt.hashSync('platzhalter-passwort', runden);

  const sql = {
    benutzerNachId: db.prepare('SELECT * FROM benutzer WHERE id = ?'),
    benutzerNachName: db.prepare('SELECT * FROM benutzer WHERE name = ?'),
    benutzerNachEmail: db.prepare('SELECT * FROM benutzer WHERE email = ?'),
    benutzerAnlegen: db.prepare('INSERT INTO benutzer (name, email, passwort_hash, rolle, freigegeben) VALUES (?, ?, ?, ?, ?) RETURNING *'),
    freischalten: db.prepare('UPDATE benutzer SET freigegeben = 1 WHERE id = ? AND freigegeben = 0'),
    alteUnfreigegebene: db.prepare('DELETE FROM benutzer WHERE freigegeben = 0 AND erstellt < ? RETURNING name'),
    ownerMails: db.prepare("SELECT email FROM benutzer WHERE rolle = 'owner' AND email IS NOT NULL"),
    protokollieren: db.prepare('INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES (?, ?, ?, ?)'),
    emailSetzen: db.prepare('UPDATE benutzer SET email = ? WHERE id = ?'),
    passwortSetzen: db.prepare('UPDATE benutzer SET passwort_hash = ? WHERE id = ?'),
    profilSetzen: db.prepare('UPDATE benutzer SET spitzname = ?, avatar = ? WHERE id = ?'),
    nameSetzen: db.prepare(`UPDATE benutzer SET name = ?, name_geaendert = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`),
    bildSetzen: db.prepare('INSERT INTO profilbilder (benutzer_id, daten, typ, geprueft) VALUES (?, ?, ?, 0) ON CONFLICT (benutzer_id) DO UPDATE SET daten = excluded.daten, typ = excluded.typ, geprueft = 0'),
    bildFreigeben: db.prepare('UPDATE profilbilder SET geprueft = 1 WHERE benutzer_id = ?'),
    offeneBilder: db.prepare('SELECT b.id, b.name, b.spitzname, b.avatar FROM profilbilder p JOIN benutzer b ON b.id = p.benutzer_id WHERE p.geprueft = 0 ORDER BY b.avatar'),
    bildLoeschen: db.prepare('DELETE FROM profilbilder WHERE benutzer_id = ?'),
    bild: db.prepare('SELECT daten, typ, geprueft FROM profilbilder WHERE benutzer_id = ?'),
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

  // Name/E-Mail prüfen und Anlegen in einer Transaktion. Jedes neue Konto ist Spieler –
  // Owner wird man nur über die Kommandozeile (rolleSetzen.js), nie automatisch.
  const registriereTransaktion = db.transaction((name: string, email: string, hash: string): RegistrierErgebnis => {
    if (sql.benutzerNachName.get(name)) return { ok: false, grund: 'name_vergeben' };
    if (emailVergeben(email)) return { ok: false, grund: 'email_vergeben' };
    const zeile = sql.benutzerAnlegen.get(name, email, hash, 'player', freischaltungNoetig ? 0 : 1) as BenutzerZeile;
    return { ok: true, konto: zuKonto(zeile), wartetAufFreischaltung: !zeile.freigegeben };
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
      if (!zeile.freigegeben) return { ok: false, grund: 'nicht_freigegeben' };
      return { ok: true, konto: zuKonto(zeile) };
    },

    /** Startet eine Sitzung und gibt das (ungehashte) Token für das Cookie zurück. */
    starteSitzung(benutzerId: number, jetzt = Date.now()): string {
      sql.abgelaufeneLoeschen.run(jetzt);
      const token = randomBytes(32).toString('base64url');
      sql.sitzungAnlegen.run(hashToken(token), benutzerId, jetzt, jetzt + SITZUNG_DAUER_MS);
      return token;
    },

    /** Konto zur Sitzung – `null` bei unbekannter/abgelaufener Sitzung, gesperrtem oder nicht freigeschaltetem Konto. */
    kontoZurSitzung(token: string, jetzt = Date.now()): Konto | null {
      const zeile = sql.benutzerZurSitzung.get(hashToken(token), jetzt) as BenutzerZeile | undefined;
      if (!zeile || zeile.gesperrt || !zeile.freigegeben) return null;
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

    konto(id: number): Konto | null {
      const zeile = sql.benutzerNachId.get(id) as BenutzerZeile | undefined;
      return zeile ? zuKonto(zeile) : null;
    },

    /** Spitzname und Profilbild-Vorlage setzen. Eine Vorlage (oder kein Bild) ersetzt ein hochgeladenes Bild. */
    setzeProfil(id: number, spitzname: string | null, avatar: string | null): void {
      db.transaction(() => {
        sql.profilSetzen.run(spitzname, avatar, id);
        if (!avatar?.startsWith('bild:')) sql.bildLoeschen.run(id);
      })();
    },

    /** Benutzername ändern – nur mit Passwort, höchstens alle 30 Tage und nur, wenn der Name frei ist. */
    async aendereName(id: number, name: string, passwort: string, jetzt = Date.now()): Promise<'ok' | 'falsches_passwort' | 'zu_frueh' | 'name_vergeben'> {
      if (!(await pruefePasswortVon(id, passwort))) return 'falsches_passwort';
      const zeile = sql.benutzerNachId.get(id) as BenutzerZeile;
      if (jetzt < getNameAenderbarAb(zeile.name_geaendert)) return 'zu_frueh';
      const anderer = sql.benutzerNachName.get(name) as BenutzerZeile | undefined;
      if (anderer && anderer.id !== id) return 'name_vergeben';
      sql.nameSetzen.run(name, id);
      return 'ok';
    },

    /** Hochgeladenes Profilbild speichern (wartet auf Freigabe); `avatar` bekommt einen neuen Stand, damit Browser nicht das alte zeigen */
    setzeBild(id: number, daten: Buffer, typ: string): void {
      db.transaction(() => {
        sql.bildSetzen.run(id, daten, typ);
        const zeile = sql.benutzerNachId.get(id) as BenutzerZeile;
        sql.profilSetzen.run(zeile.spitzname, `bild:${Date.now()}`, id);
      })();
    },

    /** Hochgeladenes Bild entfernen (auch durch das Team) – danach zeigt das Spiel den Anfangsbuchstaben */
    entferneBild(id: number): void {
      db.transaction(() => {
        sql.bildLoeschen.run(id);
        db.prepare("UPDATE benutzer SET avatar = NULL WHERE id = ? AND avatar LIKE 'bild:%'").run(id);
      })();
    },

    ladeBild(id: number): { daten: Buffer; typ: string; geprueft: boolean } | null {
      const zeile = sql.bild.get(id) as { daten: Buffer; typ: string; geprueft: number } | undefined;
      return zeile ? { ...zeile, geprueft: zeile.geprueft === 1 } : null;
    },

    /** Profilbild für alle sichtbar machen (Team) – false, wenn es kein Bild gibt */
    gibBildFrei(id: number): boolean {
      return sql.bildFreigeben.run(id).changes > 0;
    },

    /** Hochgeladene Profilbilder, die noch auf Freigabe warten – älteste zuerst */
    offeneBilder(): OffenesBild[] {
      return sql.offeneBilder.all() as OffenesBild[];
    },

    /** Neues Konto freischalten (Team) – false, wenn es nicht (mehr) auf Freischaltung wartet */
    schalteFrei(id: number): boolean {
      return sql.freischalten.run(id).changes > 0;
    },

    /** Löscht Konten, die länger als die Frist auf Freischaltung warten, und hält das im Team-Protokoll fest */
    loescheUnfreigegebene(jetzt = Date.now()): string[] {
      return db.transaction(() => {
        const grenze = new Date(jetzt - FREISCHALTUNG_FRIST_MS).toISOString();
        const namen = (sql.alteUnfreigegebene.all(grenze) as Array<{ name: string }>).map((z) => z.name);
        for (const name of namen) sql.protokollieren.run('System', 'Konto gelöscht', name, 'nach 7 Tagen nicht freigeschaltet');
        return namen;
      })();
    },

    /** E-Mail-Adressen aller Owner (für Benachrichtigungen) */
    ownerMails(): string[] {
      return (sql.ownerMails.all() as Array<{ email: string }>).map((z) => z.email);
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
