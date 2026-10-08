// Benutzerkonten: gemeinsame Typen und Eingaberegeln für Server und Client
import type { UserRole } from './daten.js';

export const KONTO_REGELN = {
  nameMinLaenge: 3,
  nameMaxLaenge: 24,
  passwortMinLaenge: 8,
  /** bcrypt verarbeitet höchstens 72 Bytes – alles danach würde stillschweigend ignoriert */
  passwortMaxBytes: 72,
} as const;

/** Öffentliche Sicht auf ein Konto (ohne Passwort-Hash) */
export interface Konto {
  id: number;
  name: string;
  rolle: UserRole;
  /** ISO-Zeitpunkt der Registrierung */
  erstellt: string;
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
