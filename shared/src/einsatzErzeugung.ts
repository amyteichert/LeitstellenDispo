import {
  EINSATZ_VORLAGEN,
  getFahrzeugKategorie,
  istVorlageErfuellbar,
  planeEskalation,
  type EinsatzVorlage,
  type SpielEinsatz,
} from './daten.js';
import { INCIDENT_SPAWN_CONFIG } from './konfig.js';
import { clamp, type Koordinaten } from './geo.js';
import type { MapLocation, StationKind, Vehicle } from './typen.js';

/** Nur Vorlagen, die der Spieler mit seinen stationierten Fahrzeugen grundsätzlich schaffen kann. */
export const getAvailableIncidentTemplates = (stationKind: StationKind | undefined, vehicles: Vehicle[]): EinsatzVorlage[] => {
  const fahrzeugTypen = vehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
  const templates = EINSATZ_VORLAGEN[stationKind ?? 'Rettungswache'] ?? EINSATZ_VORLAGEN.Rettungswache;
  return templates.filter((template) => istVorlageErfuellbar(template, fahrzeugTypen));
};

const getIncidentSpawnRadiusKm = (stationCount: number) => {
  if (stationCount <= INCIDENT_SPAWN_CONFIG.earlyPhaseMaxStationCount) {
    return Math.random() * INCIDENT_SPAWN_CONFIG.earlyPhaseMaxRadiusKm;
  }
  if (stationCount <= INCIDENT_SPAWN_CONFIG.midPhaseMaxStationCount) {
    return INCIDENT_SPAWN_CONFIG.earlyPhaseMaxRadiusKm + Math.random() * (INCIDENT_SPAWN_CONFIG.midPhaseMaxRadiusKm - INCIDENT_SPAWN_CONFIG.earlyPhaseMaxRadiusKm);
  }
  return INCIDENT_SPAWN_CONFIG.midPhaseMaxRadiusKm + Math.random() * (INCIDENT_SPAWN_CONFIG.latePhaseMaxRadiusKm - INCIDENT_SPAWN_CONFIG.midPhaseMaxRadiusKm);
};

/** Wache, an der die meisten passenden freien Fahrzeuge stehen (bei Gleichstand zufällig). */
export const getBestIncidentStation = (
  stations: MapLocation[],
  template: EinsatzVorlage,
  vehicles: Vehicle[],
) => {
  const matchingStations = stations
    .map((station) => {
      const matchingVehicles = vehicles.filter(
        (vehicle) =>
          vehicle.stationId === station.id &&
          vehicle.status === 'Einsatzbereit' &&
          getFahrzeugKategorie(vehicle.type) === template.requiredVehicles[0]?.category,
      );
      return { station, matchingVehicles: matchingVehicles.length };
    })
    .filter((entry) => entry.matchingVehicles > 0)
    .sort((a, b) => b.matchingVehicles - a.matchingVehicles);

  if (matchingStations.length > 0) {
    const bestScore = matchingStations[0].matchingVehicles;
    const candidates = matchingStations.filter((entry) => entry.matchingVehicles === bestScore);
    return candidates[Math.floor(Math.random() * candidates.length)].station;
  }

  return stations[Math.floor(Math.random() * stations.length)];
};

export const getRandomCoordsAroundStation = (station: MapLocation, stationCount: number): Koordinaten => {
  const maxRadiusKm = getIncidentSpawnRadiusKm(stationCount);
  const distanceKm = clamp(
    maxRadiusKm * (0.3 + Math.random() * 0.7),
    INCIDENT_SPAWN_CONFIG.preferredVehicleMinRadiusKm,
    maxRadiusKm,
  );

  const angle = Math.random() * Math.PI * 2;
  const latShift = (distanceKm / 111.32) * Math.cos(angle);
  const lngShift = (distanceKm / (111.32 * Math.cos((station.coords[0] * Math.PI) / 180))) * Math.sin(angle);

  return [clamp(station.coords[0] + latShift, 47.5, 55.2), clamp(station.coords[1] + lngShift, 7.5, 14.9)];
};

export const createSpielEinsatz = (
  template: EinsatzVorlage,
  station: MapLocation,
  coords: Koordinaten,
  address: string,
  jetzt: number = Date.now(),
): SpielEinsatz => ({
  id: `incident-${jetzt}-${Math.random().toString(16).slice(2)}`,
  stichwort: template.stichwort,
  meldebild: template.meldebild,
  organization: template.organization,
  status: 'offen',
  coords,
  address,
  generatedByStationId: station.id,
  generatedByStationName: station.name,
  requiredVehicles: template.requiredVehicles,
  alarmedVehicles: [],
  reward: template.reward,
  durationSeconds: template.durationSeconds,
  createdAt: jetzt,
  vorlageId: template.id,
  meldungen: [],
  eskalationBei: planeEskalation(template),
});

export type EinsatzErzeugungErgebnis =
  | { einsatz: SpielEinsatz }
  | { fehler: 'keine-wache' | 'keine-machbare-vorlage' };

/**
 * Erzeugt einen zufälligen, für den Spieler machbaren Einsatz in der Nähe einer seiner Wachen.
 * `adresse` bestimmt den Adresstext (z. B. "Sturz in der Nähe von Rettungswache Zentrum").
 */
export const erzeugeZufallsEinsatz = (
  locations: MapLocation[],
  vehicles: Vehicle[],
  adresse: (vorlage: EinsatzVorlage, station: MapLocation) => string,
  jetzt: number = Date.now(),
): EinsatzErzeugungErgebnis => {
  const stations = locations.filter((location) => location.type === 'station');
  if (stations.length === 0) return { fehler: 'keine-wache' };

  const stationKind = stations[Math.floor(Math.random() * stations.length)].stationKind;
  const templates = getAvailableIncidentTemplates(stationKind, vehicles);
  if (templates.length === 0) return { fehler: 'keine-machbare-vorlage' };

  const template = templates[Math.floor(Math.random() * templates.length)];
  const station = getBestIncidentStation(stations, template, vehicles);
  const coords = getRandomCoordsAroundStation(station, stations.length);
  return { einsatz: createSpielEinsatz(template, station, coords, adresse(template, station), jetzt) };
};
