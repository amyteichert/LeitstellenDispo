import { erzeugeAdresse, ermittleOrtFuerWache, formatAdresse, type Ort } from './adressen.js';
import {
  EINSATZ_VORLAGEN,
  istVorlageErfuellbar,
  planeEskalation,
  istMeldungUnklar,
  planeEskalationOhneAlarm,
  planeLageBeimEintreffen,
  type EinsatzVorlage,
  type SpielEinsatz,
} from './daten.js';
import { FAHRZEUG_TYPEN, fahrzeugErfuelltBedarf, istAusreichendBesetzt } from './fahrzeuge.js';
import { EINSATZDRUCK_CONFIG, INCIDENT_SPAWN_CONFIG, UNBESETZT_HAEUFIGKEIT } from './konfig.js';
import { waehleGewichtet, type AufkommenKontext } from './aufkommen.js';
import { clamp, haversineKm } from './geo.js';
import { FACHRICHTUNGEN, findeVerlegungen, hatEigenesKrankenhaus, type Krankenhaus } from './krankenhaeuser.js';
import { erzeugePatienten } from './patienten.js';
import type { Koordinaten, MapLocation, StationKind, Vehicle } from './typen.js';

/**
 * Nur Vorlagen, die der Spieler mit seinen stationierten Fahrzeugen grundsätzlich schaffen kann.
 * Krankentransporte erst mit eigenem Krankenhaus, Verlegungen nur, wenn zwei eigene Häuser sich ergänzen.
 */
export const getAvailableIncidentTemplates = (
  stationKind: StationKind | undefined,
  vehicles: Vehicle[],
  krankenhaeuser: Krankenhaus[] = [],
  jetzt: number = Date.now(),
): EinsatzVorlage[] => {
  const eigenesKrankenhaus = hatEigenesKrankenhaus(krankenhaeuser);
  const verlegungMoeglich = findeVerlegungen(krankenhaeuser, jetzt).length > 0;
  const fahrzeugTypen = vehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
  const templates = EINSATZ_VORLAGEN[stationKind ?? 'Rettungswache'] ?? EINSATZ_VORLAGEN.Rettungswache;
  return templates.filter((template) => istVorlageErfuellbar(template, fahrzeugTypen)
    && (eigenesKrankenhaus || !template.brauchtEigenesKrankenhaus)
    && (verlegungMoeglich || !template.verlegung));
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

/** Ließe sich der Bedarf mit Fahrzeugen decken, die an diesen Wachenarten gekauft werden können? */
export const istVorlageKaufbar = (template: Pick<EinsatzVorlage, 'requiredVehicles'>, wachenArten: StationKind[]) =>
  template.requiredVehicles.every((bedarf) => FAHRZEUG_TYPEN.some((typ) =>
    wachenArten.includes(typ.wachenArt) && fahrzeugErfuelltBedarf(typ.typ, bedarf.category)));

/**
 * Einsatzdruck: Vorlagen dieser Wachenart, die der Spieler mit seinen Fahrzeugen noch NICHT schafft,
 * für die er aber an seinen Wachen passende Fahrzeuge kaufen könnte.
 */
export const getDruckVorlagen = (
  stationKind: StationKind,
  vehicles: Vehicle[],
  wachenArten: StationKind[],
  krankenhaeuser: Krankenhaus[] = [],
  jetzt: number = Date.now(),
): EinsatzVorlage[] => {
  const machbar = new Set(getAvailableIncidentTemplates(stationKind, vehicles, krankenhaeuser, jetzt).map((v) => v.id));
  const eigenesKrankenhaus = hatEigenesKrankenhaus(krankenhaeuser);
  return (EINSATZ_VORLAGEN[stationKind] ?? []).filter((template) => !machbar.has(template.id)
    && !template.verlegung
    && (eigenesKrankenhaus || !template.brauchtEigenesKrankenhaus)
    && istVorlageKaufbar(template, wachenArten));
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
          fahrzeugErfuelltBedarf(vehicle.type, template.requiredVehicles[0]?.category),
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

/** Einsatzort rund um eine Wache: Koordinaten und eine dazu passende Adresse im Ort der Wache. */
export const erzeugeEinsatzort = (
  station: MapLocation,
  stationCount: number,
  template: Pick<EinsatzVorlage, 'ortsArt'>,
  zufall: () => number = Math.random,
): Ort => ({
  coords: getRandomCoordsAroundStation(station, stationCount),
  adresse: erzeugeAdresse(ermittleOrtFuerWache(station), template.ortsArt, zufall),
});

export const createSpielEinsatz = (
  template: EinsatzVorlage,
  station: MapLocation,
  ort: Ort,
  jetzt: number = Date.now(),
): SpielEinsatz => {
  const id = `incident-${jetzt}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    stichwort: template.stichwort,
    meldebild: template.meldebild,
    organization: template.organization,
    status: 'offen',
    coords: ort.coords,
    adresse: ort.adresse,
    address: formatAdresse(ort.adresse),
    generatedByStationId: station.id,
    generatedByStationName: station.name,
    requiredVehicles: template.requiredVehicles,
    alarmedVehicles: [],
    reward: template.reward,
    durationSeconds: template.durationSeconds,
    createdAt: jetzt,
    vorlageId: template.id,
    meldungen: [],
    patienten: erzeugePatienten(template.patienten, id),
    ...planeLageBeimEintreffen(template),
    empfehlung: template.requiredVehicles,
    meldungUnklar: istMeldungUnklar(template),
    eskalationBei: planeEskalation(template),
    eskalationOhneAlarmAt: planeEskalationOhneAlarm(template, jetzt),
  };
};

/**
 * Krankenhausverlegung: Einsatzort ist das abgebende Haus, Ziel das Haus mit der fehlenden Abteilung.
 * Zuständig ist die nächste Rettungswache.
 */
export const erzeugeVerlegung = (
  template: EinsatzVorlage,
  stations: MapLocation[],
  krankenhaeuser: Krankenhaus[],
  jetzt: number = Date.now(),
  zufall: () => number = Math.random,
): SpielEinsatz | null => {
  const moeglichkeiten = findeVerlegungen(krankenhaeuser, jetzt);
  const rettungswachen = stations.filter((station) => (station.stationKind ?? 'Rettungswache') === 'Rettungswache');
  if (moeglichkeiten.length === 0 || rettungswachen.length === 0) return null;
  const { von, nach, fachrichtung } = moeglichkeiten[Math.floor(zufall() * moeglichkeiten.length)];
  const station = rettungswachen.reduce((naechste, wache) =>
    (haversineKm(wache.coords, von.coords) < haversineKm(naechste.coords, von.coords) ? wache : naechste));
  const einsatz = createSpielEinsatz(template, station, { coords: von.coords, adresse: von.adresse }, jetzt);
  return {
    ...einsatz,
    meldebild: `Verlegung → ${nach.name} (${FACHRICHTUNGEN[fachrichtung].kurz})`,
    address: `${von.name}, ${einsatz.address}`,
    patienten: einsatz.patienten?.map((patient) => ({ ...patient, fachrichtung })),
    verlegung: { vonKrankenhausId: von.id, nachKrankenhausId: nach.id, nachKrankenhausName: nach.name, fachrichtung },
  };
};

/** Einsatz, für den dem Spieler noch Fahrzeuge fehlen – verfällt schneller und lässt sich abgeben. */
export const erzeugeDruckEinsatz = (
  stations: MapLocation[],
  vehicles: Vehicle[],
  jetzt: number = Date.now(),
  kontext?: AufkommenKontext,
  krankenhaeuser: Krankenhaus[] = [],
): SpielEinsatz | null => {
  const wachenArten = [...new Set(stations.map((station) => station.stationKind ?? 'Rettungswache'))];
  const arten = wachenArten
    .map((art) => getDruckVorlagen(art, vehicles, wachenArten, krankenhaeuser, jetzt))
    .filter((vorlagen) => vorlagen.length > 0);
  if (arten.length === 0) return null;
  const vorlagen = arten[Math.floor(Math.random() * arten.length)];
  const template = kontext ? waehleGewichtet(vorlagen, kontext) : vorlagen[Math.floor(Math.random() * vorlagen.length)];
  const station = getBestIncidentStation(stations, template, vehicles);
  const einsatz = createSpielEinsatz(template, station, erzeugeEinsatzort(station, stations.length, template), jetzt);
  return { ...einsatz, fehlendeKraefte: true, verfallAt: jetzt + EINSATZDRUCK_CONFIG.verfallNachMs };
};

export type EinsatzErzeugungErgebnis =
  | { einsatz: SpielEinsatz }
  | { fehler: 'keine-wache' | 'keine-machbare-vorlage' };

/** Erzeugt einen zufälligen, für den Spieler machbaren Einsatz mit Adresse in der Nähe einer seiner Wachen. */
export const erzeugeZufallsEinsatz = (
  locations: MapLocation[],
  vehicles: Vehicle[],
  jetzt: number = Date.now(),
  /** Uhrzeit, Wochentag, Wetter: bestimmen, welche Einsätze häufiger sind */
  kontext?: AufkommenKontext,
  /** Bestimmt Krankentransporte und Verlegungen (erst mit eigenem Krankenhaus) */
  krankenhaeuser: Krankenhaus[] = [],
): EinsatzErzeugungErgebnis => {
  const stations = locations.filter((location) => location.type === 'station');
  if (stations.length === 0) return { fehler: 'keine-wache' };

  // Jede vorhandene Wachenart kommt gleich oft dran – unabhängig davon, wie viele Wachen es je Art gibt.
  // Arten ohne machbaren Einsatz (z. B. Feuerwache ohne passendes Fahrzeug) werden übersprungen.
  const arten = [...new Set(stations.map((station) => station.stationKind ?? 'Rettungswache'))]
    .map((art) => ({ art, vorlagen: getAvailableIncidentTemplates(art, vehicles, krankenhaeuser, jetzt) }))
    .filter((eintrag) => eintrag.vorlagen.length > 0);
  if (arten.length === 0) return { fehler: 'keine-machbare-vorlage' };
  const templates = arten[Math.floor(Math.random() * arten.length)].vorlagen;

  // Ab einer gewissen Größe: manchmal ein Einsatz, für den noch Fahrzeuge fehlen
  if (stations.length >= EINSATZDRUCK_CONFIG.abWachen && Math.random() < EINSATZDRUCK_CONFIG.anteil) {
    const druck = erzeugeDruckEinsatz(stations, vehicles, jetzt, kontext, krankenhaeuser);
    if (druck) return { einsatz: druck };
  }

  // Nur mit unbesetzten Fahrzeugen machbar? Dann seltener (Hinweis: Personal fehlt)
  const besetzteTypen = vehicles.filter((vehicle) => vehicle.stationId && istAusreichendBesetzt(vehicle)).map((vehicle) => vehicle.type);
  const template = waehleGewichtet(templates, kontext, Math.random(),
    (vorlage) => (istVorlageErfuellbar(vorlage, besetzteTypen) ? 1 : UNBESETZT_HAEUFIGKEIT));
  if (template.verlegung) {
    // Verlegungen nie als „normalen“ Einsatz an einer Zufallsadresse erzeugen
    const einsatz = erzeugeVerlegung(template, stations, krankenhaeuser, jetzt);
    return einsatz ? { einsatz } : { fehler: 'keine-machbare-vorlage' };
  }
  const station = getBestIncidentStation(stations, template, vehicles);
  const ort = erzeugeEinsatzort(station, stations.length, template);
  return { einsatz: createSpielEinsatz(template, station, ort, jetzt) };
};
