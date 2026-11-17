// Schutz gegen Schummeln: Der Server prüft beim Speichern, ob die Guthaben-Änderung zu den Buchungen passt.
import type { FinanceTransaction } from './typen.js';
import { KREDIT_ABLOESUNG_LABEL, KREDIT_AUSZAHLUNG_LABEL, KREDIT_HOECHSTBETRAG } from './kredite.js';
import type { Laufbahn } from './laufbahn.js';
import { istSammelBuchung } from './buchungen.js';
import { START_GUTHABEN } from './daten.js';

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
  /**
   * Laufbahn (Bestenliste): So viele Einsätze pro Stunde Echtzeit sind höchstens möglich. Das Aufkommen liegt selbst bei
   * vielen Wachen, Berufsverkehr und Unwetter bei etwa 900 pro Stunde – doppelter Puffer, ehrliche Spieler sollen nie auffallen.
   */
  einsaetzeProStundeMax: 2_000,
  einsaetzeSockel: 100,
  /** Höchstens so viele EP je Einsatz (aktuell maximal ca. 60) – großzügig */
  xpJeEinsatzMax: 150,
  /** Sockel für Erfolge (einmalige EP, zusammen deutlich unter diesem Wert) */
  xpSockel: 20_000,
  /**
   * Fuhrpark und Wachen für die Bestenliste: So viel Zuwachs ist je Stunde Echtzeit höchstens möglich.
   * Eine Simulation über 24 Stunden kommt auf 5 Wachen und 10 Fahrzeuge – die Grenzen sind ein Vielfaches davon,
   * damit auch ein sehr schneller Spieler (oder ein übernommener Browser-Spielstand) nie auffällt.
   */
  fahrzeugeProStundeMax: 60,
  fahrzeugeSockel: 200,
  wachenProStundeMax: 20,
  wachenSockel: 50,
} as const;

/** Vom Server vergebene Buchungen (Schichtzulage, Team-Korrektur) – der Server kann sie gegen seine Datenbank prüfen */
export const istServerGutschrift = (tx: FinanceTransaction) =>
  tx.label.startsWith('Schichtzulage') || tx.label.startsWith('Korrektur durch das Team');
/** Dev-Werkzeuge (Konto ist dann ohnehin markiert) – nur für Team und Tester erlaubt */
const istDevBuchung = (tx: FinanceTransaction) => tx.label.startsWith('Dev-Werkzeug');

/** Kreditauszahlungen sind keine Einnahmen aus dem Spiel (solange sie in den größten Kreditrahmen passen) */
const istKreditAuszahlung = (tx: FinanceTransaction) => tx.label === KREDIT_AUSZAHLUNG_LABEL && tx.amount <= KREDIT_HOECHSTBETRAG;

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
  /** Gutschriften mit Server-, Dev- oder Kredit-Bezeichnung, die laut `regeln` nicht gedeckt sind (zählen nicht als erklärt) */
  nichtGedeckt: number;
  /** IDs dieser nicht gedeckten Buchungen – sie sollen gar nicht erst gespeichert werden */
  ungedeckteIds: string[];
}

/**
 * Was der Server über Buchungen weiß, die nicht aus dem Spiel selbst stammen.
 * Ohne Angabe werden sie wie bisher ungeprüft anerkannt.
 */
export interface GuthabenRegeln {
  /** Höchstens so viel dürfen neue Schichtzulagen/Team-Korrekturen gutschreiben (vom Server noch nicht eingebuchte Beträge) */
  serverGutschriftenMax?: number;
  /** Darf das Konto Dev-Werkzeuge benutzen? Sonst zählen „Dev-Werkzeug“-Gutschriften nicht */
  devWerkzeuge?: boolean;
  /** Höchstens so viel dürfen neue Kreditauszahlungen betragen (Betrag eines neu aufgenommenen Kredits) */
  kreditAuszahlungMax?: number;
}

/**
 * Vergleicht den gespeicherten mit dem neuen Spielstand. Erhöht sich das Guthaben stärker als die Buchungen
 * erklären, wird es auf den erklärbaren Wert gekürzt. Weniger Guthaben als erklärt bleibt unangetastet.
 */
export function pruefeGuthaben(
  alt: { balance: number; transactions: FinanceTransaction[] },
  neu: { balance: number; transactions: FinanceTransaction[] },
  regeln: GuthabenRegeln = {},
): GuthabenPruefung {
  const bisher = new Map(alt.transactions.map((tx) => [tx.id, tx]));
  let erklaert = 0;
  let neueEinnahmen = 0;
  const pruefbar = { server: { summe: 0, ids: [] as string[] }, dev: { summe: 0, ids: [] as string[] }, kredit: { summe: 0, ids: [] as string[] } };
  for (const tx of neu.transactions) {
    // Sammelbuchungen fassen nur Vergangenes zusammen – sie dürfen kein neues Guthaben erklären
    if (istSammelBuchung(tx)) continue;
    const vorher = bisher.get(tx.id);
    const differenz = vorzeichen(tx) - (vorher ? vorzeichen(vorher) : 0);
    erklaert += differenz;
    if (differenz <= 0) continue;
    const art = istServerGutschrift(tx) ? 'server' : istDevBuchung(tx) ? 'dev' : istKreditAuszahlung(tx) ? 'kredit' : null;
    if (!art) {
      neueEinnahmen += differenz;
      continue;
    }
    pruefbar[art].summe += differenz;
    pruefbar[art].ids.push(tx.id);
  }
  // Gutschriften, die der Server nachprüfen kann, aber nicht bestätigt: Die ganze Art zählt dann nicht als Erklärung
  // (alles oder nichts – so kann eine erfundene Buchung nicht das Kontingent einer echten aufbrauchen)
  const ungedeckt = [
    pruefbar.server.summe > (regeln.serverGutschriftenMax ?? Infinity) + PLAUSIBILITAET.toleranz ? pruefbar.server : null,
    regeln.devWerkzeuge === false && pruefbar.dev.summe > 0 ? pruefbar.dev : null,
    pruefbar.kredit.summe > (regeln.kreditAuszahlungMax ?? Infinity) + PLAUSIBILITAET.toleranz ? pruefbar.kredit : null,
  ].filter((eintrag): eintrag is { summe: number; ids: string[] } => eintrag !== null);
  const nichtGedeckt = ungedeckt.reduce((summe, eintrag) => summe + eintrag.summe, 0);
  erklaert -= nichtGedeckt;
  const unerklaert = neu.balance - alt.balance - erklaert;
  const erlaubtesGuthaben = unerklaert > PLAUSIBILITAET.toleranz ? alt.balance + erklaert : neu.balance;
  return { erklaert, unerklaert, erlaubtesGuthaben, neueEinnahmen, nichtGedeckt, ungedeckteIds: ungedeckt.flatMap((eintrag) => eintrag.ids) };
}

/** Vergleichsstand für ein neues Spiel (oder den ersten Spielstand eines Kontos): nichts vorhanden */
export const LEERER_FINANZSTAND = { balance: 0, transactions: [] as FinanceTransaction[] };

/**
 * Bei einem neuen Spiel zählt die Startbuchung höchstens mit dem echten Startguthaben –
 * sonst ließe sich über eine erfundene „Startbuchung“ beliebig Geld erklären.
 */
export const begrenzeStartbuchung = (transactions: FinanceTransaction[]): FinanceTransaction[] =>
  transactions.map((tx) => (tx.id === 'initial-balance' && tx.amount > START_GUTHABEN ? { ...tx, amount: START_GUTHABEN } : tx));

/** Ist ein neuer Kredit dazugekommen (oder wurde im selben Zeitraum ein Kredit abgelöst)? Dann darf eine Auszahlung dabei sein. */
export function erlaubteKreditAuszahlung(
  alt: { kredit?: { id: string } | null } | null,
  neu: { kredit?: { id: string; betrag: number } | null; transactions: FinanceTransaction[] },
): number {
  if (neu.kredit && neu.kredit.id !== alt?.kredit?.id) return Math.min(neu.kredit.betrag, KREDIT_HOECHSTBETRAG);
  // Aufgenommen und sofort wieder abgelöst: dann steht die Ablösung als neue Buchung im Stand
  return neu.transactions.some((tx) => tx.label === KREDIT_ABLOESUNG_LABEL) ? KREDIT_HOECHSTBETRAG : 0;
}

export interface LaufbahnPruefung {
  /** Laufbahn, die gespeichert werden darf */
  laufbahn: Laufbahn;
  gekappt: boolean;
}

/**
 * Laufbahn (Grundlage der Bestenliste): EP, Einsätze und perfekte Einsätze dürfen in der vergangenen Echtzeit
 * höchstens so stark wachsen, wie es das Einsatzaufkommen überhaupt zulässt. Mehr wird gekappt.
 */
export function pruefeLaufbahn(alt: Laufbahn, neu: Laufbahn, vergangeneMs: number): LaufbahnPruefung {
  const stunden = Math.max(vergangeneMs, 0) / 3_600_000;
  const einsaetzeMax = PLAUSIBILITAET.einsaetzeSockel + PLAUSIBILITAET.einsaetzeProStundeMax * stunden;
  const einsaetze = Math.min(neu.einsaetze, Math.floor(alt.einsaetze + einsaetzeMax));
  const perfekt = Math.min(neu.perfekt, einsaetze, Math.floor(alt.perfekt + einsaetzeMax));
  const xp = Math.min(neu.xp, Math.floor(alt.xp + PLAUSIBILITAET.xpSockel + PLAUSIBILITAET.xpJeEinsatzMax * einsaetzeMax));
  const gekappt = einsaetze !== neu.einsaetze || perfekt !== neu.perfekt || xp !== neu.xp;
  return { laufbahn: gekappt ? { ...neu, einsaetze, perfekt, xp } : neu, gekappt };
}

/** Zählt die Wachen eines Spielstands (nur echte Standorte) */
export const zaehleWachen = (locations: Array<{ type?: string }>): number =>
  locations.filter((location) => location.type === 'station').length;

export interface BestandsWerte {
  wachen: number;
  fahrzeuge: number;
}

export interface BestandsPruefung {
  /** Werte, die in die Bestenliste dürfen */
  werte: BestandsWerte;
  gekappt: boolean;
}

/**
 * Fuhrpark und Wachen für die Bestenliste: Beide können nur so schnell wachsen, wie man sie bezahlen kann.
 * Die tatsächlichen Listen im Spielstand bleiben unangetastet – hier entstehen nur die Werte für die Rangliste,
 * damit ein manipulierter Spielstand nicht die Bestenliste verfälscht.
 */
export function pruefeBestand(alt: BestandsWerte, neu: BestandsWerte, vergangeneMs: number): BestandsPruefung {
  const stunden = Math.max(vergangeneMs, 0) / 3_600_000;
  const fahrzeuge = Math.min(neu.fahrzeuge, Math.floor(alt.fahrzeuge + PLAUSIBILITAET.fahrzeugeSockel + PLAUSIBILITAET.fahrzeugeProStundeMax * stunden));
  const wachen = Math.min(neu.wachen, Math.floor(alt.wachen + PLAUSIBILITAET.wachenSockel + PLAUSIBILITAET.wachenProStundeMax * stunden));
  return { werte: { wachen, fahrzeuge }, gekappt: fahrzeuge !== neu.fahrzeuge || wachen !== neu.wachen };
}

/** Sind die neuen Einnahmen für die vergangene Zeit unrealistisch hoch? */
export const einnahmenAuffaellig = (neueEinnahmen: number, vergangeneMs: number): boolean =>
  neueEinnahmen > PLAUSIBILITAET.einnahmenSockel + PLAUSIBILITAET.einnahmenProStundeMax * (Math.max(vergangeneMs, 0) / 3_600_000);
