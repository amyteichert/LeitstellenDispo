import { getAktiveZuteilungen, getEinsatzVersorgung, type AlarmiertesFahrzeug, type SpielEinsatz } from './daten.js';
import {
  fahrzeugErfuelltBedarf,
  getFahrzeugGeschwindigkeit,
  getFahrzeugTyp,
  getFehlendenBedarf,
  istAusreichendBesetzt,
  type BedarfsKlasse,
} from './fahrzeuge.js';
import { getFahrzeitSekunden, getPositionAufAnfahrt, getRueckfahrtPosition, getStationCoords, haversineKm } from './geo.js';
import { GAME_CONFIG } from './konfig.js';
import type { MapLocation, Vehicle } from './typen.js';
import { getAusrueckVerzoegerung } from './zufriedenheit.js';

export interface AlarmierungErgebnis {
  incidents: SpielEinsatz[];
  vehicles: Vehicle[];
}

interface AlarmierungsZustand {
  incidents: SpielEinsatz[];
  vehicles: Vehicle[];
  locations: MapLocation[];
}

/**
 * Ist ein Fahrzeug frei für eine neue Alarmierung?
 * Nur einsatzbereite, besetzte Fahrzeuge mit Wache, die keinem laufenden Einsatz zugeteilt sind
 * (also nicht alarmiert, auf Anfahrt, am Einsatzort oder auf Transport).
 * Fahrzeuge auf der Rückfahrt zur Wache dürfen direkt von unterwegs alarmiert werden.
 */
export const istFahrzeugVerfuegbar = (vehicle: Vehicle, incidents: SpielEinsatz[]): boolean =>
  ((vehicle.status ?? 'Einsatzbereit') === 'Einsatzbereit' || Boolean(vehicle.rueckfahrt))
  && Boolean(vehicle.stationId)
  && istAusreichendBesetzt(vehicle)
  && !incidents.some((incident) => incident.status !== 'abgeschlossen'
    && getAktiveZuteilungen(incident).some((assignment) => assignment.vehicleId === vehicle.id));

/**
 * Anfahrtszeit eines Fahrzeugs von seiner Wache zu einem Ort: Ausrückzeit + Fahrzeit (Geschwindigkeit seines Typs)
 * plus Ausrückverzögerung, wenn das Personal der Wache unzufrieden ist.
 * Auf der Rückfahrt fährt es von seiner aktuellen Position los – ohne Ausrückzeit, die Besatzung sitzt ja schon drin.
 */
export const getAnfahrtSekunden = (
  vehicle: Vehicle,
  ziel: [number, number],
  locations: MapLocation[],
  jetzt: number = Date.now(),
): number | null => {
  const wache = locations.find((location) => location.id === vehicle.stationId && location.type === 'station');
  if (!wache) return null;
  const unterwegs = getRueckfahrtPosition(vehicle, locations, jetzt);
  if (unterwegs) return getFahrzeitSekunden(unterwegs, ziel, getFahrzeugGeschwindigkeit(vehicle.type));
  const ausrueckzeit = GAME_CONFIG.ausrueckzeitSekunden[getFahrzeugTyp(vehicle.type)?.organisation ?? 'Rettungsdienst'];
  return ausrueckzeit + getFahrzeitSekunden(wache.coords, ziel, getFahrzeugGeschwindigkeit(vehicle.type)) + getAusrueckVerzoegerung(wache, jetzt);
};

/**
 * Alarmiert (bzw. alarmiert nach) Fahrzeuge zu einem Einsatz.
 * Nur möglich, solange der Einsatz offen oder alarmiert ist; nicht verfügbare Fahrzeuge werden ignoriert.
 */
export const alarmiereFahrzeuge = (
  zustand: AlarmierungsZustand,
  incidentId: string,
  vehicleIds: string[],
  jetzt: number = Date.now(),
): AlarmierungErgebnis => {
  const { incidents, vehicles, locations } = zustand;
  const incident = incidents.find((entry) => entry.id === incidentId);
  if (!incident || vehicleIds.length === 0) return { incidents, vehicles };
  if (incident.status !== 'offen' && incident.status !== 'alarmiert') return { incidents, vehicles };

  const neueZuteilungen = [...new Set(vehicleIds)]
    .filter((vehicleId) => !getAktiveZuteilungen(incident).some((existing) => existing.vehicleId === vehicleId))
    .map((vehicleId): AlarmiertesFahrzeug | null => {
      const vehicle = vehicles.find((item) => item.id === vehicleId);
      const wache = getStationCoords(vehicle?.stationId, locations);
      if (!vehicle || !wache || !istFahrzeugVerfuegbar(vehicle, incidents)) return null;
      const unterwegs = getRueckfahrtPosition(vehicle, locations, jetzt);
      const start = unterwegs ?? wache;
      const etaSeconds = getAnfahrtSekunden(vehicle, incident.coords, locations, jetzt) ?? 0;
      return {
        vehicleId,
        distanceKm: Number(haversineKm(start, incident.coords).toFixed(1)),
        etaSeconds,
        arrivalAt: jetzt + etaSeconds * 1000,
        ...(unterwegs ? { startCoords: unterwegs } : {}),
      };
    })
    .filter((entry): entry is AlarmiertesFahrzeug => Boolean(entry));

  if (neueZuteilungen.length === 0) return { incidents, vehicles };

  // Bei der Erstalarmierung merken, wie schnell das beste freie Fahrzeug gewesen wäre (Grundlage der Bewertung)
  const besteAnfahrtSekunden = incident.alarmedVehicles.length === 0
    ? getPassendeVerfuegbareFahrzeuge(incident, zustand)[0]?.anfahrtSekunden
    : incident.besteAnfahrtSekunden;

  const alarmierteIds = neueZuteilungen.map((entry) => entry.vehicleId);
  return {
    incidents: incidents.map((entry) => (
      entry.id === incidentId
        ? { ...entry, alarmedVehicles: [...entry.alarmedVehicles, ...neueZuteilungen], status: 'alarmiert', besteAnfahrtSekunden }
        : entry
    )),
    vehicles: vehicles.map((vehicle) => (
      alarmierteIds.includes(vehicle.id) ? { ...vehicle, status: 'Alarmiert / auf Anfahrt', rueckfahrt: undefined } : vehicle
    )),
  };
};

/** Darf ein zugeteiltes Fahrzeug gerade zurückalarmiert werden? Nur solange der Einsatz noch nicht bearbeitet wird. */
export const kannRueckalarmieren = (einsatz: SpielEinsatz, vehicleId: string): boolean =>
  (einsatz.status === 'offen' || einsatz.status === 'alarmiert')
  && getAktiveZuteilungen(einsatz).some((assignment) => assignment.vehicleId === vehicleId);

/**
 * Holt ein Fahrzeug vom Einsatz zurück (Rückalarmierung): Es fährt von seiner aktuellen Position zur Wache
 * und kann unterwegs sofort neu alarmiert werden. Bleibt kein Fahrzeug übrig, ist der Einsatz wieder offen.
 */
export const rueckalarmiereFahrzeug = (
  zustand: AlarmierungsZustand,
  incidentId: string,
  vehicleId: string,
  jetzt: number = Date.now(),
): AlarmierungErgebnis => {
  const { incidents, vehicles, locations } = zustand;
  const einsatz = incidents.find((entry) => entry.id === incidentId);
  const vehicle = vehicles.find((entry) => entry.id === vehicleId);
  const wache = getStationCoords(vehicle?.stationId, locations);
  if (!einsatz || !vehicle || !wache || !kannRueckalarmieren(einsatz, vehicleId)) return { incidents, vehicles };
  const assignment = getAktiveZuteilungen(einsatz).find((entry) => entry.vehicleId === vehicleId)!;

  const von = assignment.arrivalAt <= jetzt ? einsatz.coords : getPositionAufAnfahrt(wache, einsatz.coords, assignment, jetzt);
  const fahrzeit = getFahrzeitSekunden(von, wache, getFahrzeugGeschwindigkeit(vehicle.type));
  const alarmedVehicles = einsatz.alarmedVehicles.map((entry) => (entry === assignment ? { ...entry, freigegebenAt: jetzt } : entry));
  const nochZugeteilt = alarmedVehicles.some((entry) => entry.freigegebenAt === undefined);

  return {
    incidents: incidents.map((entry) => (
      entry.id === incidentId ? { ...entry, alarmedVehicles, status: nochZugeteilt ? entry.status : 'offen' } : entry
    )),
    vehicles: vehicles.map((entry) => (
      entry.id === vehicleId
        ? { ...entry, status: 'Rückfahrt', rueckfahrt: { von, startAt: jetzt, ankunftAt: jetzt + fahrzeit * 1000 } }
        : entry
    )),
  };
};

export interface WartendesFahrzeug {
  vehicleId: string;
  /** Seit wann es vor Ort steht, ohne dass die Bearbeitung beginnen kann */
  wartetSeit: number;
}

export interface WarteLage {
  wartende: WartendesFahrzeug[];
  /** Bedarf, für den noch gar nichts alarmiert ist */
  fehlt: Array<{ category: BedarfsKlasse; anzahl: number }>;
  /** Gibt es für den fehlenden Bedarf gerade ein freies Fahrzeug? */
  freiesFahrzeugFuerFehlendes: boolean;
  /** Ankunft des letzten noch fehlenden Fahrzeugs auf Anfahrt (wenn nichts mehr fehlt) */
  letzteAnkunftAt?: number;
}

/**
 * Warten Fahrzeuge an der Einsatzstelle, weil der Bedarf noch nicht vor Ort ist?
 * Grundlage für den Hinweis zur Rückalarmierung (z. B. RTW wartet auf ein NEF, das nicht frei ist).
 */
export function getWarteLage(einsatz: SpielEinsatz, zustand: AlarmierungsZustand, jetzt: number = Date.now()): WarteLage | null {
  if (einsatz.status !== 'alarmiert') return null;
  const aktiv = getAktiveZuteilungen(einsatz);
  const vorOrt = aktiv.filter((assignment) => assignment.arrivalAt <= jetzt);
  if (vorOrt.length === 0) return null;
  const { fehlendAlarmiert } = getEinsatzVersorgung(einsatz, zustand.vehicles, jetzt);
  const freiesFahrzeugFuerFehlendes = fehlendAlarmiert.length > 0 && getPassendeVerfuegbareFahrzeuge(einsatz, zustand)
    .some(({ vehicle }) => fehlendAlarmiert.some((bedarf) => fahrzeugErfuelltBedarf(vehicle.type, bedarf.category)));
  const unterwegs = aktiv.filter((assignment) => assignment.arrivalAt > jetzt);
  return {
    wartende: vorOrt.map((assignment) => ({ vehicleId: assignment.vehicleId, wartetSeit: assignment.arrivalAt })),
    fehlt: fehlendAlarmiert,
    freiesFahrzeugFuerFehlendes,
    letzteAnkunftAt: fehlendAlarmiert.length === 0 && unterwegs.length > 0 ? Math.max(...unterwegs.map((a) => a.arrivalAt)) : undefined,
  };
}

export interface PassendesFahrzeug {
  vehicle: Vehicle;
  station?: MapLocation;
  distanzKm: number;
  anfahrtSekunden: number;
}

/** Verfügbare Fahrzeuge, die irgendeinen Bedarf des Einsatzes erfüllen können – nach Anfahrtszeit sortiert. */
export function getPassendeVerfuegbareFahrzeuge(einsatz: SpielEinsatz, zustand: AlarmierungsZustand): PassendesFahrzeug[] {
  const { incidents, vehicles, locations } = zustand;
  return vehicles
    .filter((vehicle) => istFahrzeugVerfuegbar(vehicle, incidents))
    .filter((vehicle) => einsatz.requiredVehicles.some((bedarf) => fahrzeugErfuelltBedarf(vehicle.type, bedarf.category)))
    .map((vehicle) => {
      const station = locations.find((location) => location.id === vehicle.stationId && location.type === 'station');
      return {
        vehicle,
        station,
        distanzKm: station ? haversineKm(getRueckfahrtPosition(vehicle, locations, Date.now()) ?? station.coords, einsatz.coords) : Infinity,
        anfahrtSekunden: getAnfahrtSekunden(vehicle, einsatz.coords, locations) ?? Infinity,
      };
    })
    .sort((a, b) => a.anfahrtSekunden - b.anfahrtSekunden);
}

export interface VerfuegbaresFahrzeug extends PassendesFahrzeug {
  /** Deckt das Fahrzeug einen Bedarf des Einsatzes? (Andere dürfen trotzdem alarmiert werden.) */
  passend: boolean;
}

/** Alle freien Fahrzeuge für die Alarmierung: passende zuerst, danach alle anderen – jeweils nach Anfahrtszeit. */
export function getVerfuegbareFahrzeugeFuerEinsatz(einsatz: SpielEinsatz, zustand: AlarmierungsZustand): VerfuegbaresFahrzeug[] {
  const { incidents, vehicles, locations } = zustand;
  return vehicles
    .filter((vehicle) => istFahrzeugVerfuegbar(vehicle, incidents))
    .map((vehicle) => {
      const station = locations.find((location) => location.id === vehicle.stationId && location.type === 'station');
      return {
        vehicle,
        station,
        distanzKm: station ? haversineKm(getRueckfahrtPosition(vehicle, locations, Date.now()) ?? station.coords, einsatz.coords) : Infinity,
        anfahrtSekunden: getAnfahrtSekunden(vehicle, einsatz.coords, locations) ?? Infinity,
        passend: einsatz.requiredVehicles.some((bedarf) => fahrzeugErfuelltBedarf(vehicle.type, bedarf.category)),
      };
    })
    .sort((a, b) => Number(b.passend) - Number(a.passend) || a.anfahrtSekunden - b.anfahrtSekunden);
}

export interface AlarmVorschlag {
  /** Vorgeschlagene Fahrzeuge (schnellste zuerst) */
  fahrzeugIds: string[];
  /** Bedarf, der aktuell mit keinem freien Fahrzeug gedeckt werden kann */
  nichtVerfuegbar: Array<{ category: BedarfsKlasse; anzahl: number }>;
}

/**
 * Alarmierungsvorschlag: deckt den noch fehlenden Bedarf mit den schnellsten freien Fahrzeugen.
 * Bereits alarmierte Fahrzeuge werden berücksichtigt; knappe Klassen (wenige Kandidaten) werden zuerst besetzt,
 * damit z. B. ein LF nicht als Löschfahrzeug „verbraucht“ wird, wenn es für die Technische Hilfe gebraucht wird.
 */
export function erstelleAlarmVorschlag(einsatz: SpielEinsatz, zustand: AlarmierungsZustand): AlarmVorschlag {
  if (einsatz.status !== 'offen' && einsatz.status !== 'alarmiert') return { fahrzeugIds: [], nichtVerfuegbar: [] };

  const zugeteilt = getAktiveZuteilungen(einsatz).map((assignment) => ({
    id: assignment.vehicleId,
    type: zustand.vehicles.find((vehicle) => vehicle.id === assignment.vehicleId)?.type,
  }));
  const fehlend = getFehlendenBedarf(einsatz.requiredVehicles, zugeteilt);
  const kandidaten = getPassendeVerfuegbareFahrzeuge(einsatz, zustand);

  const plaetze = fehlend
    .flatMap((eintrag) => Array.from({ length: eintrag.anzahl }, () => eintrag.category))
    .map((klasse) => ({ klasse, anzahlKandidaten: kandidaten.filter((k) => fahrzeugErfuelltBedarf(k.vehicle.type, klasse)).length }))
    .sort((a, b) => a.anzahlKandidaten - b.anzahlKandidaten);

  const gewaehlt: string[] = [];
  for (const platz of plaetze) {
    const treffer = kandidaten.find((k) => !gewaehlt.includes(k.vehicle.id) && fahrzeugErfuelltBedarf(k.vehicle.type, platz.klasse));
    if (treffer) gewaehlt.push(treffer.vehicle.id);
  }

  const nachVorschlag = [
    ...zugeteilt,
    ...gewaehlt.map((id) => ({ id, type: zustand.vehicles.find((vehicle) => vehicle.id === id)?.type })),
  ];
  return {
    fahrzeugIds: kandidaten.map((k) => k.vehicle.id).filter((id) => gewaehlt.includes(id)),
    nichtVerfuegbar: getFehlendenBedarf(einsatz.requiredVehicles, nachVorschlag),
  };
}
