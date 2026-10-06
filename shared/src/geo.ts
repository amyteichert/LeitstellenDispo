import { GAME_CONFIG } from './konfig.js';
import type { MapLocation, Vehicle } from './typen.js';
import type { SpielEinsatz } from './daten.js';

export type Koordinaten = [number, number];

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Entfernung zweier Punkte in km (Luftlinie). */
export const haversineKm = (from: Koordinaten, to: Koordinaten) => {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRadians(from[0]);
  const lat2 = toRadians(to[0]);
  const dLat = toRadians(to[0] - from[0]);
  const dLng = toRadians(to[1] - from[1]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

/** Fahrzeit in Sekunden auf der Luftlinie (später durch echtes Straßen-Routing ersetzen). */
export const getFahrzeitSekunden = (from: Koordinaten, to: Koordinaten) =>
  Math.max(1, Math.round((haversineKm(from, to) / GAME_CONFIG.averageSpeedKmh) * 3600));

export const getStationCoords = (stationId: string | undefined, locations: MapLocation[]): Koordinaten | null => {
  if (!stationId) return null;
  const found = locations.find((location) => location.id === stationId && location.type === 'station');
  return found ? found.coords : null;
};

export interface FahrzeugFahrt {
  position: Koordinaten;
  ziel: Koordinaten;
  unterwegs: boolean;
}

/** Aktuelle Position eines Fahrzeugs unterwegs – oder null, wenn es an der Wache steht. */
export const getFahrzeugPosition = (
  vehicle: Vehicle,
  incidents: SpielEinsatz[],
  locations: MapLocation[],
  nowMs: number,
): FahrzeugFahrt | null => {
  const wache = getStationCoords(vehicle.stationId, locations);
  if (!wache) return null;

  const interpoliere = (von: Koordinaten, nach: Koordinaten, startAt: number, ankunftAt: number): Koordinaten => {
    const anteil = clamp((nowMs - startAt) / Math.max(1, ankunftAt - startAt), 0, 1);
    return [von[0] + (nach[0] - von[0]) * anteil, von[1] + (nach[1] - von[1]) * anteil];
  };

  if (vehicle.rueckfahrt) {
    const { von, startAt, ankunftAt } = vehicle.rueckfahrt;
    return { position: interpoliere(von, wache, startAt, ankunftAt), ziel: wache, unterwegs: nowMs < ankunftAt };
  }

  for (const incident of incidents) {
    const assignment = incident.alarmedVehicles.find((entry) => entry.vehicleId === vehicle.id);
    if (!assignment || incident.status === 'abgeschlossen') continue;
    const startAt = assignment.arrivalAt - assignment.etaSeconds * 1000;
    return {
      position: interpoliere(wache, incident.coords, startAt, assignment.arrivalAt),
      ziel: incident.coords,
      unterwegs: nowMs < assignment.arrivalAt,
    };
  }

  return null;
};
