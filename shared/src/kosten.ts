/**
 * Laufende Kosten: Gehälter des Personals, Unterhalt von Wachen, Fahrzeugen, Ausbildungsräumen und eigenen Krankenhäusern.
 * Abgerechnet wird minutengenau, aber nur die Zeit, in der das Spiel offen ist – Einsätze (und damit Einnahmen)
 * gibt es ja auch nur dann. Wer länger weg war, kommt also nicht mit einem Minus zurück.
 */
import type { Qualifikation } from './fahrzeuge.js';
import { getPflegekraefte, type Krankenhaus } from './krankenhaeuser.js';
import type { Mitarbeiter } from './personal.js';
import type { FinanceTransaction, MapLocation, Vehicle, WachenArt } from './typen.js';

const MINUTE = 60 * 1000;
const STUNDE = 60 * MINUTE;

/**
 * Werte am 09.11.2026 um 50 % erhöht: laufende Kosten sollen spürbar sein (Ziel ca. 15–20 % der Einnahmen, vorher 2–10 %).
 * Nachrechnen mit dem Bot: `starteSimulation` / `simulationsSchritt` aus `bot/simulation.ts`. */
export const KOSTEN_CONFIG = {
  /** Grundgehalt je Person und Stunde */
  gehaltJeStunde: 135,
  /** Zulage je Qualifikation und Stunde (zusätzlich zum Grundgehalt) */
  zulageJeStunde: {
    rettungssanitaeter: 8,
    notfallsanitaeter: 30,
    notarzt: 120,
    technische_hilfe: 8,
    maschinist_dlk: 15,
    gruppenfuehrer: 30,
    zugfuehrer: 60,
    lna: 150,
    orgl: 60,
    pilot: 120,
    gefahrgut: 15,
    wasserrettung: 15,
    hoehenretter: 23,
  } as Record<Qualifikation, number>,
  /** Unterhalt (Strom, Miete, Reinigung) je Wache und Stunde */
  wacheJeStunde: { Rettungswache: 120, Feuerwache: 225 } as Record<WachenArt, number>,
  /** Unterhalt je Ausbaustufe einer Wache (Stellplatz, Aufenthaltsraum, Küche …) */
  ausbaustufeJeStunde: 15,
  /** Unterhalt je Ausbildungsraum */
  ausbildungsraumJeStunde: 60,
  /** Wartung, Versicherung, Kraftstoff je Fahrzeug */
  fahrzeugJeStunde: 30,
  /** Grundbetrieb eines eigenen Krankenhauses (ohne Pflegepersonal) */
  krankenhausJeStunde: 450,
  /** Gehalt je Pflegekraft im eigenen Krankenhaus */
  pflegekraftJeStunde: 90,
  /** Längere Lücken (Spiel war geschlossen, Rechner im Ruhezustand) werden nicht abgerechnet */
  maxLueckeMs: 5 * MINUTE,
} as const;

export interface LaufendeKosten {
  gehaelter: number;
  wachen: number;
  fahrzeuge: number;
  krankenhaeuser: number;
  /** Summe je Stunde */
  gesamt: number;
}

export interface KostenZustand {
  locations: MapLocation[];
  vehicles: Vehicle[];
  personal: Mitarbeiter[];
  krankenhaeuser: Krankenhaus[];
}

/** Stundenlohn einer Person (Grundgehalt plus Zulagen) */
export const getGehaltJeStunde = (person: Pick<Mitarbeiter, 'qualifikationen'>) =>
  person.qualifikationen.reduce<number>((summe, q) => summe + (KOSTEN_CONFIG.zulageJeStunde[q] ?? 0), KOSTEN_CONFIG.gehaltJeStunde);

/** Unterhalt einer Wache je Stunde (ohne Personal und Fahrzeuge) */
export function getWachenUnterhaltJeStunde(wache: MapLocation): number {
  if (wache.type !== 'station') return 0;
  const ausbaustufen = Object.values(wache.ausbau ?? {}).reduce((summe, stufe) => summe + stufe, 0);
  return KOSTEN_CONFIG.wacheJeStunde[wache.stationKind ?? 'Rettungswache']
    + ausbaustufen * KOSTEN_CONFIG.ausbaustufeJeStunde
    + (wache.ausbildungsRaeume?.length ?? 0) * KOSTEN_CONFIG.ausbildungsraumJeStunde;
}

/** Alle laufenden Kosten einer Wache je Stunde (Unterhalt, Fahrzeuge, Personal) – für die Wachenansicht */
export function getWachenKostenJeStunde(wache: MapLocation, zustand: Pick<KostenZustand, 'vehicles' | 'personal'>): number {
  const fahrzeuge = zustand.vehicles.filter((v) => v.stationId === wache.id).length * KOSTEN_CONFIG.fahrzeugJeStunde;
  const gehaelter = zustand.personal.filter((p) => p.wacheId === wache.id).reduce<number>((summe, p) => summe + getGehaltJeStunde(p), 0);
  return getWachenUnterhaltJeStunde(wache) + fahrzeuge + gehaelter;
}

/** Laufende Kosten je Stunde, aufgeteilt nach Posten */
export function getLaufendeKosten(zustand: KostenZustand): LaufendeKosten {
  const eigene = zustand.krankenhaeuser.filter((k) => k.eigen);
  const gehaelter = zustand.personal.reduce<number>((summe, p) => summe + getGehaltJeStunde(p), 0)
    + eigene.reduce((summe, k) => summe + getPflegekraefte(k), 0) * KOSTEN_CONFIG.pflegekraftJeStunde;
  const wachen = zustand.locations.reduce((summe, wache) => summe + getWachenUnterhaltJeStunde(wache), 0);
  const fahrzeuge = zustand.vehicles.length * KOSTEN_CONFIG.fahrzeugJeStunde;
  const krankenhaeuser = eigene.length * KOSTEN_CONFIG.krankenhausJeStunde;
  return { gehaelter, wachen, fahrzeuge, krankenhaeuser, gesamt: gehaelter + wachen + fahrzeuge + krankenhaeuser };
}

/**
 * Rechnet die vollen Minuten seit `abgerechnetBis` ab.
 * Ohne bisherige Abrechnung oder nach einer langen Lücke (Spiel war zu) beginnt sie neu – ohne Kosten.
 */
export function rechneLaufendeKostenAb(
  kostenJeStunde: number,
  abgerechnetBis: number | undefined,
  jetzt: number,
): { abgerechnetBis: number; betrag: number } {
  if (abgerechnetBis === undefined || jetzt - abgerechnetBis > KOSTEN_CONFIG.maxLueckeMs || jetzt < abgerechnetBis) {
    return { abgerechnetBis: jetzt, betrag: 0 };
  }
  const minuten = Math.floor((jetzt - abgerechnetBis) / MINUTE);
  if (minuten === 0) return { abgerechnetBis, betrag: 0 };
  return { abgerechnetBis: abgerechnetBis + minuten * MINUTE, betrag: Math.round((kostenJeStunde * minuten) / 60) };
}

export const LAUFENDE_KOSTEN_LABEL = 'Laufende Kosten (Gehälter & Unterhalt)';

/**
 * Sammelbuchung je Stunde (z. B. laufende Kosten, Kreditraten), damit die Buchungsliste nicht minütlich wächst.
 * Läuft die Buchung der aktuellen Stunde schon, wird sie erhöht.
 */
export function bucheJeStunde(
  transactions: FinanceTransaction[],
  betrag: number,
  jetzt: number,
  art: { idPrefix: string; label: string },
): FinanceTransaction[] {
  if (betrag <= 0) return transactions;
  const stunde = new Date(Math.floor(jetzt / STUNDE) * STUNDE).toISOString();
  const id = `${art.idPrefix}-${stunde}`;
  const index = transactions.findIndex((tx) => tx.id === id);
  if (index >= 0) {
    return transactions.map((tx, i) => (i === index ? { ...tx, amount: tx.amount + betrag } : tx));
  }
  return [{ id, kind: 'Ausgabe', label: art.label, amount: betrag, createdAt: stunde }, ...transactions];
}

/** Bucht laufende Kosten (eine Sammelbuchung je Stunde) */
export const bucheLaufendeKosten = (transactions: FinanceTransaction[], betrag: number, jetzt: number): FinanceTransaction[] =>
  bucheJeStunde(transactions, betrag, jetzt, { idPrefix: 'laufende-kosten', label: LAUFENDE_KOSTEN_LABEL });
