/**
 * Personal der Wachen: Einstellen, feste Zuweisung zu Fahrzeugen, Pflicht-Qualifikationen und Personal-Limit.
 * Die Besatzung eines Fahrzeugs (`besatzung`, `fehlendeQualifikation`) wird aus dem Personal berechnet,
 * damit Alarmierung und Spiel-Tick nur auf das Fahrzeug schauen müssen.
 */
import { getFahrzeugTyp, type Qualifikation } from './fahrzeuge.js';
import type { MapLocation, Vehicle, WachenArt } from './typen.js';

export interface Mitarbeiter {
  id: string;
  name: string;
  wacheId: string;
  qualifikationen: Qualifikation[];
  /** Fest zugewiesenes Fahrzeug (fehlt = in Reserve) */
  fahrzeugId?: string;
  /** Gesetzt, solange die Person auf einem Lehrgang ist (bis zu diesem Zeitpunkt) */
  inAusbildungBis?: number;
  /** Hat bei uns einen Lehrgang abgeschlossen – kündigt seltener */
  ausgebildet?: boolean;
}

/** Bewerber (noch nicht eingestellt) */
export type Bewerber = Omit<Mitarbeiter, 'wacheId' | 'fahrzeugId'> & { preis: number };

export const PERSONAL_CONFIG = {
  /** Personal-Plätze einer neuen Wache */
  limit: { Rettungswache: 6, Feuerwache: 12 } as Record<WachenArt, number>,
  grundpreis: 1500,
  qualifikationsPreis: { notfallsanitaeter: 1500, notarzt: 4000, maschinist_dlk: 1000, gruppenfuehrer: 1500 } as Record<Qualifikation, number>,
  /** Wahrscheinlichkeit, dass ein Bewerber diese Qualifikation mitbringt – je Wachenart */
  qualifikationsChance: {
    Rettungswache: { notfallsanitaeter: 0.45, notarzt: 0.12 },
    Feuerwache: { gruppenfuehrer: 0.2, maschinist_dlk: 0.2 },
  } as Record<WachenArt, Partial<Record<Qualifikation, number>>>,
  bewerberAnzahl: 4,
} as const;

/** Ausbau „Ruheräume“: mehr Personal-Plätze auf der Wache */
export const RUHERAUM_CONFIG = {
  plaetzeJeStufe: { Rettungswache: 3, Feuerwache: 6 } as Record<WachenArt, number>,
  maxStufe: 5,
  erstePreis: 15000,
  preisFaktor: 1.6,
} as const;

const wachenArt = (wache: Pick<MapLocation, 'stationKind'>): WachenArt => wache.stationKind ?? 'Rettungswache';

export const getRuheraumStufe = (wache: Pick<MapLocation, 'ausbau'>) => wache.ausbau?.ruheraum ?? 0;

export const getPersonalLimit = (wache: Pick<MapLocation, 'stationKind' | 'ausbau'>) =>
  PERSONAL_CONFIG.limit[wachenArt(wache)] + getRuheraumStufe(wache) * RUHERAUM_CONFIG.plaetzeJeStufe[wachenArt(wache)];

export function getRuheraumPreis(wache: Pick<MapLocation, 'ausbau'>): number | null {
  const stufe = getRuheraumStufe(wache);
  if (stufe >= RUHERAUM_CONFIG.maxStufe) return null;
  return Math.round((RUHERAUM_CONFIG.erstePreis * RUHERAUM_CONFIG.preisFaktor ** stufe) / 500) * 500;
}

export const mitRuheraumAusbau = (wache: MapLocation): MapLocation => ({
  ...wache,
  ausbau: { ...wache.ausbau, ruheraum: getRuheraumStufe(wache) + 1 },
});

export const getPersonalDerWache = (wacheId: string, personal: Mitarbeiter[]) =>
  personal.filter((person) => person.wacheId === wacheId);

export const getEinstellungsPreis = (qualifikationen: Qualifikation[]) =>
  PERSONAL_CONFIG.grundpreis + qualifikationen.reduce((summe, q) => summe + PERSONAL_CONFIG.qualifikationsPreis[q], 0);

const VORNAMEN = ['Anna', 'Ben', 'Clara', 'David', 'Elif', 'Felix', 'Greta', 'Hannah', 'Jonas', 'Julia', 'Kai', 'Lea', 'Lukas',
  'Mara', 'Max', 'Mia', 'Noah', 'Paul', 'Sara', 'Simon', 'Sophie', 'Tim', 'Yusuf', 'Zoe'];
const NACHNAMEN = ['Bauer', 'Becker', 'Fischer', 'Hoffmann', 'Kaya', 'Klein', 'Koch', 'Krüger', 'Lang', 'Meyer', 'Müller',
  'Neumann', 'Richter', 'Schmidt', 'Schneider', 'Schulz', 'Wagner', 'Weber', 'Wolf', 'Yilmaz', 'Zimmermann'];

const zufallsName = (zufall: () => number) =>
  `${VORNAMEN[Math.floor(zufall() * VORNAMEN.length)]} ${NACHNAMEN[Math.floor(zufall() * NACHNAMEN.length)]}`;

const neueId = (zufall: () => number) => `person-${Date.now()}-${Math.floor(zufall() * 1e9).toString(16)}`;

/**
 * Bewerber für eine Wache – Qualifikationen zufällig, passend zur Wachenart.
 * `chancenFaktor` > 1 (zufriedenes Personal spricht sich herum) macht qualifizierte Bewerber häufiger.
 */
export function erzeugeBewerber(
  wache: Pick<MapLocation, 'stationKind'>,
  anzahl: number = PERSONAL_CONFIG.bewerberAnzahl,
  zufall: () => number = Math.random,
  chancenFaktor = 1,
): Bewerber[] {
  const chancen = Object.entries(PERSONAL_CONFIG.qualifikationsChance[wachenArt(wache)]) as Array<[Qualifikation, number]>;
  return Array.from({ length: anzahl }, () => {
    const qualifikationen = chancen.filter(([, chance]) => zufall() < chance * chancenFaktor).map(([q]) => q);
    return { id: neueId(zufall), name: zufallsName(zufall), qualifikationen, preis: getEinstellungsPreis(qualifikationen) };
  });
}

/** Personal, das ein Fahrzeug vollständig besetzt (inkl. Pflicht-Qualifikation) – für Startfahrzeuge und alte Spielstände. */
export function erzeugeBesatzungFuer(vehicle: Vehicle, zufall: () => number = Math.random): Mitarbeiter[] {
  const typ = getFahrzeugTyp(vehicle.type);
  if (!typ || !vehicle.stationId) return [];
  return Array.from({ length: typ.besatzung }, (_, index) => ({
    id: `${neueId(zufall)}-${index}`,
    name: zufallsName(zufall),
    wacheId: vehicle.stationId!,
    qualifikationen: index === 0 && typ.pflichtQualifikation ? [typ.pflichtQualifikation] : [],
    fahrzeugId: vehicle.id,
  }));
}

/** Darf die Besatzung gerade geändert werden? Nur wenn das Fahrzeug einsatzbereit an der Wache steht. */
export const kannUmbesetzen = (vehicle: Vehicle) =>
  (vehicle.status ?? 'Einsatzbereit') === 'Einsatzbereit' && !vehicle.rueckfahrt;

/**
 * Besatzung und fehlende Pflicht-Qualifikation aller Fahrzeuge aus dem Personal berechnen.
 * Ändert sich nichts, kommt dasselbe Array zurück (wichtig für React-Effekte).
 */
export function synchronisiereBesatzung(vehicles: Vehicle[], personal: Mitarbeiter[]): Vehicle[] {
  let geaendert = false;
  const ergebnis = vehicles.map((vehicle) => {
    const besatzung = personal.filter((person) => person.fahrzeugId === vehicle.id);
    const pflicht = getFahrzeugTyp(vehicle.type)?.pflichtQualifikation;
    const fehlendeQualifikation = pflicht && !besatzung.some((person) => person.qualifikationen.includes(pflicht)) ? pflicht : undefined;
    if (vehicle.besatzung === besatzung.length && vehicle.fehlendeQualifikation === fehlendeQualifikation) return vehicle;
    geaendert = true;
    return { ...vehicle, besatzung: besatzung.length, fehlendeQualifikation };
  });
  return geaendert ? ergebnis : vehicles;
}

/**
 * Besetzt ein Fahrzeug mit freiem Personal (Reserve) seiner Wache:
 * zuerst die Pflicht-Qualifikation, dann bevorzugt Personal ohne andere gesuchte Qualifikation.
 */
export function besetzeAutomatisch(vehicle: Vehicle, personal: Mitarbeiter[]): Mitarbeiter[] {
  const typ = getFahrzeugTyp(vehicle.type);
  if (!typ || !vehicle.stationId) return personal;
  let besatzung = personal.filter((person) => person.fahrzeugId === vehicle.id);
  const reserve = personal.filter((person) => person.wacheId === vehicle.stationId && !person.fahrzeugId && person.inAusbildungBis === undefined);
  const gewaehlt: string[] = [];
  let abgezogen: string | undefined;

  const pflicht = typ.pflichtQualifikation;
  if (pflicht && !besatzung.some((person) => person.qualifikationen.includes(pflicht))) {
    const qualifiziert = reserve
      .filter((person) => person.qualifikationen.includes(pflicht))
      .sort((a, b) => a.qualifikationen.length - b.qualifikationen.length)[0];
    if (qualifiziert) {
      gewaehlt.push(qualifiziert.id);
      // Fahrzeug schon voll? Dann tauscht eine Person ohne Pflicht-Qualifikation in die Reserve
      if (besatzung.length >= typ.besatzung) {
        abgezogen = besatzung[besatzung.length - 1].id;
        besatzung = besatzung.slice(0, -1);
      }
    }
  }
  // Rest auffüllen – Spezialisten (mehr Qualifikationen) zuletzt, damit sie für andere Fahrzeuge frei bleiben
  const rest = reserve
    .filter((person) => !gewaehlt.includes(person.id))
    .sort((a, b) => a.qualifikationen.length - b.qualifikationen.length);
  const freiePlaetze = typ.besatzung - besatzung.length - gewaehlt.length;
  gewaehlt.push(...rest.slice(0, Math.max(0, freiePlaetze)).map((person) => person.id));

  return personal.map((person) => {
    if (gewaehlt.includes(person.id)) return { ...person, fahrzeugId: vehicle.id };
    if (person.id === abgezogen) return { ...person, fahrzeugId: undefined };
    return person;
  });
}
