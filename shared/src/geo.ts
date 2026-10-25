import { GAME_CONFIG } from './konfig.js';
import type { Koordinaten, MapLocation, Vehicle } from './typen.js';
import type { AlarmiertesFahrzeug, SpielEinsatz } from './daten.js';
import { getRoute, punktAufLinie, restLinie } from './routen.js';

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

/**
 * Fahrzeit in Sekunden. Mit Straßenroute: Navi-Zeit, schnellere Fahrzeugtypen kürzer, langsamere länger
 * (gemessen an der Durchschnittsgeschwindigkeit). Ohne Route: Luftlinie mal Umwegfaktor.
 */
export const getFahrzeitSekunden = (from: Koordinaten, to: Koordinaten, geschwindigkeitKmh: number = GAME_CONFIG.averageSpeedKmh) => {
  const route = getRoute(from, to);
  const sekunden = route
    ? route.dauerSekunden * (GAME_CONFIG.averageSpeedKmh / geschwindigkeitKmh)
    : ((haversineKm(from, to) * GAME_CONFIG.strassenUmwegFaktor) / geschwindigkeitKmh) * 3600;
  return Math.max(1, Math.round(sekunden));
};

export const getStationCoords = (stationId: string | undefined, locations: MapLocation[]): Koordinaten | null => {
  if (!stationId) return null;
  const found = locations.find((location) => location.id === stationId && location.type === 'station');
  return found ? found.coords : null;
};

/** Punkt einer Fahrt von `startAt` bis `ankunftAt` zum Zeitpunkt `jetzt` – auf der Straße, wenn die Route bekannt ist. */
export const interpoliereFahrt = (von: Koordinaten, nach: Koordinaten, startAt: number, ankunftAt: number, jetzt: number): Koordinaten =>
  getFahrtVerlauf(von, nach, startAt, ankunftAt, jetzt).position;

/** Position und restliche Strecke (für die Linie auf der Karte) einer Fahrt. */
export const getFahrtVerlauf = (von: Koordinaten, nach: Koordinaten, startAt: number, ankunftAt: number, jetzt: number) => {
  const anteil = clamp((jetzt - startAt) / Math.max(1, ankunftAt - startAt), 0, 1);
  const route = getRoute(von, nach);
  if (route && route.punkte.length >= 2) {
    return { position: punktAufLinie(route.punkte, anteil), linie: restLinie(route.punkte, anteil) };
  }
  const position: Koordinaten = [von[0] + (nach[0] - von[0]) * anteil, von[1] + (nach[1] - von[1]) * anteil];
  return { position, linie: [position, nach] };
};

/** Position eines Fahrzeugs auf der Anfahrt (Wache bzw. Startpunkt → Einsatzort) zu einem Zeitpunkt. */
export const getPositionAufAnfahrt = (
  wache: Koordinaten,
  einsatzort: Koordinaten,
  assignment: Pick<AlarmiertesFahrzeug, 'arrivalAt' | 'etaSeconds' | 'startCoords'>,
  jetzt: number,
): Koordinaten => interpoliereFahrt(assignment.startCoords ?? wache, einsatzort, assignment.arrivalAt - assignment.etaSeconds * 1000, assignment.arrivalAt, jetzt);

export interface FahrzeugFahrt {
  position: Koordinaten;
  /** Restliche Strecke bis zum Ziel (Straßenverlauf oder Luftlinie) */
  linie: Koordinaten[];
  ziel: Koordinaten;
  unterwegs: boolean;
  /** Was das Fahrzeug gerade tut – für Farbe/Linie auf der Karte */
  art: 'anfahrt' | 'einsatzstelle' | 'transport' | 'krankenhaus' | 'rueckfahrt';
}

/** Aktuelle Position eines Fahrzeugs auf der Rückfahrt – oder null, wenn es nicht auf Rückfahrt ist. */
export const getRueckfahrtPosition = (vehicle: Vehicle, locations: MapLocation[], nowMs: number): Koordinaten | null => {
  const wache = getStationCoords(vehicle.stationId, locations);
  if (!vehicle.rueckfahrt || !wache) return null;
  const { von, startAt, ankunftAt } = vehicle.rueckfahrt;
  return interpoliereFahrt(von, wache, startAt, ankunftAt, nowMs);
};

/** Aktuelle Position eines Fahrzeugs unterwegs – oder null, wenn es an der Wache steht. */
export const getFahrzeugPosition = (
  vehicle: Vehicle,
  incidents: SpielEinsatz[],
  locations: MapLocation[],
  nowMs: number,
): FahrzeugFahrt | null => {
  const wache = getStationCoords(vehicle.stationId, locations);
  if (!wache) return null;

  if (vehicle.rueckfahrt) {
    const { von, startAt, ankunftAt } = vehicle.rueckfahrt;
    return { ...getFahrtVerlauf(von, wache, startAt, ankunftAt, nowMs), ziel: wache, unterwegs: nowMs < ankunftAt, art: 'rueckfahrt' };
  }

  for (const incident of incidents) {
    if (incident.status === 'abgeschlossen') continue;
    const assignment = incident.alarmedVehicles.find((entry) => entry.vehicleId === vehicle.id && entry.freigegebenAt === undefined);
    if (!assignment) continue;

    // Patiententransport ins Krankenhaus
    const transport = incident.patienten?.find((patient) => patient.transport?.fahrzeugId === vehicle.id)?.transport;
    if (transport && nowMs >= transport.startAt) {
      return {
        ...getFahrtVerlauf(incident.coords, transport.ziel, transport.startAt, transport.ankunftAt, nowMs),
        ziel: transport.ziel,
        unterwegs: nowMs < transport.ankunftAt,
        art: nowMs < transport.ankunftAt ? 'transport' : 'krankenhaus',
      };
    }

    return {
      ...getFahrtVerlauf(assignment.startCoords ?? wache, incident.coords, assignment.arrivalAt - assignment.etaSeconds * 1000, assignment.arrivalAt, nowMs),
      ziel: incident.coords,
      unterwegs: nowMs < assignment.arrivalAt,
      art: nowMs < assignment.arrivalAt ? 'anfahrt' : 'einsatzstelle',
    };
  }

  return null;
};
