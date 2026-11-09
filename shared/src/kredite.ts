/**
 * Kredite: Geld leihen, um schneller auszubauen. Zurückgezahlt wird in festen Raten je Spielstunde –
 * wie die laufenden Kosten nur, solange das Spiel offen ist. Höchstens ein Kredit gleichzeitig.
 */
import { bucheJeStunde, rechneLaufendeKostenAb } from './kosten.js';
import { getRang } from './laufbahn.js';
import type { FinanceTransaction } from './typen.js';

export interface Kredit {
  id: string;
  /** Ausgezahlter Betrag */
  betrag: number;
  /** Zinsen auf die ganze Laufzeit (0.1 = 10 %) */
  zinsSatz: number;
  laufzeitStunden: number;
  /** Betrag plus Zinsen */
  gesamtSchuld: number;
  /** Noch offen */
  restSchuld: number;
  rateJeStunde: number;
  aufgenommenAt: number;
  /** Bis hierhin sind die Raten abgebucht – fehlt = Abrechnung beginnt beim nächsten Spiel-Takt */
  abgerechnetBis?: number;
}

export const KREDIT_CONFIG = {
  /** Kreditrahmen je Rang (Index = Rangstufe − 1) */
  rahmenJeRang: [10_000, 25_000, 50_000, 100_000, 200_000, 350_000, 500_000],
  /** Wählbare Beträge – angeboten wird, was in den Kreditrahmen passt */
  betraege: [5_000, 10_000, 25_000, 50_000, 100_000, 200_000, 350_000, 500_000],
  /** Laufzeiten in Spielstunden: kürzer = günstiger, aber höhere Raten */
  laufzeiten: [
    { stunden: 4, zinsSatz: 0.05 },
    { stunden: 12, zinsSatz: 0.1 },
    { stunden: 24, zinsSatz: 0.15 },
  ],
} as const;

export const KREDIT_AUSZAHLUNG_LABEL = 'Kredit ausgezahlt';
export const KREDIT_RATE_LABEL = 'Kreditrate';
export const KREDIT_ABLOESUNG_LABEL = 'Kredit abgelöst';

/** Höchster Kreditbetrag für diesen Rang */
export const getKreditRahmen = (xp: number): number =>
  KREDIT_CONFIG.rahmenJeRang[Math.min(getRang(xp).stufe, KREDIT_CONFIG.rahmenJeRang.length) - 1];

/** Größter überhaupt möglicher Kredit (für die Plausibilitätsprüfung des Servers) */
export const KREDIT_HOECHSTBETRAG = Math.max(...KREDIT_CONFIG.rahmenJeRang);

export const getKreditBetraege = (xp: number): number[] => KREDIT_CONFIG.betraege.filter((betrag) => betrag <= getKreditRahmen(xp));

const laufzeitInfo = (stunden: number) => KREDIT_CONFIG.laufzeiten.find((l) => l.stunden === stunden);

/** Was ein Kredit insgesamt kostet – für die Vorschau vor dem Abschließen */
export function berechneKredit(betrag: number, laufzeitStunden: number): Pick<Kredit, 'betrag' | 'zinsSatz' | 'laufzeitStunden' | 'gesamtSchuld' | 'rateJeStunde'> | null {
  const laufzeit = laufzeitInfo(laufzeitStunden);
  if (!laufzeit || !Number.isFinite(betrag) || betrag <= 0) return null;
  const gesamtSchuld = Math.round(betrag * (1 + laufzeit.zinsSatz));
  return { betrag, zinsSatz: laufzeit.zinsSatz, laufzeitStunden, gesamtSchuld, rateJeStunde: Math.ceil(gesamtSchuld / laufzeitStunden) };
}

/** Darf dieser Kredit aufgenommen werden? Fehlermeldung oder `null` */
export function pruefeKreditAufnahme(bestehend: Kredit | null | undefined, betrag: number, laufzeitStunden: number, xp: number): string | null {
  if (bestehend) return 'Du hast schon einen Kredit. Zahle ihn erst zurück, bevor du einen neuen aufnimmst.';
  if (!laufzeitInfo(laufzeitStunden)) return 'Diese Laufzeit gibt es nicht.';
  if (!(KREDIT_CONFIG.betraege as readonly number[]).includes(betrag)) return 'Diesen Betrag gibt es nicht.';
  if (betrag > getKreditRahmen(xp)) return `Mit deinem Rang bekommst du höchstens ${getKreditRahmen(xp).toLocaleString('de-DE')} € – steige auf, um mehr zu leihen.`;
  return null;
}

export function erstelleKredit(betrag: number, laufzeitStunden: number, jetzt: number): Kredit {
  const werte = berechneKredit(betrag, laufzeitStunden);
  if (!werte) throw new Error('Ungültiger Kredit');
  return { id: `kredit-${jetzt}`, ...werte, restSchuld: werte.gesamtSchuld, aufgenommenAt: jetzt };
}

/**
 * Bucht die seit der letzten Abrechnung fälligen Raten (volle Minuten, nur bei offenem Spiel).
 * Ist alles bezahlt, ist der Kredit erledigt (`kredit: null`).
 */
export function rechneKreditrateAb(kredit: Kredit, jetzt: number): { kredit: Kredit | null; betrag: number } {
  const ergebnis = rechneLaufendeKostenAb(kredit.rateJeStunde, kredit.abgerechnetBis, jetzt);
  const betrag = Math.max(0, Math.min(ergebnis.betrag, kredit.restSchuld));
  const restSchuld = kredit.restSchuld - betrag;
  if (restSchuld <= 0) return { kredit: null, betrag };
  if (betrag === 0 && ergebnis.abgerechnetBis === kredit.abgerechnetBis) return { kredit, betrag: 0 };
  return { kredit: { ...kredit, restSchuld, abgerechnetBis: ergebnis.abgerechnetBis }, betrag };
}

/** Restschuld auf einmal zurückzahlen – ohne Aufpreis. Fehlermeldung oder `null` */
export function pruefeKreditAbloesung(kredit: Kredit | null | undefined, guthaben: number): string | null {
  if (!kredit) return 'Du hast keinen Kredit.';
  if (guthaben < kredit.restSchuld) return `Dafür brauchst du ${kredit.restSchuld.toLocaleString('de-DE')} € auf dem Konto.`;
  return null;
}

/** Ungefähre Restlaufzeit in Spielstunden */
export const getKreditRestStunden = (kredit: Kredit): number => kredit.restSchuld / kredit.rateJeStunde;

const zahl = (wert: unknown): wert is number => typeof wert === 'number' && Number.isFinite(wert);

/** Strukturprüfung für geladene/hochgeladene Spielstände – ein manipulierter Kredit darf kein Geld erzeugen */
export const istGueltigerKredit = (wert: unknown): wert is Kredit => {
  if (!wert || typeof wert !== 'object') return false;
  const k = wert as Record<string, unknown>;
  return typeof k.id === 'string'
    && zahl(k.betrag) && k.betrag > 0
    && zahl(k.zinsSatz) && k.zinsSatz >= 0
    && zahl(k.laufzeitStunden) && k.laufzeitStunden > 0
    && zahl(k.gesamtSchuld) && k.gesamtSchuld >= k.betrag
    && zahl(k.restSchuld) && k.restSchuld > 0 && k.restSchuld <= k.gesamtSchuld
    && zahl(k.rateJeStunde) && k.rateJeStunde > 0
    && zahl(k.aufgenommenAt)
    && (k.abgerechnetBis === undefined || zahl(k.abgerechnetBis));
};

/** Bucht Kreditraten wie die laufenden Kosten: eine Sammelbuchung je Stunde */
export const bucheKreditrate = (transactions: FinanceTransaction[], betrag: number, jetzt: number): FinanceTransaction[] =>
  bucheJeStunde(transactions, betrag, jetzt, { idPrefix: 'kreditrate', label: KREDIT_RATE_LABEL });
