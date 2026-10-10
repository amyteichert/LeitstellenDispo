/**
 * Leistungsbewertung und Ruf der Leitstelle.
 * Grundgeld gibt es immer – gute Arbeit wird zusätzlich als Bonus ausgezahlt, abhängig vom Ruf.
 * Bewertet wird nur, was ab der Alarmierung passiert: Wer einen Einsatz liegen lässt, wird nicht bestraft.
 */
import type { AbgeschlossenerSpielEinsatz, EinsatzBewertung } from './daten.js';
import type { FahrzeugBedarf } from './fahrzeuge.js';

export const RUF_CONFIG = {
  start: 50,
  min: 0,
  max: 100,
  /** Bis zu dieser Anfahrtszeit gibt es volle Punkte (übliche Hilfsfrist: 8 Minuten) … */
  anfahrtVollSekunden: 480,
  /** … ab dieser keine mehr (dazwischen linear) */
  anfahrtNullSekunden: 1080,
  /** Fahrzeugwahl: bis so viele Sekunden langsamer als das beste freie Fahrzeug gibt es volle Punkte … */
  wahlToleranzSekunden: 15,
  /** … ab so vielen Sekunden Umweg keine mehr */
  wahlNullSekunden: 150,
  /** Bonus bei 100 Punkten und Ruf 100 (Anteil am Grundgeld) */
  maxBonusAnteil: 0.4,
} as const;

export const RUF_STUFEN: Array<{ ab: number; label: string }> = [
  { ab: 85, label: 'Hervorragend' },
  { ab: 65, label: 'Gut' },
  { ab: 40, label: 'Durchschnittlich' },
  { ab: 20, label: 'Mäßig' },
  { ab: 0, label: 'Schlecht' },
];

export const getRufLabel = (ruf: number) => RUF_STUFEN.find((stufe) => ruf >= stufe.ab)?.label ?? 'Schlecht';

const begrenzeRuf = (ruf: number) => Math.min(RUF_CONFIG.max, Math.max(RUF_CONFIG.min, ruf));

/** Sekunden von der ersten Alarmierung bis zum Eintreffen des ersten Fahrzeugs. */
export function getEinsatzAnfahrtSekunden(einsatz: Pick<AbgeschlossenerSpielEinsatz, 'alarmedVehicles' | 'erstesEintreffenAt'>): number {
  if (einsatz.alarmedVehicles.length === 0) return 0;
  const alarmiertAt = Math.min(...einsatz.alarmedVehicles.map((a) => a.arrivalAt - a.etaSeconds * 1000));
  const eingetroffenAt = einsatz.erstesEintreffenAt ?? Math.min(...einsatz.alarmedVehicles.map((a) => a.arrivalAt));
  return Math.max(0, Math.round((eingetroffenAt - alarmiertAt) / 1000));
}

/** Linear von 50 Punkten (bis `voll`) auf 0 Punkte (ab `null_`). */
const linearePunkte = (wert: number, voll: number, null_: number) => {
  if (wert <= voll) return 50;
  if (wert >= null_) return 0;
  return Math.round(50 * (null_ - wert) / (null_ - voll));
};

/** Hilfsfrist: 0–50 Punkte nach der Anfahrtszeit des ersten Fahrzeugs. */
export const getFristPunkte = (sekunden: number) =>
  linearePunkte(sekunden, RUF_CONFIG.anfahrtVollSekunden, RUF_CONFIG.anfahrtNullSekunden);

/**
 * Fahrzeugwahl: 0–50 Punkte – wie viel langsamer war das erste Fahrzeug als das beste freie?
 * Ohne Vergleichswert (ältere Einsätze) gibt es die volle Punktzahl.
 */
export const getWahlPunkte = (sekunden: number, besteSekunden?: number) =>
  besteSekunden === undefined
    ? 50
    : linearePunkte(sekunden - besteSekunden, RUF_CONFIG.wahlToleranzSekunden, RUF_CONFIG.wahlNullSekunden);

export function getRufAenderung(punkte: number): number {
  if (punkte >= 80) return 2;
  if (punkte >= 50) return 1;
  if (punkte >= 25) return 0;
  return -2;
}

/** Eine Reserve ist erlaubt, jedes weitere unnötige Fahrzeug kostet Punkte (höchstens 30) */
export const UEBERALARMIERUNG = { reserve: 1, abzugJeFahrzeug: 10, maxAbzug: 30 } as const;

const summeBedarf = (bedarf: FahrzeugBedarf[] | undefined) => (bedarf ?? []).reduce((summe, b) => summe + b.amount, 0);

/**
 * Wie viele Fahrzeuge zu viel geschickt wurden. Maßstab ist das Größere aus Empfehlung und tatsächlichem Bedarf;
 * bei einer Entwarnung vor Ort gibt es keinen Abzug (die Meldung klang ja schlimmer).
 */
export function getUeberzaehlig(einsatz: Pick<AbgeschlossenerSpielEinsatz, 'alarmedVehicles' | 'requiredVehicles' | 'empfehlung' | 'meldungen'>): number {
  if (einsatz.meldungen?.some((m) => m.art === 'entwarnung')) return 0;
  const noetig = Math.max(summeBedarf(einsatz.requiredVehicles), summeBedarf(einsatz.empfehlung));
  return Math.max(0, einsatz.alarmedVehicles.length - noetig - UEBERALARMIERUNG.reserve);
}

export function bewerteEinsatz(einsatz: AbgeschlossenerSpielEinsatz, ruf: number): EinsatzBewertung {
  const anfahrtSekunden = getEinsatzAnfahrtSekunden(einsatz);
  const wahlPunkte = getWahlPunkte(anfahrtSekunden, einsatz.besteAnfahrtSekunden);
  const fristPunkte = getFristPunkte(anfahrtSekunden);
  const ueberzaehlig = getUeberzaehlig(einsatz);
  const ueberAbzug = Math.min(UEBERALARMIERUNG.maxAbzug, ueberzaehlig * UEBERALARMIERUNG.abzugJeFahrzeug);
  const punkte = Math.max(0, wahlPunkte + fristPunkte - ueberAbzug);
  return {
    punkte,
    ueberzaehlig,
    ueberAbzug,
    wahlPunkte,
    fristPunkte,
    anfahrtSekunden,
    besteAnfahrtSekunden: einsatz.besteAnfahrtSekunden,
    grundgeld: einsatz.reward,
    bonus: Math.round(einsatz.reward * RUF_CONFIG.maxBonusAnteil * (punkte / 100) * (ruf / 100)),
    rufVorher: ruf,
    rufAenderung: getRufAenderung(punkte),
  };
}

const formatSekunden = (sekunden: number) =>
  `${Math.floor(sekunden / 60)}:${String(Math.round(sekunden % 60)).padStart(2, '0')} Min.`;

export interface BewertungsHinweis {
  art: 'fehler' | 'gut';
  text: string;
}

/** Was lief gut, was war falsch? Für die Fehlerübersicht beim Ruf. */
export function getBewertungsHinweise(bewertung: EinsatzBewertung): BewertungsHinweis[] {
  const hinweise: BewertungsHinweis[] = [];
  const { anfahrtSekunden, besteAnfahrtSekunden, wahlPunkte, fristPunkte } = bewertung;

  if (besteAnfahrtSekunden !== undefined && wahlPunkte < 50) {
    hinweise.push({
      art: 'fehler',
      text: `Nicht das nächste freie Fahrzeug geschickt: ${formatSekunden(anfahrtSekunden - besteAnfahrtSekunden)} langsamer als möglich `
        + `(${formatSekunden(anfahrtSekunden)} statt ${formatSekunden(besteAnfahrtSekunden)}).`,
    });
  } else if (besteAnfahrtSekunden !== undefined) {
    hinweise.push({ art: 'gut', text: 'Nächstes freies Fahrzeug gewählt.' });
  }

  if (fristPunkte < 50) {
    hinweise.push({
      art: 'fehler',
      text: `Hilfsfrist überschritten: Anfahrt ${formatSekunden(anfahrtSekunden)} (volle Punkte bis ${formatSekunden(RUF_CONFIG.anfahrtVollSekunden)}).`
        + (wahlPunkte >= 50 ? ' Keine Wache in der Nähe – eine neue Wache würde helfen.' : ''),
    });
  } else {
    hinweise.push({ art: 'gut', text: `Hilfsfrist eingehalten (${formatSekunden(anfahrtSekunden)}).` });
  }

  if (bewertung.ueberzaehlig) {
    hinweise.push({
      art: 'fehler',
      text: `Unnötig viele Kräfte: ${bewertung.ueberzaehlig} Fahrzeug${bewertung.ueberzaehlig > 1 ? 'e' : ''} mehr als nötig (ein Fahrzeug extra ist in Ordnung) – −${bewertung.ueberAbzug} Punkte. Die fehlen dir woanders.`,
    });
  }
  return hinweise;
}

/** Bewertet mehrere abgeschlossene Einsätze nacheinander – der Ruf ändert sich nach jedem. */
export function rechneEinsaetzeAb(einsaetze: AbgeschlossenerSpielEinsatz[], ruf: number) {
  let aktuellerRuf = ruf;
  const bewertet = [...einsaetze]
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((einsatz) => {
      const bewertung = bewerteEinsatz(einsatz, aktuellerRuf);
      aktuellerRuf = begrenzeRuf(aktuellerRuf + bewertung.rufAenderung);
      return { ...einsatz, bewertung };
    });
  return { einsaetze: bewertet, ruf: aktuellerRuf };
}
