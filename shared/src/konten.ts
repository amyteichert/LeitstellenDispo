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
  /** Frei wählbarer Anzeigename (Begrüßung, Startbildschirm) – `null`: Benutzername */
  spitzname?: string | null;
  /** Profilbild: `vorlage:<id>` (gezeichnete Figur) oder `bild:<stand>` (hochgeladen) – `null`: Anfangsbuchstabe */
  avatar?: string | null;
  /** Wann der Benutzername zuletzt geändert wurde (ISO) – nur im eigenen Konto */
  nameGeaendert?: string | null;
}

/** Hochgeladenes Profilbild, das noch auf Freigabe durchs Team wartet */
export type OffenesBild = Pick<Konto, 'id' | 'name' | 'spitzname' | 'avatar'>;

export const SPITZNAME_MAX_LAENGE = 24;
/** So lange muss man warten, bis man den Benutzernamen erneut ändern darf */
export const NAME_AENDERN_ABSTAND_TAGE = 30;
/** Hochgeladene Profilbilder verkleinert der Client vorher auf 256×256 – mehr braucht es nicht */
export const PROFILBILD_MAX_BYTES = 60_000;
export const PROFILBILD_GROESSE = 256;

/** Gezeichnete Profilbilder zur Auswahl (Grafiken im Client) */
export const AVATAR_VORLAGEN = [
  'fw-helm', 'fw-helm-2', 'fw-maschinist', 'fw-atemschutz',
  'rd-notfallsani', 'rd-notaerztin', 'rd-sani', 'rd-kappe',
  'ls-disponent', 'ls-disponentin', 'ls-chefin', 'ls-nacht',
] as const;
export type AvatarVorlage = (typeof AVATAR_VORLAGEN)[number];

/** Name, mit dem das Spiel einen anspricht */
export const anzeigeName = (konto: Pick<Konto, 'name' | 'spitzname'>) => konto.spitzname?.trim() || konto.name;

/** Prüft einen Spitznamen (leer = keiner). Gibt eine Fehlermeldung zurück oder `null`. */
export function pruefeSpitzname(spitzname: unknown): string | null {
  if (spitzname === null || spitzname === undefined) return null;
  if (typeof spitzname !== 'string') return 'Ungültiger Spitzname.';
  if ([...spitzname.trim()].length > SPITZNAME_MAX_LAENGE) return `Der Spitzname darf höchstens ${SPITZNAME_MAX_LAENGE} Zeichen haben.`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(spitzname)) return 'Der Spitzname enthält unerlaubte Zeichen.';
  return null;
}

/** Ab wann der Benutzername wieder geändert werden darf (ms) – 0: sofort */
export const getNameAenderbarAb = (nameGeaendert: string | null | undefined) =>
  nameGeaendert ? Date.parse(nameGeaendert) + NAME_AENDERN_ABSTAND_TAGE * 24 * 60 * 60 * 1000 : 0;

/** Begrüßung je nach Tageszeit (Stunde 0–23) */
export function getBegruessung(stunde: number): string {
  if (stunde >= 5 && stunde < 11) return 'Guten Morgen';
  if (stunde >= 11 && stunde < 18) return 'Guten Tag';
  if (stunde >= 18 && stunde < 23) return 'Guten Abend';
  return 'Gute Nacht';
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

/** Dev-Werkzeuge (Test-Einsatz, Geld, Ruf …): Team-Rollen und Tester. Tester sehen sonst nichts vom Team-Bereich. */
export const darfDevWerkzeuge = (rolle: UserRole): boolean => istTeamRolle(rolle) || rolle === 'tester';

// ---------------------------------------------------------------------------
// Team-Bereich: Rangordnung und Verwaltung
// ---------------------------------------------------------------------------

export const ROLLEN_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-Owner',
  admin: 'Admin',
  tester: 'Tester',
  player: 'Spieler',
};

/** Rang einer Rolle – man darf nur Konten mit niedrigerem Rang verwalten. */
export const ROLLEN_RANG: Record<UserRole, number> = { owner: 4, co_owner: 3, admin: 2, tester: 1, player: 0 };

/** Rollen, die der Owner vergeben kann (Owner selbst bleibt einmalig). */
export const VERGEBBARE_ROLLEN: UserRole[] = ['player', 'tester', 'admin', 'co_owner'];

/**
 * Ende der Alpha (ISO-Zeitpunkt). Wer sich vorher registriert, ist Gründungs-Spieler und bekommt das Abzeichen.
 * `null`: Alpha läuft noch – alle Konten bekommen es. Zum Alpha-Ende hier den Zeitpunkt eintragen, z. B. '2027-01-01T00:00:00Z'.
 */
export const ALPHA_ENDE: string | null = null;

/** Gründungs-Spieler: Konto aus der Alpha-Zeit */
export const istGruendungsSpieler = (konto: Pick<Konto, 'erstellt'>, alphaEnde: string | null = ALPHA_ENDE): boolean =>
  alphaEnde === null || Date.parse(konto.erstellt) < Date.parse(alphaEnde);

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

/**
 * Kritische Team-Aktionen – endgültig, wirken aufs Spielgeschehen oder auf alle Spieler.
 * Admins moderieren (ansehen, sperren, Notizen, Passwort-Link); alles hier erst ab der angegebenen Rolle.
 */
export type TeamRecht =
  | 'konto_loeschen'
  | 'spielstand_zuruecksetzen'
  | 'spielstand_korrigieren'
  | 'ankuendigung'
  | 'fremde_notizen_loeschen'
  | 'website_statistik'
  | 'bot'
  | 'sicherung';

export const TEAM_RECHT_AB: Record<TeamRecht, UserRole> = {
  konto_loeschen: 'co_owner',
  spielstand_zuruecksetzen: 'co_owner',
  spielstand_korrigieren: 'co_owner',
  ankuendigung: 'co_owner',
  fremde_notizen_loeschen: 'co_owner',
  /** Besucherstatistik der Website – nur für den Owner */
  website_statistik: 'owner',
  /** Bot-Werkzeug – ab Co-Owner (Admins ausgenommen) */
  bot: 'co_owner',
  /** Datenbank-Sicherung herunterladen (alle Konten inkl. E-Mail-Adressen) – nur für den Owner */
  sicherung: 'owner',
};

export const hatTeamRecht = (rolle: UserRole, recht: TeamRecht): boolean =>
  istTeamRolle(rolle) && ROLLEN_RANG[rolle] >= ROLLEN_RANG[TEAM_RECHT_AB[recht]];

/** Eigene Notizen darf jedes Team-Mitglied löschen, fremde erst ab Co-Owner. */
export const darfNotizLoeschen = (handelnd: Pick<Konto, 'name' | 'rolle'>, notiz: Pick<KontoNotiz, 'vonName'>): boolean =>
  istTeamRolle(handelnd.rolle) && (notiz.vonName === handelnd.name || hatTeamRecht(handelnd.rolle, 'fremde_notizen_loeschen'));

/** Konto, wie es der Team-Bereich sieht */
/** Team sieht Spitzname und Profilbild, damit unpassende Bilder entfernt werden können */
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
  /** Ab hier wird sie nicht mehr angezeigt – `null`: bis das Team sie entfernt */
  laeuftAb: string | null;
}

export const ANKUENDIGUNG_MAX_LAENGE = 300;
/** Längste einstellbare Dauer einer Ankündigung (30 Tage) */
export const ANKUENDIGUNG_MAX_DAUER_MINUTEN = 30 * 24 * 60;
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
  /** 'team': vom Team angelegt, 'schichtzulage': täglicher Bonus vom Server */
  art: 'team' | 'schichtzulage';
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

export const FEHLERMELDUNG_MAX_LAENGE = 2000;

/** Was das Spiel zu einer Fehlermeldung automatisch mitschickt */
export interface FehlermeldungKontext {
  version: string;
  ansicht: string;
  geraet: string;
  bildschirm: string;
}

/** Fehlermeldung, wie das Team sie sieht */
export interface Fehlermeldung {
  id: number;
  name: string;
  text: string;
  kontext: FehlermeldungKontext & { spielstand?: SpielstandZusammenfassung | null };
  zeit: string;
  erledigt: boolean;
}
