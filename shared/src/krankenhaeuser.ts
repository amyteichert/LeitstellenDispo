/**
 * Krankenhäuser als Transportziele des Rettungsdienstes.
 * Bewusst einfach gehalten: Name, Adresse, Koordinaten, Aufnahme ja/nein.
 * Fachbereiche und Kapazitäten sind vorbereitet, werden aber noch nicht ausgewertet.
 */
import { erzeugeAdresse, ermittleOrtFuerWache, formatAdresse, type Adresse } from './adressen.js';
import { clamp, haversineKm } from './geo.js';
import { GAME_CONFIG } from './konfig.js';
import type { Koordinaten, MapLocation } from './typen.js';

export interface Krankenhaus {
  id: string;
  name: string;
  adresse: Adresse;
  coords: Koordinaten;
  /** Nimmt aktuell Patienten auf */
  aufnahme: boolean;
  /** Später: z. B. „Innere“, „Unfallchirurgie“, „Stroke Unit“ */
  fachbereiche?: string[];
  /** Später: freie Betten */
  kapazitaet?: number;
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
  },
  {
    id: 'kh-marienhospital',
    name: 'Marienhospital Stuttgart',
    adresse: { strasse: 'Böheimstraße', hausnummer: '37', plz: '70199', ort: 'Stuttgart' },
    coords: [48.7617, 9.1647],
    aufnahme: true,
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
  },
];

export const formatKrankenhausAdresse = (krankenhaus: Krankenhaus) => formatAdresse(krankenhaus.adresse);

/** Nächstes aufnahmebereites Krankenhaus (Luftlinie) – oder null, wenn keines existiert. */
export function findeZielKrankenhaus(coords: Koordinaten, krankenhaeuser: Krankenhaus[]): Krankenhaus | null {
  let bestes: Krankenhaus | null = null;
  let besteEntfernung = Infinity;
  for (const krankenhaus of krankenhaeuser) {
    if (!krankenhaus.aufnahme) continue;
    const entfernung = haversineKm(coords, krankenhaus.coords);
    if (entfernung < besteEntfernung) {
      bestes = krankenhaus;
      besteEntfernung = entfernung;
    }
  }
  return bestes;
}

/**
 * Stellt sicher, dass es in der Nähe einer Rettungswache ein Krankenhaus gibt.
 * Liegt keines im Einzugsbereich, wird ein Kreisklinikum im Ort der Wache angelegt.
 */
export function ergaenzeKrankenhaeuser(
  krankenhaeuser: Krankenhaus[],
  wache: MapLocation,
  zufall: () => number = Math.random,
): Krankenhaus[] {
  const inDerNaehe = krankenhaeuser.some(
    (krankenhaus) => haversineKm(krankenhaus.coords, wache.coords) <= GAME_CONFIG.krankenhausEinzugsbereichKm,
  );
  if (inDerNaehe) return krankenhaeuser;

  const ort = ermittleOrtFuerWache(wache);
  const entfernungKm = 1.5 + zufall() * 1.5;
  const winkel = zufall() * Math.PI * 2;
  const coords: Koordinaten = [
    clamp(wache.coords[0] + (entfernungKm / 111.32) * Math.cos(winkel), -90, 90),
    clamp(wache.coords[1] + (entfernungKm / (111.32 * Math.cos((wache.coords[0] * Math.PI) / 180))) * Math.sin(winkel), -180, 180),
  ];
  const ortsname = ort.ort.replace(/^Wachbereich\s+/, '');
  return [
    ...krankenhaeuser,
    {
      id: `kh-${wache.id}`,
      name: `Klinikum ${ortsname}`,
      adresse: { ...erzeugeAdresse(ort, 'gebaeude', zufall), strasse: 'Krankenhausstraße' },
      coords,
      aufnahme: true,
      generiert: true,
    },
  ];
}
