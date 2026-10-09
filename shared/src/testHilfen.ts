// Hilfsfunktionen nur für Tests (werden nicht im Spiel verwendet).
import { findeEinsatzVorlage, type SpielEinsatz } from './daten.js';
import { createSpielEinsatz } from './einsatzErzeugung.js';
import type { Krankenhaus } from './krankenhaeuser.js';
import type { MapLocation, Vehicle } from './typen.js';

export const T0 = 1_700_000_000_000;

export const wache = (id = 'rw-1', stationKind: MapLocation['stationKind'] = 'Rettungswache'): MapLocation => ({
  id,
  name: `Wache ${id}`,
  type: 'station',
  stationKind,
  coords: [48.775, 9.1771],
  description: stationKind === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
  details: '',
  adresse: { strasse: 'Wachenweg', hausnummer: '1', plz: '70173', ort: 'Stuttgart' },
});

/** Krankenhaus ca. 2 km nördlich der Test-Wache */
export const krankenhaus = (id = 'kh-1', aufnahme = true): Krankenhaus => ({
  id,
  name: `Krankenhaus ${id}`,
  adresse: { strasse: 'Klinikweg', hausnummer: '5', plz: '70174', ort: 'Stuttgart' },
  coords: [48.802, 9.1771],
  aufnahme,
});

/**
 * Eigenes Krankenhaus weit weg (ca. 36 km): schaltet Patiententransporte frei,
 * ist aber nie das nächste Ziel – Tests mit `krankenhaus()` fahren weiter dorthin.
 */
export const eigenesKrankenhausWeitWeg = (): Krankenhaus => ({
  ...krankenhaus('eigen-weit'),
  coords: [49.1, 9.1771],
  eigen: true,
  kapazitaet: 10,
});

/** `stationId: null` = Fahrzeug ohne Wache */
export const fahrzeug = (id: string, type: string, stationId: string | null = 'rw-1'): Vehicle => ({
  id,
  name: type,
  type,
  stationId: stationId ?? undefined,
  price: 0,
  callsign: id,
  status: 'Einsatzbereit',
});

export interface TestEinsatzOptionen {
  /** Müssen die Patienten ins Krankenhaus? (Standard: nein – Einsatz endet nach der Behandlung) */
  transport?: boolean;
  /** Fordert das erste Fahrzeug nach? (Standard: nein) */
  nachforderung?: boolean;
  /** Stellt sich die Lage vor Ort als kleiner heraus? (Standard: nein) */
  entwarnung?: boolean;
}

/** Einsatz aus einer Vorlage, ca. 1 km von der Wache entfernt; Eskalationen und Zufall standardmäßig aus. */
export const einsatz = (
  vorlageId: string,
  eskalationBei?: number,
  eskalationOhneAlarmAt?: number,
  optionen: TestEinsatzOptionen = {},
): SpielEinsatz => {
  const vorlage = findeEinsatzVorlage(vorlageId);
  if (!vorlage) throw new Error(`Vorlage ${vorlageId} fehlt`);
  const e = createSpielEinsatz(
    vorlage,
    wache(),
    { coords: [48.784, 9.1771], adresse: { strasse: 'Teststraße', hausnummer: '1', plz: '70173', ort: 'Stuttgart' } },
    T0,
  );
  return {
    ...e,
    eskalationBei,
    eskalationOhneAlarmAt,
    nachforderungGeplant: optionen.nachforderung ?? false,
    entwarnungGeplant: optionen.entwarnung ?? false,
    patienten: e.patienten?.map((patient) => ({ ...patient, transportErforderlich: optionen.transport ?? false })),
  };
};
