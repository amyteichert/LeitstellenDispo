// Hilfsfunktionen nur für Tests (werden nicht im Spiel verwendet).
import { findeEinsatzVorlage, type SpielEinsatz } from './daten.js';
import { createSpielEinsatz } from './einsatzErzeugung.js';
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

/** Einsatz aus einer Vorlage, ca. 1 km von der Wache entfernt; Eskalationen standardmäßig aus. */
export const einsatz = (vorlageId: string, eskalationBei?: number, eskalationOhneAlarmAt?: number): SpielEinsatz => {
  const vorlage = findeEinsatzVorlage(vorlageId);
  if (!vorlage) throw new Error(`Vorlage ${vorlageId} fehlt`);
  return { ...createSpielEinsatz(vorlage, wache(), [48.784, 9.1771], 'Testadresse', T0), eskalationBei, eskalationOhneAlarmAt };
};
