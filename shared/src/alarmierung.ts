import type { AlarmiertesFahrzeug, SpielEinsatz } from './daten.js';
import { getFahrzeitSekunden, getStationCoords, haversineKm } from './geo.js';
import type { MapLocation, Vehicle } from './typen.js';

export interface AlarmierungErgebnis {
  incidents: SpielEinsatz[];
  vehicles: Vehicle[];
}

/**
 * Alarmiert (bzw. alarmiert nach) Fahrzeuge zu einem Einsatz.
 * Nur möglich, solange der Einsatz offen oder alarmiert ist; Fahrzeuge ohne Wache werden ignoriert.
 */
export const alarmiereFahrzeuge = (
  zustand: { incidents: SpielEinsatz[]; vehicles: Vehicle[]; locations: MapLocation[] },
  incidentId: string,
  vehicleIds: string[],
  jetzt: number = Date.now(),
): AlarmierungErgebnis => {
  const { incidents, vehicles, locations } = zustand;
  const incident = incidents.find((entry) => entry.id === incidentId);
  if (!incident || vehicleIds.length === 0) return { incidents, vehicles };
  if (incident.status !== 'offen' && incident.status !== 'alarmiert') return { incidents, vehicles };

  const neueZuteilungen = vehicleIds
    .filter((vehicleId) => !incident.alarmedVehicles.some((existing) => existing.vehicleId === vehicleId))
    .map((vehicleId): AlarmiertesFahrzeug | null => {
      const vehicle = vehicles.find((item) => item.id === vehicleId);
      const coords = getStationCoords(vehicle?.stationId, locations);
      if (!vehicle || !coords) return null;
      const etaSeconds = getFahrzeitSekunden(coords, incident.coords);
      return {
        vehicleId,
        distanceKm: Number(haversineKm(coords, incident.coords).toFixed(1)),
        etaSeconds,
        arrivalAt: jetzt + etaSeconds * 1000,
      };
    })
    .filter((entry): entry is AlarmiertesFahrzeug => Boolean(entry));

  if (neueZuteilungen.length === 0) return { incidents, vehicles };

  const alarmierteIds = neueZuteilungen.map((entry) => entry.vehicleId);
  return {
    incidents: incidents.map((entry) => (
      entry.id === incidentId
        ? { ...entry, alarmedVehicles: [...entry.alarmedVehicles, ...neueZuteilungen], status: 'alarmiert' }
        : entry
    )),
    vehicles: vehicles.map((vehicle) => (
      alarmierteIds.includes(vehicle.id) ? { ...vehicle, status: 'Alarmiert / auf Anfahrt' } : vehicle
    )),
  };
};
