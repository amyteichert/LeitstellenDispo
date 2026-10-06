/**
 * Spielstand: Aufbau, Startzustand und Migration älterer Versionen.
 * Reine Funktionen – der Client speichert im Browser, ein Server könnte dasselbe Format nutzen.
 */
import { erzeugeAdresse, ermittleOrtFuerWache, formatAdresse } from './adressen.js';
import {
  START_GUTHABEN,
  findeEinsatzVorlage,
  type AbgeschlossenerSpielEinsatz,
  type SpielEinsatz,
} from './daten.js';
import { STANDARD_KRANKENHAEUSER, ergaenzeKrankenhaeuser, type Krankenhaus } from './krankenhaeuser.js';
import { erzeugePatienten } from './patienten.js';
import type { FinanceTransaction, MapLocation, Vehicle } from './typen.js';

/** Wird erhöht, wenn sich der Aufbau des Spielstands ändert (ältere Versionen werden migriert). */
export const SPIELSTAND_VERSION = 3;

/** Alles, was zum Fortsetzen eines Spiels gespeichert werden muss. */
export interface Spielstand {
  version: number;
  gespeichertAm: string;
  balance: number;
  transactions: FinanceTransaction[];
  locations: MapLocation[];
  vehicles: Vehicle[];
  incidents: SpielEinsatz[];
  completedIncidentHistory: AbgeschlossenerSpielEinsatz[];
  krankenhaeuser: Krankenhaus[];
}

export const START_WACHEN: MapLocation[] = [
  {
    id: 'rettungswache-zentrum',
    name: 'Rettungswache Zentrum',
    type: 'station',
    stationKind: 'Rettungswache',
    coords: [48.775, 9.1771],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
    price: 0,
    adresse: { strasse: 'Rotebühlplatz', plz: '70173', ort: 'Stuttgart' },
  },
  {
    id: 'rettungswache-sued',
    name: 'Rettungswache Süd',
    type: 'station',
    stationKind: 'Rettungswache',
    coords: [48.7692, 9.1931],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
    price: 0,
    adresse: { strasse: 'Hohenheimer Straße', plz: '70184', ort: 'Stuttgart' },
  },
];

/** Startzustand für ein neues Spiel: zwei Rettungswachen mit einem RTW, Krankenhäuser und Startguthaben. */
export const createNeuesSpiel = (jetzt: Date = new Date()): Spielstand => ({
  version: SPIELSTAND_VERSION,
  gespeichertAm: jetzt.toISOString(),
  balance: START_GUTHABEN,
  transactions: [
    { id: 'initial-balance', kind: 'Einnahme', label: 'Startguthaben', amount: START_GUTHABEN, createdAt: jetzt.toISOString() },
  ],
  locations: START_WACHEN,
  vehicles: [
    { id: 'fahrzeug-1', name: 'RTW 1', type: 'RTW', stationId: 'rettungswache-zentrum', price: 0, callsign: 'RTW-1', status: 'Einsatzbereit', besatzung: 2 },
  ],
  incidents: [],
  completedIncidentHistory: [],
  krankenhaeuser: STANDARD_KRANKENHAEUSER,
});

/** Krankenhäuser für alle Wachen ergänzen (z. B. nach dem Laden eines alten Spielstands). */
export const ergaenzeKrankenhaeuserFuerWachen = (krankenhaeuser: Krankenhaus[], locations: MapLocation[]): Krankenhaus[] =>
  locations
    .filter((location) => location.type === 'station')
    .reduce((liste, station) => ergaenzeKrankenhaeuser(liste, station), krankenhaeuser);

/** Version 2 → 3: Adressen, Patienten und Krankenhäuser nachrüsten. */
const migriereV2 = (alt: Omit<Spielstand, 'krankenhaeuser'>): Spielstand => {
  const locations = alt.locations.map((location) => {
    const start = START_WACHEN.find((wache) => wache.id === location.id);
    return start && !location.adresse ? { ...location, adresse: start.adresse } : location;
  });
  const incidents = alt.incidents.map((incident): SpielEinsatz => {
    let ergebnis = incident;
    if (!ergebnis.adresse) {
      const wache = locations.find((location) => location.id === incident.generatedByStationId);
      // Wache gelöscht? Dann den Ort über die Einsatzkoordinaten bestimmen
      const adresse = erzeugeAdresse(ermittleOrtFuerWache(wache ?? { name: incident.generatedByStationName, coords: incident.coords, details: '' }));
      ergebnis = { ...ergebnis, adresse, address: formatAdresse(adresse) };
    }
    if (!ergebnis.patienten) {
      const patienten = erzeugePatienten(findeEinsatzVorlage(incident.vorlageId)?.patienten, incident.id);
      ergebnis = {
        ...ergebnis,
        patienten: patienten.map((patient) => (incident.status === 'in_bearbeitung' ? { ...patient, status: 'in_behandlung' } : patient)),
      };
    }
    // Laufende Einsätze sollen beim ersten Tick keine verspätete „Erstmeldung“ bekommen
    if (ergebnis.erstesEintreffenAt === undefined && incident.status === 'in_bearbeitung') {
      ergebnis = { ...ergebnis, erstesEintreffenAt: incident.processingStartedAt };
    }
    return ergebnis;
  });
  return {
    ...alt,
    version: SPIELSTAND_VERSION,
    locations,
    incidents,
    krankenhaeuser: ergaenzeKrankenhaeuserFuerWachen(STANDARD_KRANKENHAEUSER, locations),
  };
};

/**
 * Prüft und migriert einen geladenen Spielstand.
 * Liefert null, wenn er unbrauchbar oder von einer unbekannten Version ist.
 */
export function migriereSpielstand(roh: unknown): Spielstand | null {
  if (!roh || typeof roh !== 'object') return null;
  const spielstand = roh as Spielstand;
  if (!Array.isArray(spielstand.locations) || !Array.isArray(spielstand.vehicles) || !Array.isArray(spielstand.incidents)) return null;

  if (spielstand.version === 2) return migriereV2(spielstand);
  if (spielstand.version !== SPIELSTAND_VERSION) return null;
  return {
    ...spielstand,
    krankenhaeuser: Array.isArray(spielstand.krankenhaeuser) ? spielstand.krankenhaeuser : STANDARD_KRANKENHAEUSER,
  };
}
