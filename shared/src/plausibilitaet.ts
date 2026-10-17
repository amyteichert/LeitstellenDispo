// Schutz gegen Schummeln: Der Server prüft beim Speichern, ob die Guthaben-Änderung zu den Buchungen passt.
import type { FinanceTransaction } from './typen.js';

export const PLAUSIBILITAET = {
  /** Rundungsspielraum, bevor ein Unterschied als unerklärt gilt */
  toleranz: 1,
  /**
   * Ab so vielen Einnahmen pro Stunde (Echtzeit seit dem letzten Speichern) wird der Spielstand im Team-Protokoll
   * vermerkt. Bewusst großzügig: Ehrliche Spieler sollen nie auffallen.
   */
  einnahmenProStundeMax: 500_000,
  /** Sockel für kurze Abstände zwischen zwei Speicherungen */
  einnahmenSockel: 50_000,
} as const;

/** Vom Server vergebene Buchungen und Dev-Werkzeuge (Konto ist dann ohnehin markiert) – zählen nicht zur Einnahmen-Obergrenze */
const istServerBuchung = (tx: FinanceTransaction) =>
  tx.label.startsWith('Schichtzulage') || tx.label.startsWith('Korrektur durch das Team') || tx.label.startsWith('Dev-Werkzeug');

const vorzeichen = (tx: FinanceTransaction) => (tx.kind === 'Einnahme' ? tx.amount : -tx.amount);

export interface GuthabenPruefung {
  /** Durch neue oder geänderte Buchungen erklärte Änderung des Guthabens */
  erklaert: number;
  /** Zuwachs, den keine Buchung erklärt (> 0 = Guthaben wurde ohne Buchung erhöht) */
  unerklaert: number;
  /** Guthaben, das gespeichert werden darf */
  erlaubtesGuthaben: number;
  /** Neue Einnahmen aus dem Spiel (ohne Schichtzulage und Team-Korrekturen) */
  neueEinnahmen: number;
}

/**
 * Vergleicht den gespeicherten mit dem neuen Spielstand. Erhöht sich das Guthaben stärker als die Buchungen
 * erklären, wird es auf den erklärbaren Wert gekürzt. Weniger Guthaben als erklärt bleibt unangetastet.
 */
export function pruefeGuthaben(
  alt: { balance: number; transactions: FinanceTransaction[] },
  neu: { balance: number; transactions: FinanceTransaction[] },
): GuthabenPruefung {
  const bisher = new Map(alt.transactions.map((tx) => [tx.id, tx]));
  let erklaert = 0;
  let neueEinnahmen = 0;
  for (const tx of neu.transactions) {
    const vorher = bisher.get(tx.id);
    const differenz = vorzeichen(tx) - (vorher ? vorzeichen(vorher) : 0);
    erklaert += differenz;
    if (differenz > 0 && !istServerBuchung(tx)) neueEinnahmen += differenz;
  }
  const unerklaert = neu.balance - alt.balance - erklaert;
  const erlaubtesGuthaben = unerklaert > PLAUSIBILITAET.toleranz ? alt.balance + erklaert : neu.balance;
  return { erklaert, unerklaert, erlaubtesGuthaben, neueEinnahmen };
}

/** Sind die neuen Einnahmen für die vergangene Zeit unrealistisch hoch? */
export const einnahmenAuffaellig = (neueEinnahmen: number, vergangeneMs: number): boolean =>
  neueEinnahmen > PLAUSIBILITAET.einnahmenSockel + PLAUSIBILITAET.einnahmenProStundeMax * (Math.max(vergangeneMs, 0) / 3_600_000);
