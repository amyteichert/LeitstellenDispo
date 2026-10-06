import {
  eskaliereEinsatz,
  findeEinsatzVorlage,
  getFahrzeugKategorie,
  istVorlageErfuellbar,
  type AbgeschlossenerSpielEinsatz,
  type SpielEinsatz,
} from './daten.js';
import { getFahrzeitSekunden, getStationCoords } from './geo.js';
import { GAME_CONFIG } from './konfig.js';
import type { MapLocation, Vehicle } from './typen.js';

export interface SpielTickZustand {
  vehicles: Vehicle[];
  incidents: SpielEinsatz[];
  locations: MapLocation[];
}

export interface SpielTickErgebnis {
  vehicles: Vehicle[];
  /** Laufende Einsätze (abgeschlossene sind bereits entfernt) */
  incidents: SpielEinsatz[];
  /** In diesem Schritt abgeschlossene Einsätze – für Belohnung und Verlauf */
  abgeschlossen: AbgeschlossenerSpielEinsatz[];
  /** Einsätze, die nie alarmiert wurden und nach langer Zeit verschwunden sind */
  verfallen: SpielEinsatz[];
  geaendert: boolean;
}

/**
 * Ein Schritt der Spielzeit: Fahrzeugstatus, Ankunft, Bearbeitung, Eskalation, Abschluss und Rückfahrt.
 * Alle Zeitpunkte werden aus echten Zeitstempeln berechnet – dadurch läuft das Spiel auch weiter,
 * während es geschlossen ist (ein Aufruf mit späterem `jetzt` holt alles nach).
 */
export const berechneSpielTick = ({ vehicles, incidents, locations }: SpielTickZustand, jetzt: number): SpielTickErgebnis => {
  let geaendert = false;

  let nextVehicles: Vehicle[] = vehicles.map((vehicle): Vehicle => {
    const activeIncident = incidents.find(
      (incident) => incident.status !== 'abgeschlossen' && incident.alarmedVehicles.some((entry) => entry.vehicleId === vehicle.id),
    );

    if (!activeIncident) {
      // Rückfahrt zur Wache: erst bei Ankunft wieder einsatzbereit
      if (vehicle.rueckfahrt) {
        if (jetzt >= vehicle.rueckfahrt.ankunftAt) {
          geaendert = true;
          return { ...vehicle, status: 'Einsatzbereit', rueckfahrt: undefined };
        }
        if (vehicle.status !== 'Rückfahrt') {
          geaendert = true;
          return { ...vehicle, status: 'Rückfahrt' };
        }
        return vehicle;
      }
      if (vehicle.status !== 'Einsatzbereit') {
        geaendert = true;
        return { ...vehicle, status: 'Einsatzbereit' };
      }
      return vehicle;
    }

    const assignment = activeIncident.alarmedVehicles.find((entry) => entry.vehicleId === vehicle.id);
    if (!assignment) return vehicle;
    if (jetzt >= assignment.arrivalAt && vehicle.status !== 'Im Einsatz') {
      geaendert = true;
      return { ...vehicle, status: 'Im Einsatz' };
    }
    if (jetzt < assignment.arrivalAt && vehicle.status !== 'Alarmiert / auf Anfahrt') {
      geaendert = true;
      return { ...vehicle, status: 'Alarmiert / auf Anfahrt' };
    }
    return vehicle;
  });

  const completed: SpielEinsatz[] = [];
  const verfallen: SpielEinsatz[] = [];
  const nextIncidents: SpielEinsatz[] = incidents.map((incident): SpielEinsatz => {
    if (incident.status === 'abgeschlossen') return incident;

    // Einsätze, um die sich niemand kümmert
    if (incident.status === 'offen' && incident.alarmedVehicles.length === 0) {
      if (jetzt - incident.createdAt >= GAME_CONFIG.einsatzVerfallNachMs) {
        verfallen.push(incident);
        geaendert = true;
        return incident;
      }
      if (incident.eskalationOhneAlarmAt !== undefined && jetzt >= incident.eskalationOhneAlarmAt) {
        const eskalation = findeEinsatzVorlage(incident.vorlageId)?.eskalation;
        const ziel = eskalation ? findeEinsatzVorlage(eskalation.zielVorlageId) : undefined;
        const fahrzeugTypen = nextVehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
        geaendert = true;
        // Lage verschärft sich – nur in Einsätze, die der Spieler überhaupt schaffen kann
        if (eskalation && ziel && istVorlageErfuellbar(ziel, fahrzeugTypen)) {
          return eskaliereEinsatz(incident, ziel, eskalation.meldung, incident.eskalationOhneAlarmAt);
        }
        return { ...incident, eskalationOhneAlarmAt: undefined };
      }
      return incident;
    }

    const activeVehicles = incident.alarmedVehicles
      .map((assignment) => nextVehicles.find((vehicle) => vehicle.id === assignment.vehicleId))
      .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));

    const requirementSatisfied = incident.requiredVehicles.every((requirement) => {
      const matches = activeVehicles.filter((vehicle) => getFahrzeugKategorie(vehicle.type) === requirement.category).length;
      return matches >= requirement.amount;
    });

    const allArrived = incident.alarmedVehicles.every((assignment) => jetzt >= assignment.arrivalAt);
    const updated = { ...incident };

    if (incident.alarmedVehicles.length > 0 && incident.status === 'offen') {
      updated.status = 'alarmiert';
      geaendert = true;
    }

    if (updated.status === 'alarmiert' && requirementSatisfied && allArrived && !updated.processingStartedAt) {
      // Echte Startzeit: Ankunft des letzten Fahrzeugs (frühestens ab der letzten Lagemeldung).
      // So läuft die Bearbeitung auch korrekt weiter, während das Spiel geschlossen war.
      const letzteAnkunft = Math.max(...updated.alarmedVehicles.map((assignment) => assignment.arrivalAt));
      const letzteMeldung = updated.meldungen[updated.meldungen.length - 1]?.zeit ?? 0;
      const startZeit = Math.min(jetzt, Math.max(letzteAnkunft, letzteMeldung));
      updated.status = 'in_bearbeitung';
      updated.processingStartedAt = startZeit;
      updated.processingEndsAt = startZeit + updated.durationSeconds * 1000;
      geaendert = true;
    }

    if (updated.status === 'in_bearbeitung') {
      if (!updated.processingEndsAt) {
        updated.processingEndsAt = jetzt + updated.durationSeconds * 1000;
      }

      // Eskalation: Lagemeldung von der Einsatzstelle während der Bearbeitung
      const eskalationsZeitpunkt = updated.eskalationBei !== undefined && updated.processingStartedAt
        ? updated.processingStartedAt + updated.eskalationBei * updated.durationSeconds * 1000
        : undefined;
      if (eskalationsZeitpunkt !== undefined && jetzt >= eskalationsZeitpunkt) {
        const eskalation = findeEinsatzVorlage(updated.vorlageId)?.eskalation;
        const ziel = eskalation ? findeEinsatzVorlage(eskalation.zielVorlageId) : undefined;
        const fahrzeugTypen = nextVehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
        geaendert = true;
        // Nur eskalieren, wenn der Spieler den größeren Einsatz überhaupt schaffen kann
        if (eskalation && ziel && istVorlageErfuellbar(ziel, fahrzeugTypen)) {
          return eskaliereEinsatz(updated, ziel, eskalation.meldung, eskalationsZeitpunkt);
        }
        updated.eskalationBei = undefined;
      }

      if (jetzt >= updated.processingEndsAt) {
        updated.status = 'abgeschlossen';
        completed.push(updated);
        geaendert = true;
      }
    }

    return updated;
  });

  const abgeschlossen: AbgeschlossenerSpielEinsatz[] = completed.map((incident) => ({
    ...incident,
    completedAt: incident.processingEndsAt ?? jetzt,
    totalDurationSeconds: Math.max(
      1,
      Math.round(((incident.processingEndsAt ?? jetzt) - (incident.processingStartedAt ?? incident.createdAt)) / 1000),
    ),
  }));

  if (completed.length > 0) {
    // Fahrzeuge der abgeschlossenen Einsätze fahren (Luftlinie) zurück zur Wache – ab dem echten Einsatzende
    nextVehicles = nextVehicles.map((vehicle): Vehicle => {
      const einsatz = completed.find((incident) =>
        incident.alarmedVehicles.some((assignment) => assignment.vehicleId === vehicle.id),
      );
      if (!einsatz) return vehicle;
      const wache = getStationCoords(vehicle.stationId, locations);
      if (!wache) return { ...vehicle, status: 'Einsatzbereit' };
      const startAt = einsatz.processingEndsAt ?? jetzt;
      return {
        ...vehicle,
        status: 'Rückfahrt',
        rueckfahrt: { von: einsatz.coords, startAt, ankunftAt: startAt + getFahrzeitSekunden(einsatz.coords, wache) * 1000 },
      };
    });
  }

  if (!geaendert) {
    return { vehicles, incidents, abgeschlossen: [], verfallen: [], geaendert: false };
  }

  return {
    vehicles: nextVehicles,
    incidents: nextIncidents.filter((incident) => incident.status !== 'abgeschlossen' && !verfallen.includes(incident)),
    abgeschlossen,
    verfallen,
    geaendert: true,
  };
};
