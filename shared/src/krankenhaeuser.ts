/**
 * Krankenhäuser als Transportziele des Rettungsdienstes.
 * Patienten mit Fachbedarf (z. B. Herzinfarkt) fahren ins nächste Haus mit passender Fachrichtung, sofern es nicht zu weit ist.
 * Eigene Krankenhäuser bringen Geld je Patient, haben aber begrenzte Betten.
 */
import { erzeugeAdresse, ermittleOrtFuerWache, formatAdresse, type Adresse } from './adressen.js';
import { clamp, haversineKm } from './geo.js';
import { GAME_CONFIG } from './konfig.js';
import type { Koordinaten, MapLocation } from './typen.js';

export type Fachrichtung = 'innere' | 'unfallchirurgie' | 'kardiologie' | 'neurologie';

/** Fachrichtungen für eigene Häuser: Preis und nötiger Ruf */
export const FACHRICHTUNGEN: Record<Fachrichtung, { label: string; kurz: string; preis: number; abRuf: number }> = {
  innere: { label: 'Innere Medizin', kurz: '🩺 Innere', preis: 0, abRuf: 0 },
  unfallchirurgie: { label: 'Unfallchirurgie', kurz: '🦴 Unfall', preis: 150_000, abRuf: 50 },
  kardiologie: { label: 'Herzkatheter (Kardiologie)', kurz: '❤️ Herz', preis: 300_000, abRuf: 65 },
  neurologie: { label: 'Stroke Unit (Neurologie)', kurz: '🧠 Stroke', preis: 400_000, abRuf: 80 },
};

export const GRUNDVERSORGUNG: Fachrichtung[] = ['innere', 'unfallchirurgie'];

export const EIGENES_KRANKENHAUS = {
  preis: 750_000,
  abWachen: 3,
  abRuf: 50,
  startBetten: 10,
  bettenJeAusbau: 10,
  maxBetten: 50,
  bettenAusbauPreis: 100_000,
  /** So lange belegt ein Patient ein Bett */
  liegedauerMs: 2 * 60 * 60 * 1000,
  /** Zusätzlich zur Transportvergütung, je Patient im eigenen Haus */
  verguetungJePatient: 250,
  /** Eigene Häuser werden bevorzugt, solange sie höchstens so viel weiter weg sind */
  bevorzugungKm: 2,
} as const;

/** Weiter fährt man nicht für eine Fachrichtung – dann geht es ins nächste Haus */
export const FACHKLINIK_MAX_KM = 40;

/** Gibt es im Umkreis kein Krankenhaus, wird der Patient vor Ort versorgt (keine Fahrt ins Nirgendwo) */
export const MAX_TRANSPORT_KM = 50;

export const getFachrichtungen = (krankenhaus: Krankenhaus): Fachrichtung[] =>
  krankenhaus.fachbereiche ?? (krankenhaus.eigen ? ['innere'] : GRUNDVERSORGUNG);

export const getBetten = (krankenhaus: Krankenhaus) => krankenhaus.kapazitaet ?? EIGENES_KRANKENHAUS.startBetten;

export const getBelegteBetten = (krankenhaus: Krankenhaus, jetzt: number) =>
  (krankenhaus.aufnahmen ?? []).filter((zeit) => zeit > jetzt - EIGENES_KRANKENHAUS.liegedauerMs).length;

/** Hat der Spieler mindestens ein eigenes Krankenhaus gebaut? */
export const hatEigenesKrankenhaus = (krankenhaeuser: Pick<Krankenhaus, 'eigen'>[]) => krankenhaeuser.some((kh) => kh.eigen);

/** Fremde Häuser nehmen immer auf (sofern nicht abgemeldet), eigene nur mit freien Betten */
export const nimmtAuf = (krankenhaus: Krankenhaus, jetzt: number) =>
  krankenhaus.aufnahme && (!krankenhaus.eigen || getBelegteBetten(krankenhaus, jetzt) < getBetten(krankenhaus));

/** Darf ein eigenes Krankenhaus gebaut werden? Gibt den Grund zurück, wenn nicht. */
export function pruefeKrankenhausBau(wachen: number, ruf: number, guthaben: number): string | null {
  const k = EIGENES_KRANKENHAUS;
  if (wachen < k.abWachen) return `Erst ab ${k.abWachen} Wachen (du hast ${wachen}).`;
  if (ruf < k.abRuf) return `Erst ab Ruf ${k.abRuf} (aktuell ${ruf}).`;
  if (guthaben < k.preis) return `Nicht genug Guthaben (${k.preis.toLocaleString('de-DE')} € nötig).`;
  return null;
}

/** Darf diese Fachrichtung freigeschaltet werden? */
export function pruefeFachrichtung(krankenhaus: Krankenhaus, fachrichtung: Fachrichtung, ruf: number, guthaben: number): string | null {
  const f = FACHRICHTUNGEN[fachrichtung];
  if (getFachrichtungen(krankenhaus).includes(fachrichtung)) return 'Schon vorhanden.';
  if (ruf < f.abRuf) return `Erst ab Ruf ${f.abRuf}.`;
  if (guthaben < f.preis) return 'Nicht genug Guthaben.';
  return null;
}

export function pruefeBettenAusbau(krankenhaus: Krankenhaus, guthaben: number): string | null {
  if (getBetten(krankenhaus) >= EIGENES_KRANKENHAUS.maxBetten) return 'Maximale Bettenzahl erreicht.';
  if (guthaben < EIGENES_KRANKENHAUS.bettenAusbauPreis) return 'Nicht genug Guthaben.';
  return null;
}

/** Nimmt einen Patienten im eigenen Haus auf (alte Einträge fallen weg) */
export const nimmPatientAuf = (krankenhaus: Krankenhaus, jetzt: number): Krankenhaus => ({
  ...krankenhaus,
  aufnahmen: [...(krankenhaus.aufnahmen ?? []).filter((zeit) => zeit > jetzt - EIGENES_KRANKENHAUS.liegedauerMs), jetzt],
});

export interface Krankenhaus {
  id: string;
  name: string;
  adresse: Adresse;
  coords: Koordinaten;
  /** Nimmt aktuell Patienten auf */
  aufnahme: boolean;
  /** Fachrichtungen; fehlt = Grundversorgung (Innere + Unfallchirurgie) */
  fachbereiche?: Fachrichtung[];
  /** Betten (nur eigene Häuser sind begrenzt) */
  kapazitaet?: number;
  /** Eigenes, vom Spieler gebautes Krankenhaus */
  eigen?: boolean;
  /** Aufnahmezeitpunkte eigener Häuser (für die Bettenbelegung) */
  aufnahmen?: number[];
  /** Automatisch für eine Wache ohne Krankenhaus in der Nähe angelegt */
  generiert?: boolean;
}

/** Krankenhäuser im Startgebiet (Stuttgart). Koordinaten sind gerundet. */
export const STANDARD_KRANKENHAEUSER: Krankenhaus[] = [
  {
    id: 'kh-katharinenhospital',
    name: 'Klinikum Stuttgart – Katharinenhospital',
    adresse: { strasse: 'Kriegsbergstraße', hausnummer: '60', plz: '70174', ort: 'Stuttgart' },
    coords: [48.7851, 9.1719],
    aufnahme: true,
    fachbereiche: ['innere', 'unfallchirurgie', 'kardiologie', 'neurologie'],
  },
  {
    id: 'kh-marienhospital',
    name: 'Marienhospital Stuttgart',
    adresse: { strasse: 'Böheimstraße', hausnummer: '37', plz: '70199', ort: 'Stuttgart' },
    coords: [48.7617, 9.1647],
    aufnahme: true,
    fachbereiche: ['innere', 'unfallchirurgie', 'kardiologie'],
  },
  {
    id: 'kh-karl-olga',
    name: 'Karl-Olga-Krankenhaus',
    adresse: { strasse: 'Hackstraße', hausnummer: '61', plz: '70190', ort: 'Stuttgart' },
    coords: [48.7899, 9.2056],
    aufnahme: true,
  },
  {
    id: 'kh-robert-bosch',
    name: 'Robert-Bosch-Krankenhaus',
    adresse: { strasse: 'Auerbachstraße', hausnummer: '110', plz: '70376', ort: 'Stuttgart' },
    coords: [48.8182, 9.2101],
    aufnahme: true,
    fachbereiche: ['innere', 'kardiologie', 'neurologie'],
  },
];

export const formatKrankenhausAdresse = (krankenhaus: Krankenhaus) => formatAdresse(krankenhaus.adresse);

/** Nächstes aufnahmebereites Krankenhaus (Luftlinie) – oder null, wenn keines existiert. */
/**
 * Transportziel: Braucht der Patient eine Fachrichtung, das nächste passende Haus (bis FACHKLINIK_MAX_KM),
 * sonst das nächste aufnahmebereite. Eigene Häuser werden leicht bevorzugt; volle eigene Häuser sind abgemeldet.
 */
export function findeZielKrankenhaus(
  coords: Koordinaten,
  krankenhaeuser: Krankenhaus[],
  fachrichtung?: Fachrichtung,
  jetzt: number = Date.now(),
): Krankenhaus | null {
  const naechstes = (liste: Krankenhaus[]) => {
    let bestes: Krankenhaus | null = null;
    let besteWertung = Infinity;
    for (const krankenhaus of liste) {
      const wertung = haversineKm(coords, krankenhaus.coords) - (krankenhaus.eigen ? EIGENES_KRANKENHAUS.bevorzugungKm : 0);
      if (wertung < besteWertung) {
        bestes = krankenhaus;
        besteWertung = wertung;
      }
    }
    return bestes;
  };
  const aufnahmebereit = krankenhaeuser.filter((krankenhaus) => nimmtAuf(krankenhaus, jetzt));
  if (fachrichtung) {
    const fach = naechstes(aufnahmebereit.filter((krankenhaus) => getFachrichtungen(krankenhaus).includes(fachrichtung)));
    if (fach && haversineKm(coords, fach.coords) <= FACHKLINIK_MAX_KM) return fach;
  }
  const ziel = naechstes(aufnahmebereit);
  return ziel && haversineKm(coords, ziel.coords) <= MAX_TRANSPORT_KM ? ziel : null;
}

