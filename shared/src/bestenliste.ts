/**
 * Bestenliste: Spieler im Vergleich. Die Werte kommen aus dem gespeicherten Spielstand
 * (der Server legt sie bei jedem Speichern als Kurzfassung ab).
 */
import type { Konto } from './konten.js';

export type BestenlisteKategorie = 'xp' | 'einsaetze' | 'perfekt' | 'ruf' | 'fahrzeuge';

export interface BestenlisteKategorieInfo {
  id: BestenlisteKategorie;
  label: string;
  /** Kurze Erklärung für Spieler */
  info: string;
}

export const BESTENLISTE_KATEGORIEN: BestenlisteKategorieInfo[] = [
  { id: 'xp', label: 'Erfahrung', info: 'Erfahrungspunkte aus allen Einsätzen – bestimmen deinen Rang.' },
  { id: 'einsaetze', label: 'Einsätze', info: 'Alle abgeschlossenen Einsätze.' },
  { id: 'perfekt', label: 'Perfekt', info: 'Einsätze mit voller Punktzahl: nächstes Fahrzeug, Hilfsfrist eingehalten, nicht überalarmiert.' },
  { id: 'ruf', label: 'Ruf', info: 'Aktueller Ruf deiner Leitstelle (ab 25 Einsätzen).' },
  { id: 'fahrzeuge', label: 'Fuhrpark', info: 'Anzahl deiner Fahrzeuge.' },
];

export const istBestenlisteKategorie = (wert: unknown): wert is BestenlisteKategorie =>
  BESTENLISTE_KATEGORIEN.some((kategorie) => kategorie.id === wert);

export const BESTENLISTE_CONFIG = {
  /** So viele Plätze zeigt die Liste */
  plaetze: 50,
  /** Für die Ruf-Wertung braucht man so viele Einsätze (sonst stünde jeder Neue mit dem Startruf weit oben) */
  rufAbEinsaetzen: 25,
} as const;

export interface BestenlisteWerte {
  xp: number;
  einsaetze: number;
  perfekt: number;
  ruf: number;
  wachen: number;
  fahrzeuge: number;
}

export interface BestenlisteEintrag {
  platz: number;
  /** Konto-Daten, die andere sehen dürfen (Name, Spitzname, Profilbild, Abzeichen) */
  konto: Pick<Konto, 'id' | 'name' | 'spitzname' | 'avatar' | 'erstellt'>;
  werte: BestenlisteWerte;
}

export interface BestenlisteAntwort {
  kategorie: BestenlisteKategorie;
  eintraege: BestenlisteEintrag[];
  /** Eigener Eintrag – auch wenn er nicht unter den ersten Plätzen ist; `null`: zählt nicht (z. B. Dev-Werkzeuge, kein Spielstand) */
  eigener: BestenlisteEintrag | null;
  /** Wie viele Spieler in dieser Wertung sind */
  teilnehmer: number;
}

/** Wert, nach dem in einer Kategorie sortiert wird */
export const bestenlisteWert = (werte: BestenlisteWerte, kategorie: BestenlisteKategorie): number => werte[kategorie];

/** Zweitwert bei Gleichstand (z. B. gleicher Ruf: mehr Einsätze zuerst) */
export const bestenlisteZweitwert = (werte: BestenlisteWerte, kategorie: BestenlisteKategorie): number =>
  kategorie === 'fahrzeuge' ? werte.wachen : kategorie === 'einsaetze' ? werte.xp : werte.einsaetze;

/** Zählt dieser Spieler in der Kategorie mit? */
export const zaehltInKategorie = (werte: BestenlisteWerte, kategorie: BestenlisteKategorie): boolean =>
  kategorie === 'ruf' ? werte.einsaetze >= BESTENLISTE_CONFIG.rufAbEinsaetzen : bestenlisteWert(werte, kategorie) > 0;

/**
 * Sortiert Spieler und vergibt Plätze. Bei gleichem Hauptwert teilen sich Spieler den Platz
 * (z. B. 1, 2, 2, 4); die Reihenfolge innerhalb entscheidet der Zweitwert, dann das ältere Konto.
 */
export function ordneBestenliste<T extends { konto: { id: number }; werte: BestenlisteWerte }>(
  spieler: T[],
  kategorie: BestenlisteKategorie,
): Array<T & { platz: number }> {
  const sortiert = spieler
    .filter((s) => zaehltInKategorie(s.werte, kategorie))
    .sort((a, b) =>
      bestenlisteWert(b.werte, kategorie) - bestenlisteWert(a.werte, kategorie)
      || bestenlisteZweitwert(b.werte, kategorie) - bestenlisteZweitwert(a.werte, kategorie)
      || a.konto.id - b.konto.id);
  let platz = 0;
  return sortiert.map((s, i) => {
    if (i === 0 || bestenlisteWert(s.werte, kategorie) !== bestenlisteWert(sortiert[i - 1].werte, kategorie)) platz = i + 1;
    return { ...s, platz };
  });
}
