// Benutzerkonten: gemeinsame Typen und Eingaberegeln für Server und Client
import type { UserRole } from './daten.js';

export const KONTO_REGELN = {
  nameMinLaenge: 3,
  nameMaxLaenge: 24,
  passwortMinLaenge: 8,
  /** bcrypt verarbeitet höchstens 72 Bytes – alles danach würde stillschweigend ignoriert */
  passwortMaxBytes: 72,
  emailMaxLaenge: 254,
} as const;

/** Öffentliche Sicht auf ein Konto (ohne Passwort-Hash) */
export interface Konto {
  id: number;
  name: string;
  rolle: UserRole;
  /** ISO-Zeitpunkt der Registrierung */
  erstellt: string;
  /** Nur im eigenen Konto und im Team-Bereich – fehlt bei Konten von vor der E-Mail-Pflicht (null) */
  email?: string | null;
}

const ERLAUBTE_NAMENSZEICHEN = /^[A-Za-z0-9ÄÖÜäöüß_.-]+$/;

/** Prüft einen Benutzernamen. Gibt eine Fehlermeldung zurück oder `null`, wenn er gültig ist. */
export function pruefeBenutzername(name: unknown): string | null {
  if (typeof name !== 'string') return 'Bitte einen Benutzernamen angeben.';
  const n = name.trim();
  if (n.length < KONTO_REGELN.nameMinLaenge || n.length > KONTO_REGELN.nameMaxLaenge) {
    return `Der Benutzername muss ${KONTO_REGELN.nameMinLaenge} bis ${KONTO_REGELN.nameMaxLaenge} Zeichen lang sein.`;
  }
  if (!ERLAUBTE_NAMENSZEICHEN.test(n)) {
    return 'Der Benutzername darf nur Buchstaben, Ziffern sowie _ . - enthalten.';
  }
  return null;
}

/** E-Mail-Adressen werden klein und ohne Leerzeichen gespeichert (eindeutig, unabhängig von der Schreibweise). */
export const normalisiereEmail = (email: string) => email.trim().toLowerCase();

/** Prüft eine E-Mail-Adresse (bewusst einfach: genau ein @, Punkt in der Domain, keine Leerzeichen). */
export function pruefeEmail(email: unknown): string | null {
  if (typeof email !== 'string' || email.trim().length === 0) return 'Bitte eine E-Mail-Adresse angeben.';
  const e = normalisiereEmail(email);
  if (e.length > KONTO_REGELN.emailMaxLaenge || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
    return 'Bitte eine gültige E-Mail-Adresse angeben.';
  }
  return null;
}

/**
 * Der Benutzername ist öffentlich – er darf nicht die E-Mail-Adresse verraten.
 * (Ein „@“ ist im Namen ohnehin nicht erlaubt; hier geht es um den Teil vor dem @.)
 */
export function pruefeNameGegenEmail(name: unknown, email: unknown): string | null {
  if (typeof name !== 'string' || typeof email !== 'string') return null;
  const lokalteil = normalisiereEmail(email).split('@')[0];
  if (lokalteil.length >= KONTO_REGELN.nameMinLaenge && name.trim().toLowerCase() === lokalteil) {
    return 'Dein Benutzername ist öffentlich sichtbar – bitte nicht den Teil deiner E-Mail-Adresse vor dem @ verwenden.';
  }
  return null;
}

/** Prüft ein Passwort. Gibt eine Fehlermeldung zurück oder `null`, wenn es gültig ist. */
export function pruefePasswort(passwort: unknown): string | null {
  if (typeof passwort !== 'string' || passwort.length === 0) return 'Bitte ein Passwort angeben.';
  if (passwort.length < KONTO_REGELN.passwortMinLaenge) {
    return `Das Passwort muss mindestens ${KONTO_REGELN.passwortMinLaenge} Zeichen lang sein.`;
  }
  if (new TextEncoder().encode(passwort).length > KONTO_REGELN.passwortMaxBytes) {
    return 'Das Passwort ist zu lang.';
  }
  return null;
}

/** Team-Rollen (Owner, Co-Owner, Admin) dürfen Testwerkzeuge wie den Test-Einsatz nutzen */
export function istTeamRolle(rolle: UserRole): boolean {
  return rolle === 'owner' || rolle === 'co_owner' || rolle === 'admin';
}

// ---------------------------------------------------------------------------
// Team-Bereich: Rangordnung und Verwaltung
// ---------------------------------------------------------------------------

export const ROLLEN_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-Owner',
  admin: 'Admin',
  player: 'Spieler',
};

/** Rang einer Rolle – man darf nur Konten mit niedrigerem Rang verwalten. */
export const ROLLEN_RANG: Record<UserRole, number> = { owner: 3, co_owner: 2, admin: 1, player: 0 };

/** Rollen, die der Owner vergeben kann (Owner selbst bleibt einmalig). */
export const VERGEBBARE_ROLLEN: UserRole[] = ['player', 'admin', 'co_owner'];

/** Darf `handelnd` das Konto `ziel` sperren, löschen oder zurücksetzen? Nie sich selbst, nur niedrigere Ränge. */
export function darfKontoVerwalten(handelnd: Pick<Konto, 'id' | 'rolle'>, ziel: Pick<Konto, 'id' | 'rolle'>): boolean {
  return handelnd.id !== ziel.id && istTeamRolle(handelnd.rolle) && ROLLEN_RANG[handelnd.rolle] > ROLLEN_RANG[ziel.rolle];
}

/**
 * Rollen vergeben Owner und Co-Owner – nur an Konten mit niedrigerem Rang und nur Rollen unter dem eigenen Rang.
 * Der Owner ernennt also Co-Owner, der Co-Owner nur Admins und Spieler. Nie an sich selbst, nie die Owner-Rolle.
 */
export function darfRolleVergeben(handelnd: Pick<Konto, 'id' | 'rolle'>, ziel: Pick<Konto, 'id' | 'rolle'>, neueRolle: UserRole): boolean {
  return ROLLEN_RANG[handelnd.rolle] >= ROLLEN_RANG.co_owner
    && darfKontoVerwalten(handelnd, ziel)
    && VERGEBBARE_ROLLEN.includes(neueRolle)
    && ROLLEN_RANG[neueRolle] < ROLLEN_RANG[handelnd.rolle];
}

/** Rollen, die `handelnd` überhaupt vergeben darf (für die Auswahl im Team-Bereich). */
export const getVergebbareRollen = (handelnd: Pick<Konto, 'rolle'>): UserRole[] =>
  VERGEBBARE_ROLLEN.filter((rolle) => ROLLEN_RANG[rolle] < ROLLEN_RANG[handelnd.rolle]);

/** Konto, wie es der Team-Bereich sieht */
export interface TeamKonto extends Konto {
  gesperrt: boolean;
  /** Hat Dev-Werkzeuge benutzt – zählt nicht für die Bestenliste */
  devMarkiert: boolean;
  /** Zuletzt gespeicherter Spielstand (ISO) – `null`, wenn noch nie gespielt */
  zuletztGespielt: string | null;
}

export interface TeamUebersicht {
  konten: number;
  team: number;
  gesperrt: number;
  neuLetzte7Tage: number;
  aktivHeute: number;
  aktivLetzte7Tage: number;
  mitSpielstand: number;
}

/** Eintrag im Aktivitäts-Protokoll des Teams (wer hat wann was an welchem Konto gemacht) */
export interface TeamProtokollEintrag {
  id: number;
  zeit: string;
  vonName: string;
  aktion: string;
  zielName: string | null;
  details: string | null;
}

/** Interne Team-Notiz zu einem Konto – sieht nur das Team */
export interface KontoNotiz {
  id: number;
  zeit: string;
  vonName: string;
  text: string;
}

export type AnkuendigungsArt = 'info' | 'wartung' | 'wichtig';

/** Hinweis des Teams, der allen Spielern oben im Spiel angezeigt wird */
export interface Ankuendigung {
  text: string;
  art: AnkuendigungsArt;
  vonName: string;
  zeit: string;
}

export const ANKUENDIGUNG_MAX_LAENGE = 300;
export const NOTIZ_MAX_LAENGE = 1000;

/**
 * Vom Team angelegte Korrektur eines Spielstands (z. B. nach einem Bug).
 * Das Spiel des Spielers holt sie ab und bucht sie ein – so überschreibt ein laufendes Spiel sie nicht.
 */
export interface SpielstandKorrektur {
  id: number;
  /** Wird aufs Guthaben addiert (darf negativ sein) */
  guthabenAenderung: number;
  /** Neuer Ruf (0–100) – fehlt = Ruf bleibt */
  rufNeu: number | null;
  grund: string;
  zeit: string;
}

export interface SpielstandZusammenfassung {
  guthaben: number;
  ruf: number | null;
  wachen: number;
  fahrzeuge: number;
  personal: number;
  laufendeEinsaetze: number;
  abgeschlosseneEinsaetze: number;
  gespeichertAm: string | null;
}

/** Kurzfassung eines gespeicherten Spielstands – robust gegen alte oder unvollständige Stände. */
export function fasseSpielstandZusammen(roh: unknown): SpielstandZusammenfassung | null {
  if (!roh || typeof roh !== 'object') return null;
  const s = roh as Record<string, unknown>;
  const anzahl = (wert: unknown) => (Array.isArray(wert) ? wert.length : 0);
  const locations = Array.isArray(s.locations) ? (s.locations as Array<{ type?: string }>) : [];
  return {
    guthaben: typeof s.balance === 'number' ? s.balance : 0,
    ruf: typeof s.ruf === 'number' ? s.ruf : null,
    wachen: locations.filter((l) => l?.type === 'station').length,
    fahrzeuge: anzahl(s.vehicles),
    personal: anzahl(s.personal),
    laufendeEinsaetze: anzahl(s.incidents),
    abgeschlosseneEinsaetze: anzahl(s.completedIncidentHistory),
    gespeichertAm: typeof s.gespeichertAm === 'string' ? s.gespeichertAm : null,
  };
}
