// Schichtzulage: täglicher Bonus fürs Vorbeischauen. Vergeben wird sie vom Server (einmal pro Tag und Konto).

export const SCHICHTZULAGE = {
  /** Betrag am ersten Tag einer Serie */
  start: 1_000,
  /** Mehr pro weiterem Tag in Folge */
  schritt: 500,
  /** Höchstbetrag an normalen Tagen (ab Tag 7) */
  max: 4_000,
  /** Jeder so-vielte Tag in Folge bringt den Sonderbetrag (14, 28, 42 …) */
  sonderAlle: 14,
  sonderBetrag: 15_000,
} as const;

/** Betrag für den `serie`-ten Tag in Folge (ab 1) */
export function schichtzulageBetrag(serie: number): number {
  if (serie > 0 && serie % SCHICHTZULAGE.sonderAlle === 0) return SCHICHTZULAGE.sonderBetrag;
  return Math.min(SCHICHTZULAGE.start + (Math.max(serie, 1) - 1) * SCHICHTZULAGE.schritt, SCHICHTZULAGE.max);
}

/** Kalendertag in deutscher Zeit als 'JJJJ-MM-TT' – der Tag wechselt um Mitternacht in Berlin */
export function deutscherTag(jetzt: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(jetzt));
}

/** Vortag zu 'JJJJ-MM-TT' (reine Kalenderrechnung, unabhängig von Zeitzonen) */
export function vortag(tag: string): string {
  const [jahr, monat, t] = tag.split('-').map(Number);
  return new Date(Date.UTC(jahr, monat - 1, t - 1)).toISOString().slice(0, 10);
}

/**
 * Serie für heute: `null`, wenn die Zulage heute schon vergeben wurde.
 * Gestern abgeholt → Serie geht weiter, sonst beginnt sie wieder bei 1.
 */
export function naechsteSerie(letzterTag: string | null, letzteSerie: number, heute: string): number | null {
  if (letzterTag === heute) return null;
  return letzterTag === vortag(heute) ? letzteSerie + 1 : 1;
}

/** Antwort des Servers auf die Abfrage der Schichtzulage */
export type SchichtzulageAntwort =
  | { erhalten: true; betrag: number; serie: number; morgen: number }
  | { erhalten: false; serie: number };
