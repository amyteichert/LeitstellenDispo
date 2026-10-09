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
  /** Betten entstehen über Pflegepersonal: jede Pflegekraft betreut so viele Betten */
  bettenJePflegekraft: 2,
  /** Pflegekräfte der Inneren beim Bau */
  startPflegekraefte: 5,
  /** Pflegekräfte einer neu freigeschalteten Station */
  startPflegekraefteJeStation: 2,
  pflegekraftPreis: 20_000,
  /** Höchstens so viele Betten je Station */
  maxBettenJeStation: 30,
  /** So lange belegt ein Patient ein Bett */
  liegedauerMs: 2 * 60 * 60 * 1000,
  /** Zusätzlich zur Transportvergütung, je Patient im eigenen Haus */
  verguetungJePatient: 250,
  /** Eigene Häuser werden bevorzugt, solange sie höchstens so viel weiter weg sind */
  bevorzugungKm: 2,
} as const;

/** Ruf eines eigenen Krankenhauses: bestimmt, wie viel ein Patient dort einbringt */
export const KRANKENHAUS_RUF = {
  start: 50,
  min: 0,
  max: 100,
  /** Patient bekommt die Fachabteilung, die er braucht */
  passendeFachabteilung: 1,
  /** Patient bräuchte eine Fachabteilung, die das Haus nicht hat */
  fehlendeFachabteilung: -2,
  /** Notaufnahme von Hand abgemeldet – der Rettungsdienst muss ausweichen */
  abmeldung: -3,
} as const;

export const getKrankenhausRuf = (krankenhaus: Pick<Krankenhaus, 'ruf'>) => krankenhaus.ruf ?? KRANKENHAUS_RUF.start;

const begrenzeKrankenhausRuf = (ruf: number) => Math.min(KRANKENHAUS_RUF.max, Math.max(KRANKENHAUS_RUF.min, ruf));

/** Ändert den Ruf eines Hauses (bleibt zwischen 0 und 100) */
export const mitKrankenhausRuf = (krankenhaus: Krankenhaus, aenderung: number): Krankenhaus => ({
  ...krankenhaus,
  ruf: begrenzeKrankenhausRuf(getKrankenhausRuf(krankenhaus) + aenderung),
});

/** Vergütung je Patient im eigenen Haus: Ruf 50 = normal, Ruf 100 = 1,5-fach, Ruf 0 = halb */
export const getVerguetungJePatient = (krankenhaus: Pick<Krankenhaus, 'ruf'>) =>
  Math.round(EIGENES_KRANKENHAUS.verguetungJePatient * (0.5 + getKrankenhausRuf(krankenhaus) / 100));

/** Notaufnahme: jeder Patient belegt dort kurz einen Platz, bevor er auf Station kommt */
export const NOTAUFNAHME = {
  startPlaetze: 4,
  maxPlaetze: 12,
  platzPreis: 30_000,
  verweildauerMs: 30 * 60 * 1000,
} as const;

type Aufnahme = NonNullable<Krankenhaus['aufnahmen']>[number];
const aufnahmeZeit = (a: Aufnahme) => (typeof a === 'number' ? a : a.zeit);
/** Ältere Spielstände merkten nur die Zeit – diese Patienten liegen auf der Inneren */
const aufnahmeStation = (a: Aufnahme): Fachrichtung => (typeof a === 'number' ? 'innere' : a.station);

/** Auf welche Station kommt ein Patient? Die passende Fachabteilung, sonst die Innere. */
export const getStationFuer = (krankenhaus: Krankenhaus, fachrichtung?: Fachrichtung): Fachrichtung =>
  fachrichtung && getFachrichtungen(krankenhaus).includes(fachrichtung) ? fachrichtung : 'innere';

/** Pflegekräfte aus älteren Spielständen (eine Zahl fürs ganze Haus) gleichmäßig auf die Stationen verteilen */
const altePflegekraefte = (krankenhaus: Krankenhaus, station: Fachrichtung): number => {
  const gesamt = krankenhaus.pflegekraefte
    ?? (krankenhaus.kapazitaet !== undefined
      ? Math.ceil(krankenhaus.kapazitaet / EIGENES_KRANKENHAUS.bettenJePflegekraft)
      : EIGENES_KRANKENHAUS.startPflegekraefte);
  const stationen = getFachrichtungen(krankenhaus);
  const je = Math.floor(gesamt / stationen.length);
  return station === 'innere' ? gesamt - je * (stationen.length - 1) : je;
};

/** Pflegekräfte einer Station */
export const getStationsPflegekraefte = (krankenhaus: Krankenhaus, station: Fachrichtung): number => {
  if (!getFachrichtungen(krankenhaus).includes(station)) return 0;
  return krankenhaus.stationen ? krankenhaus.stationen[station] ?? 0 : altePflegekraefte(krankenhaus, station);
};

/** Pflegekräfte im ganzen Haus */
export const getPflegekraefte = (krankenhaus: Krankenhaus) =>
  getFachrichtungen(krankenhaus).reduce((summe, station) => summe + getStationsPflegekraefte(krankenhaus, station), 0);

export const getStationsBetten = (krankenhaus: Krankenhaus, station: Fachrichtung) =>
  Math.min(EIGENES_KRANKENHAUS.maxBettenJeStation, getStationsPflegekraefte(krankenhaus, station) * EIGENES_KRANKENHAUS.bettenJePflegekraft);

export const getBelegteStationsBetten = (krankenhaus: Krankenhaus, station: Fachrichtung, jetzt: number) =>
  (krankenhaus.aufnahmen ?? []).filter((a) => aufnahmeStation(a) === station && aufnahmeZeit(a) > jetzt - EIGENES_KRANKENHAUS.liegedauerMs).length;

export const getNotaufnahmePlaetze = (krankenhaus: Pick<Krankenhaus, 'notaufnahmePlaetze'>) =>
  krankenhaus.notaufnahmePlaetze ?? NOTAUFNAHME.startPlaetze;

export const getBelegteNotaufnahme = (krankenhaus: Krankenhaus, jetzt: number) =>
  (krankenhaus.aufnahmen ?? []).filter((a) => aufnahmeZeit(a) > jetzt - NOTAUFNAHME.verweildauerMs).length;

/** Stationen alle als eigene Zahlen festhalten (nötig, bevor eine einzelne Station geändert wird) */
const mitStationen = (krankenhaus: Krankenhaus): Krankenhaus => ({
  ...krankenhaus,
  stationen: Object.fromEntries(getFachrichtungen(krankenhaus).map((station) => [station, getStationsPflegekraefte(krankenhaus, station)])),
});

/** Darf auf dieser Station eine weitere Pflegekraft eingestellt werden? */
export function pruefePflegekraft(krankenhaus: Krankenhaus, station: Fachrichtung, guthaben: number): string | null {
  if (!getFachrichtungen(krankenhaus).includes(station)) return 'Diese Station gibt es hier nicht.';
  if (getStationsBetten(krankenhaus, station) >= EIGENES_KRANKENHAUS.maxBettenJeStation) {
    return `Mehr als ${EIGENES_KRANKENHAUS.maxBettenJeStation} Betten hat keine Station.`;
  }
  if (guthaben < EIGENES_KRANKENHAUS.pflegekraftPreis) return 'Nicht genug Guthaben.';
  return null;
}

export const mitNeuerPflegekraft = (krankenhaus: Krankenhaus, station: Fachrichtung): Krankenhaus => {
  const mit = mitStationen(krankenhaus);
  return { ...mit, stationen: { ...mit.stationen, [station]: getStationsPflegekraefte(krankenhaus, station) + 1 } };
};

/** Neue Fachabteilung: bekommt eine eigene Station mit ein paar Pflegekräften */
export const mitFachrichtung = (krankenhaus: Krankenhaus, fachrichtung: Fachrichtung): Krankenhaus => {
  const mit = mitStationen(krankenhaus);
  return {
    ...mit,
    fachbereiche: [...getFachrichtungen(krankenhaus), fachrichtung],
    stationen: { ...mit.stationen, [fachrichtung]: EIGENES_KRANKENHAUS.startPflegekraefteJeStation },
  };
};

export function pruefeNotaufnahmePlatz(krankenhaus: Krankenhaus, guthaben: number): string | null {
  if (getNotaufnahmePlaetze(krankenhaus) >= NOTAUFNAHME.maxPlaetze) return `Mehr als ${NOTAUFNAHME.maxPlaetze} Plätze hat keine Notaufnahme.`;
  if (guthaben < NOTAUFNAHME.platzPreis) return 'Nicht genug Guthaben.';
  return null;
}

export const mitNotaufnahmePlatz = (krankenhaus: Krankenhaus): Krankenhaus => ({
  ...krankenhaus,
  notaufnahmePlaetze: getNotaufnahmePlaetze(krankenhaus) + 1,
});

/**
 * Notaufnahme an- oder abmelden (nur eigene Häuser). Abmelden kostet Ruf – der Rettungsdienst muss ausweichen.
 */
export const mitNotaufnahme = (krankenhaus: Krankenhaus, angemeldet: boolean, jetzt: number): Krankenhaus => {
  if (krankenhaus.aufnahme === angemeldet) return krankenhaus;
  const umgeschaltet: Krankenhaus = { ...krankenhaus, aufnahme: angemeldet, abgemeldetSeit: angemeldet ? undefined : jetzt };
  return angemeldet ? umgeschaltet : mitKrankenhausRuf(umgeschaltet, KRANKENHAUS_RUF.abmeldung);
};

/** Ist die Notaufnahme gerade voll (meldet sich dann automatisch ab)? */
export const istNotaufnahmeVoll = (krankenhaus: Krankenhaus, jetzt: number) =>
  Boolean(krankenhaus.eigen) && getBelegteNotaufnahme(krankenhaus, jetzt) >= getNotaufnahmePlaetze(krankenhaus);

/** Weiter fährt man nicht für eine Fachrichtung – dann geht es ins nächste Haus */
export const FACHKLINIK_MAX_KM = 40;

/** Gibt es im Umkreis kein Krankenhaus, wird der Patient vor Ort versorgt (keine Fahrt ins Nirgendwo) */
export const MAX_TRANSPORT_KM = 50;

export const getFachrichtungen = (krankenhaus: Krankenhaus): Fachrichtung[] =>
  krankenhaus.fachbereiche ?? (krankenhaus.eigen ? ['innere'] : GRUNDVERSORGUNG);

/** Betten im ganzen Haus (Summe aller Stationen) */
export const getBetten = (krankenhaus: Krankenhaus) =>
  getFachrichtungen(krankenhaus).reduce((summe, station) => summe + getStationsBetten(krankenhaus, station), 0);

export const getBelegteBetten = (krankenhaus: Krankenhaus, jetzt: number) =>
  getFachrichtungen(krankenhaus).reduce((summe, station) => summe + getBelegteStationsBetten(krankenhaus, station, jetzt), 0);

/** Hat der Spieler mindestens ein eigenes Krankenhaus gebaut? */
export const hatEigenesKrankenhaus = (krankenhaeuser: Pick<Krankenhaus, 'eigen'>[]) => krankenhaeuser.some((kh) => kh.eigen);

/**
 * Fremde Häuser nehmen immer auf (sofern nicht abgemeldet). Eigene nur, wenn in der Notaufnahme ein Platz
 * und auf der passenden Station (bzw. der Inneren) ein Bett frei ist.
 */
export const nimmtAuf = (krankenhaus: Krankenhaus, jetzt: number, fachrichtung?: Fachrichtung) => {
  if (!krankenhaus.aufnahme) return false;
  if (!krankenhaus.eigen) return true;
  const station = getStationFuer(krankenhaus, fachrichtung);
  return !istNotaufnahmeVoll(krankenhaus, jetzt)
    && getBelegteStationsBetten(krankenhaus, station, jetzt) < getStationsBetten(krankenhaus, station);
};

export interface VerlegungsMoeglichkeit {
  von: Krankenhaus;
  nach: Krankenhaus;
  /** Diese Abteilung hat nur das Zielhaus */
  fachrichtung: Fachrichtung;
}

/**
 * Mögliche Verlegungen zwischen eigenen Häusern: Haus B hat eine Fachabteilung, die Haus A fehlt.
 * Nur wenn B aufnimmt und nicht weiter als MAX_TRANSPORT_KM entfernt ist.
 */
export function findeVerlegungen(krankenhaeuser: Krankenhaus[], jetzt: number = Date.now()): VerlegungsMoeglichkeit[] {
  const eigene = krankenhaeuser.filter((kh) => kh.eigen);
  return eigene.flatMap((von) => eigene
    .filter((nach) => nach.id !== von.id && haversineKm(von.coords, nach.coords) <= MAX_TRANSPORT_KM)
    .flatMap((nach) => getFachrichtungen(nach)
      .filter((fachrichtung) => !getFachrichtungen(von).includes(fachrichtung) && nimmtAuf(nach, jetzt, fachrichtung))
      .map((fachrichtung) => ({ von, nach, fachrichtung }))));
}

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

/**
 * Nimmt einen Patienten im eigenen Haus auf (alte Einträge fallen weg).
 * Mit Fachbedarf ändert sich der Ruf: passende Abteilung +, fehlende Abteilung −.
 */
export const nimmPatientAuf = (krankenhaus: Krankenhaus, jetzt: number, fachrichtung?: Fachrichtung): Krankenhaus => {
  const aufgenommen: Krankenhaus = {
    ...krankenhaus,
    aufnahmen: [
      ...(krankenhaus.aufnahmen ?? []).filter((a) => aufnahmeZeit(a) > jetzt - EIGENES_KRANKENHAUS.liegedauerMs),
      { zeit: jetzt, station: getStationFuer(krankenhaus, fachrichtung) },
    ],
  };
  if (!fachrichtung) return aufgenommen;
  return mitKrankenhausRuf(aufgenommen, getFachrichtungen(krankenhaus).includes(fachrichtung)
    ? KRANKENHAUS_RUF.passendeFachabteilung
    : KRANKENHAUS_RUF.fehlendeFachabteilung);
};

export interface Krankenhaus {
  id: string;
  name: string;
  adresse: Adresse;
  coords: Koordinaten;
  /** Nimmt aktuell Patienten auf */
  aufnahme: boolean;
  /** Fachrichtungen; fehlt = Grundversorgung (Innere + Unfallchirurgie) */
  fachbereiche?: Fachrichtung[];
  /** Früher gekaufte Betten – nur noch für ältere Spielstände (heute: Pflegekräfte) */
  kapazitaet?: number;
  /** Früher: Pflegekräfte fürs ganze Haus – nur noch für ältere Spielstände (heute je Station) */
  pflegekraefte?: number;
  /** Pflegekräfte je Station (jede betreut 2 Betten) */
  stationen?: Partial<Record<Fachrichtung, number>>;
  /** Behandlungsplätze der Notaufnahme */
  notaufnahmePlaetze?: number;
  /** Ruf eines eigenen Hauses (0–100) */
  ruf?: number;
  /** Seit wann die Notaufnahme von Hand abgemeldet ist */
  abgemeldetSeit?: number;
  /** Eigenes, vom Spieler gebautes Krankenhaus */
  eigen?: boolean;
  /** Aufnahmen eigener Häuser (für Notaufnahme und Betten); ältere Spielstände: nur die Zeit */
  aufnahmen?: Array<number | { zeit: number; station: Fachrichtung }>;
  /** Automatisch für eine Wache ohne Krankenhaus in der Nähe angelegt */
  generiert?: boolean;
}

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
  const aufnahmebereit = krankenhaeuser.filter((krankenhaus) => nimmtAuf(krankenhaus, jetzt, fachrichtung));
  if (fachrichtung) {
    const fach = naechstes(aufnahmebereit.filter((krankenhaus) => getFachrichtungen(krankenhaus).includes(fachrichtung)));
    if (fach && haversineKm(coords, fach.coords) <= FACHKLINIK_MAX_KM) return fach;
  }
  const ziel = naechstes(aufnahmebereit);
  return ziel && haversineKm(coords, ziel.coords) <= MAX_TRANSPORT_KM ? ziel : null;
}

