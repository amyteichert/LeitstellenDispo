/**
 * Laufbahn des Spielers: Erfahrungspunkte (EP) aus Einsätzen und Erfolgen, Ränge und was sie freischalten.
 * EP können nie sinken – der Rang ist das langfristige Ziel, Geld und Ruf schwanken.
 */
import type { EinsatzBewertung } from './daten.js';

export interface Laufbahn {
  /** Gesammelte Erfahrungspunkte */
  xp: number;
  /** Alle jemals abgeschlossenen Einsätze (der Verlauf im Spielstand ist gekürzt) */
  einsaetze: number;
  /** Einsätze mit voller Punktzahl (nächstes Fahrzeug, Hilfsfrist eingehalten, nicht überalarmiert) */
  perfekt: number;
  /** IDs der erreichten Erfolge */
  erfolge: string[];
}

export interface Rang {
  stufe: number;
  name: string;
  abXp: number;
  /** Fahrzeugtypen, die ab diesem Rang gekauft werden können (alle anderen gibt es ab Rang 1) */
  fahrzeuge: string[];
}

export const RAENGE: Rang[] = [
  { stufe: 1, name: 'Praktikant', abXp: 0, fahrzeuge: [] },
  { stufe: 2, name: 'Disponent-Anwärter', abXp: 300, fahrzeuge: ['NEF', 'HLF 10', 'TLF 3000', 'GW-Öl'] },
  { stufe: 3, name: 'Disponent', abXp: 1200, fahrzeuge: ['DLK 23/12', 'RW', 'ELW 1', 'GW-A', 'HLF 20'] },
  { stufe: 4, name: 'Erfahrener Disponent', abXp: 4000, fahrzeuge: ['ITW', 'GW-San', 'TLF 4000', 'SW 2000', 'GW-L2', 'GW-Wasserrettung'] },
  { stufe: 5, name: 'Schichtführer', abXp: 10000, fahrzeuge: ['KdoW-LNA', 'KdoW-OrgL', 'ELW 2', 'GW-G', 'GW-Mess', 'GW-Höhenrettung'] },
  { stufe: 6, name: 'Lagedienstführer', abXp: 25000, fahrzeuge: ['FwK', 'RTH'] },
  { stufe: 7, name: 'Leiter der Leitstelle', abXp: 60000, fahrzeuge: [] },
];

export const LAUFBAHN_START: Laufbahn = { xp: 0, einsaetze: 0, perfekt: 0, erfolge: [] };

export const getRang = (xp: number): Rang => [...RAENGE].reverse().find((rang) => xp >= rang.abXp) ?? RAENGE[0];

export const getNaechsterRang = (xp: number): Rang | undefined => RAENGE.find((rang) => rang.abXp > xp);

/** Fortschritt zum nächsten Rang (0–1); beim höchsten Rang 1 */
export function getRangFortschritt(xp: number): number {
  const rang = getRang(xp);
  const naechster = getNaechsterRang(xp);
  if (!naechster) return 1;
  return (xp - rang.abXp) / (naechster.abXp - rang.abXp);
}

/** Ab welchem Rang ein Fahrzeugtyp gekauft werden kann */
export const getFreischaltRang = (typ: string): Rang =>
  RAENGE.find((rang) => rang.fahrzeuge.includes(typ)) ?? RAENGE[0];

export const istFahrzeugFreigeschaltet = (typ: string, xp: number) => getFreischaltRang(typ).abXp <= xp;

/** EP für einen abgeschlossenen Einsatz: Grundwert + Größe des Einsatzes + gute Arbeit */
export function getEinsatzXp(einsatz: { reward: number; bewertung?: Pick<EinsatzBewertung, 'punkte'> }): number {
  return 5 + Math.round(einsatz.reward / 100) + Math.round((einsatz.bewertung?.punkte ?? 0) / 20);
}

export const istPerfekterEinsatz = (bewertung?: Pick<EinsatzBewertung, 'punkte'>) => (bewertung?.punkte ?? 0) >= 100;

// ---------------------------------------------------------------------------
// Erfolge
// ---------------------------------------------------------------------------

/** Was für die Erfolge zählt – wird aus dem Spielstand gebildet */
export interface ErfolgsStand {
  einsaetze: number;
  perfekt: number;
  wachen: number;
  feuerwachen: number;
  fahrzeuge: number;
  fahrzeugTypen: string[];
  ruf: number;
  eigenesKrankenhaus: boolean;
  guthaben: number;
}

export interface Erfolg {
  id: string;
  titel: string;
  text: string;
  xp: number;
  erreicht: (stand: ErfolgsStand) => boolean;
}

export const ERFOLGE: Erfolg[] = [
  { id: 'einsatz-1', titel: 'Erster Einsatz', text: 'Schließe deinen ersten Einsatz ab.', xp: 25, erreicht: (s) => s.einsaetze >= 1 },
  { id: 'einsatz-50', titel: 'Eingespielt', text: 'Schließe 50 Einsätze ab.', xp: 100, erreicht: (s) => s.einsaetze >= 50 },
  { id: 'einsatz-250', titel: 'Routine', text: 'Schließe 250 Einsätze ab.', xp: 300, erreicht: (s) => s.einsaetze >= 250 },
  { id: 'einsatz-1000', titel: 'Alter Hase', text: 'Schließe 1.000 Einsätze ab.', xp: 1000, erreicht: (s) => s.einsaetze >= 1000 },
  { id: 'einsatz-5000', titel: 'Legende der Leitstelle', text: 'Schließe 5.000 Einsätze ab.', xp: 4000, erreicht: (s) => s.einsaetze >= 5000 },
  { id: 'perfekt-1', titel: 'Wie aus dem Lehrbuch', text: 'Schließe einen Einsatz mit voller Punktzahl ab.', xp: 50, erreicht: (s) => s.perfekt >= 1 },
  { id: 'perfekt-100', titel: 'Präzisionsarbeit', text: 'Schließe 100 Einsätze mit voller Punktzahl ab.', xp: 750, erreicht: (s) => s.perfekt >= 100 },
  { id: 'feuerwache', titel: 'Es brennt!', text: 'Baue deine erste Feuerwache.', xp: 100, erreicht: (s) => s.feuerwachen >= 1 },
  { id: 'wachen-5', titel: 'Flächendeckend', text: 'Betreibe 5 Wachen.', xp: 250, erreicht: (s) => s.wachen >= 5 },
  { id: 'wachen-15', titel: 'Kreisweit', text: 'Betreibe 15 Wachen.', xp: 1000, erreicht: (s) => s.wachen >= 15 },
  { id: 'fahrzeuge-10', titel: 'Fuhrpark', text: 'Besitze 10 Fahrzeuge.', xp: 150, erreicht: (s) => s.fahrzeuge >= 10 },
  { id: 'fahrzeuge-50', titel: 'Großer Fuhrpark', text: 'Besitze 50 Fahrzeuge.', xp: 1000, erreicht: (s) => s.fahrzeuge >= 50 },
  { id: 'ruf-85', titel: 'Hervorragender Ruf', text: 'Bringe deinen Ruf auf 85.', xp: 300, erreicht: (s) => s.ruf >= 85 },
  { id: 'krankenhaus', titel: 'Eigene Klinik', text: 'Baue ein eigenes Krankenhaus.', xp: 300, erreicht: (s) => s.eigenesKrankenhaus },
  { id: 'rth', titel: 'Luftrettung', text: 'Stelle einen Rettungshubschrauber in Dienst.', xp: 500, erreicht: (s) => s.fahrzeugTypen.includes('RTH') },
  { id: 'guthaben-100k', titel: 'Gut gewirtschaftet', text: 'Habe 100.000 € auf dem Konto.', xp: 250, erreicht: (s) => s.guthaben >= 100000 },
];

/** Erfolge, die jetzt neu erreicht sind (noch nicht in `bereits`) */
export const findeNeueErfolge = (stand: ErfolgsStand, bereits: string[]): Erfolg[] =>
  ERFOLGE.filter((erfolg) => !bereits.includes(erfolg.id) && erfolg.erreicht(stand));

// ---------------------------------------------------------------------------
// Ältere Spielstände
// ---------------------------------------------------------------------------

/**
 * Spielstände von vor der Laufbahn: Niemand soll Fahrzeuge verlieren oder nicht mehr nachkaufen können, die er schon hat.
 * Startwert ist deshalb der Rang, der alle vorhandenen Fahrzeugtypen freischaltet (mindestens die bisherigen Einsätze × 10).
 */
export function erstelleLaufbahnFuerBestand(fahrzeugTypen: string[], bisherigeEinsaetze: number): Laufbahn {
  const noetig = Math.max(0, ...fahrzeugTypen.map((typ) => getFreischaltRang(typ).abXp));
  return { ...LAUFBAHN_START, xp: Math.max(noetig, bisherigeEinsaetze * 10), einsaetze: bisherigeEinsaetze };
}

/** Beschädigte oder manipulierte Laufbahn verwerfen (Prüfung an der Lade-/Speichergrenze) */
export function istGueltigeLaufbahn(laufbahn: unknown): laufbahn is Laufbahn {
  if (!laufbahn || typeof laufbahn !== 'object') return false;
  const l = laufbahn as Laufbahn;
  return [l.xp, l.einsaetze, l.perfekt].every((wert) => Number.isFinite(wert) && wert >= 0)
    && Array.isArray(l.erfolge) && l.erfolge.every((id) => typeof id === 'string');
}
