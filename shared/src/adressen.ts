/**
 * Adressen für Einsatzorte, Wachen und Krankenhäuser.
 *
 * Aktuell werden glaubwürdige Adressen erzeugt (häufige deutsche Straßennamen + PLZ/Ort der Wache).
 * Später kann `erzeugeAdresse` durch eine echte Quelle (OSM / Reverse-Geocoding) ersetzt werden –
 * das Datenformat `Adresse` bleibt dabei gleich.
 */
import { haversineKm } from './geo.js';
import type { Koordinaten, MapLocation } from './typen.js';

export interface Adresse {
  /** Straße oder Kreuzung, z. B. „Bahnhofstraße“ oder „Hauptstraße / Ecke Schulstraße“ */
  strasse: string;
  hausnummer?: string;
  plz?: string;
  ort: string;
}

/** Ein Ort im Spiel: Adresse und Koordinaten gehören immer zusammen. */
export interface Ort {
  adresse: Adresse;
  coords: Koordinaten;
}

/** Wie der Einsatzort beschrieben wird */
export type OrtsArt = 'gebaeude' | 'strasse' | 'kreuzung';

export function formatAdresse(adresse: Adresse): string {
  const strasse = adresse.hausnummer ? `${adresse.strasse} ${adresse.hausnummer}` : adresse.strasse;
  const ort = [adresse.plz, adresse.ort].filter(Boolean).join(' ');
  return ort ? `${strasse}, ${ort}` : strasse;
}

/** Häufige deutsche Straßennamen – klingen überall glaubwürdig. */
export const STRASSENNAMEN = [
  'Hauptstraße', 'Bahnhofstraße', 'Schulstraße', 'Gartenstraße', 'Dorfstraße', 'Kirchstraße', 'Bergstraße',
  'Lindenstraße', 'Goethestraße', 'Schillerstraße', 'Ringstraße', 'Mühlenweg', 'Birkenweg', 'Waldstraße',
  'Wiesenweg', 'Am Markt', 'Friedhofstraße', 'Rosenstraße', 'Mozartstraße', 'Industriestraße', 'Parkstraße',
  'Feldstraße', 'Ahornweg', 'Lessingstraße', 'Talstraße', 'Neue Straße', 'Kastanienallee', 'Uhlandstraße',
  'Eichenweg', 'Brunnenstraße', 'Blumenstraße', 'Beethovenstraße', 'Tannenweg', 'Kirchplatz', 'Mittelweg',
];

/** Rückfallebene, falls eine Wache keine Adresse hat: bekannte Orte mit Koordinaten. */
const BEKANNTE_ORTE: Array<{ ort: string; plz: string; coords: Koordinaten }> = [
  { ort: 'Stuttgart', plz: '70173', coords: [48.7758, 9.1829] },
  { ort: 'Berlin', plz: '10117', coords: [52.52, 13.405] },
  { ort: 'Hamburg', plz: '20095', coords: [53.5511, 9.9937] },
  { ort: 'München', plz: '80331', coords: [48.1351, 11.582] },
  { ort: 'Köln', plz: '50667', coords: [50.9375, 6.9603] },
  { ort: 'Frankfurt am Main', plz: '60311', coords: [50.1109, 8.6821] },
  { ort: 'Düsseldorf', plz: '40213', coords: [51.2277, 6.7735] },
  { ort: 'Leipzig', plz: '04109', coords: [51.3397, 12.3731] },
  { ort: 'Dresden', plz: '01067', coords: [51.0504, 13.7373] },
  { ort: 'Hannover', plz: '30159', coords: [52.3759, 9.732] },
  { ort: 'Nürnberg', plz: '90403', coords: [49.4521, 11.0767] },
  { ort: 'Potsdam', plz: '14467', coords: [52.3906, 13.0645] },
  { ort: 'Brandenburg an der Havel', plz: '14770', coords: [52.4125, 12.5316] },
  { ort: 'Karlsruhe', plz: '76133', coords: [49.0069, 8.4037] },
  { ort: 'Mannheim', plz: '68159', coords: [49.4875, 8.466] },
  { ort: 'Bremen', plz: '28195', coords: [53.0793, 8.8017] },
  { ort: 'Dortmund', plz: '44135', coords: [51.5136, 7.4653] },
  { ort: 'Essen', plz: '45127', coords: [51.4556, 7.0116] },
];

const BEKANNTER_ORT_MAX_KM = 25;

/** PLZ und Ort aus einem Freitext wie „Musterstraße 12, 14467 Potsdam“. */
export function leseOrtAusText(text: string | undefined): { plz?: string; ort: string } | null {
  if (!text) return null;
  const treffer = text.match(/\b(\d{5})\s+([A-Za-zÄÖÜäöüß][^,\d]*)/);
  return treffer ? { plz: treffer[1], ort: treffer[2].trim() } : null;
}

/**
 * PLZ und Ort für Einsätze rund um eine Wache:
 * 1. strukturierte Adresse der Wache, 2. Adresse im Freitext, 3. nächster bekannter Ort, 4. Wachbereich.
 */
export function ermittleOrtFuerWache(wache: Pick<MapLocation, 'name' | 'coords' | 'details' | 'adresse'>): { plz?: string; ort: string } {
  if (wache.adresse?.ort) return { plz: wache.adresse.plz, ort: wache.adresse.ort };
  const ausText = leseOrtAusText(wache.details);
  if (ausText) return ausText;
  const naechster = [...BEKANNTE_ORTE].sort((a, b) => haversineKm(a.coords, wache.coords) - haversineKm(b.coords, wache.coords))[0];
  if (naechster && haversineKm(naechster.coords, wache.coords) <= BEKANNTER_ORT_MAX_KM) {
    return { plz: naechster.plz, ort: naechster.ort };
  }
  return { ort: `Wachbereich ${wache.name}` };
}

const waehle = <T>(liste: T[], zufall: () => number): T => liste[Math.floor(zufall() * liste.length) % liste.length];

/** Erzeugt eine glaubwürdige Adresse im Ort der Wache. */
export function erzeugeAdresse(
  ortsangabe: { plz?: string; ort: string },
  ortsArt: OrtsArt = 'gebaeude',
  zufall: () => number = Math.random,
): Adresse {
  const strasse = waehle(STRASSENNAMEN, zufall);
  if (ortsArt === 'kreuzung') {
    const andere = waehle(STRASSENNAMEN.filter((name) => name !== strasse), zufall);
    return { strasse: `${strasse} / Ecke ${andere}`, ...ortsangabe };
  }
  if (ortsArt === 'strasse') {
    return { strasse: `${strasse} (Höhe Nr. ${1 + Math.floor(zufall() * 80)})`, ...ortsangabe };
  }
  return { strasse, hausnummer: String(1 + Math.floor(zufall() * 120)), ...ortsangabe };
}

/**
 * Wandelt die Adressdetails der OpenStreetMap-Suche (Nominatim, `addressdetails=1`) in eine Adresse um.
 * Liefert null, wenn kein Ort erkennbar ist.
 */
export function adresseAusOsm(details: Record<string, string | undefined> | undefined): Adresse | null {
  if (!details) return null;
  const ort = details.city ?? details.town ?? details.village ?? details.municipality ?? details.county;
  if (!ort) return null;
  return {
    strasse: details.road ?? details.pedestrian ?? details.suburb ?? ort,
    hausnummer: details.house_number,
    plz: details.postcode,
    ort,
  };
}
