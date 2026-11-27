/**
 * Großschadenslagen: selten, groß, mehrere Einsatzabschnitte rund um eine Schadensstelle.
 *
 * - Jeder Abschnitt ist ein normaler `SpielEinsatz` mit `grosslage` – Alarmierung, AAO, Patienten, Bewertung und
 *   Vergütung laufen also genau wie bei jedem anderen Einsatz.
 * - Welle 2: Trifft das erste Fahrzeug an irgendeinem Abschnitt ein, meldet es weitere Abschnitte (Erkundung).
 * - Sind alle Abschnitte abgearbeitet (keiner verfallen oder abgegeben), gibt es einen Abschlussbonus mit EP.
 */
import { erzeugeAdresse, ermittleOrtFuerWache } from './adressen.js';
import { fuegeMeldungenHinzu, type EinsatzGrosslage, type SpielEinsatz } from './daten.js';
import { createSpielEinsatz, erzeugeEinsatzort } from './einsatzErzeugung.js';
import { istVorlageErfuellbar } from './einsatzVerlauf.js';
import { haversineKm } from './geo.js';
import { RAENGE } from './laufbahn.js';
import { findeGrosslagenVorlage, GROSSLAGEN_VORLAGEN, type GrosslagenVorlage } from './grosslagenVorlagen.js';
import type { Koordinaten, MapLocation, StationKind, Vehicle } from './typen.js';

export * from './grosslagenVorlagen.js';

export const GROSSLAGEN_CONFIG = {
  /** Erst ab diesem Rang (Stufe) – vorher wären die Lagen kaum zu schaffen */
  abRangStufe: 4,
  /** Erst ab so vielen Wachen */
  abWachen: 3,
  /** Im Mittel eine Lage je so viel aktiver Spielzeit (zufällig, wie normale Einsätze) */
  intervallMs: 2 * 60 * 60 * 1000,
  /** Abstand der Abschnitte vom Mittelpunkt der Schadensstelle */
  abstandKm: 0.45,
} as const;

const AB_XP = RAENGE.find((rang) => rang.stufe === GROSSLAGEN_CONFIG.abRangStufe)?.abXp ?? 0;

/** Läuft gerade eine Großschadenslage? (höchstens eine gleichzeitig) */
export const hatLaufendeGrosslage = (incidents: Pick<SpielEinsatz, 'grosslage' | 'status'>[]) =>
  incidents.some((einsatz) => einsatz.grosslage && einsatz.status !== 'abgeschlossen');

/** Dürfen beim Spieler grundsätzlich Großschadenslagen entstehen? */
export const darfGrosslageEntstehen = (xp: number, wachen: number, incidents: Pick<SpielEinsatz, 'grosslage' | 'status'>[]) =>
  xp >= AB_XP && wachen >= GROSSLAGEN_CONFIG.abWachen && !hatLaufendeGrosslage(incidents);

/** Lagen, deren Abschnitte (alle Wellen) der Spieler mit seinen stationierten Fahrzeugen schaffen kann */
export const getMachbareGrosslagen = (vehicles: Vehicle[]): GrosslagenVorlage[] => {
  const fahrzeugTypen = vehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
  return GROSSLAGEN_VORLAGEN.filter((lage) => lage.abschnitte.every((a) => istVorlageErfuellbar(a.vorlage, fahrzeugTypen)));
};

const WACHE_FUER: Record<SpielEinsatz['organization'], StationKind> = {
  Rettungsdienst: 'Rettungswache',
  Feuerwehr: 'Feuerwache',
};

/** Zuständige Wache eines Abschnitts: die nächste Wache der passenden Art (sonst die nächste überhaupt) */
const zustaendigeWache = (stations: MapLocation[], coords: Koordinaten, organisation: SpielEinsatz['organization']) => {
  const passend = stations.filter((station) => (station.stationKind ?? 'Rettungswache') === WACHE_FUER[organisation]);
  const kandidaten = passend.length > 0 ? passend : stations;
  return kandidaten.reduce((naechste, wache) =>
    (haversineKm(wache.coords, coords) < haversineKm(naechste.coords, coords) ? wache : naechste));
};

/** Position des Abschnitts `index` von `anzahl` rund um den Mittelpunkt (der erste liegt in der Mitte) */
export const abschnittsPosition = (zentrum: Koordinaten, index: number, anzahl: number): Koordinaten => {
  if (index === 0) return zentrum;
  const winkel = ((index - 1) / Math.max(1, anzahl - 1)) * Math.PI * 2;
  const km = GROSSLAGEN_CONFIG.abstandKm;
  return [
    zentrum[0] + (km / 111.32) * Math.cos(winkel),
    zentrum[1] + (km / (111.32 * Math.cos((zentrum[0] * Math.PI) / 180))) * Math.sin(winkel),
  ];
};

/** Erzeugt die Abschnitte einer Welle als normale Einsätze */
const erzeugeWelle = (
  lage: GrosslagenVorlage,
  welle: 1 | 2,
  basis: Omit<EinsatzGrosslage, 'abschnitt' | 'welle'>,
  stations: MapLocation[],
  ortsWache: MapLocation,
  jetzt: number,
  zufall: () => number,
): SpielEinsatz[] => {
  const ort = ermittleOrtFuerWache(ortsWache);
  return lage.abschnitte.flatMap((abschnitt, index) => {
    if (abschnitt.welle !== welle) return [];
    const coords = abschnittsPosition(basis.zentrum, index, lage.abschnitte.length);
    const wache = zustaendigeWache(stations, coords, abschnitt.vorlage.organization);
    const adresse = erzeugeAdresse(ort, abschnitt.vorlage.ortsArt ?? lage.ortsArt, zufall);
    const einsatz = createSpielEinsatz(abschnitt.vorlage, wache, { coords, adresse }, jetzt);
    return [{ ...einsatz, grosslage: { ...basis, abschnitt: abschnitt.name, welle } }];
  });
};

/**
 * Neue Großschadenslage an einer zufälligen Wache: liefert die Abschnitte der ersten Welle.
 * `null`, wenn der Spieler keine Lage komplett schaffen kann.
 */
export function erzeugeGrosslage(
  locations: MapLocation[],
  vehicles: Vehicle[],
  jetzt: number = Date.now(),
  zufall: () => number = Math.random,
  vorlageId?: string,
): SpielEinsatz[] | null {
  const stations = locations.filter((location) => location.type === 'station');
  const machbar = getMachbareGrosslagen(vehicles).filter((lage) => !vorlageId || lage.id === vorlageId);
  if (stations.length === 0 || machbar.length === 0) return null;
  const lage = machbar[Math.floor(zufall() * machbar.length)];
  const wache = stations[Math.floor(zufall() * stations.length)];
  const { coords: zentrum } = erzeugeEinsatzort(wache, stations.length, lage, zufall);
  const basis = { id: `grosslage-${jetzt}-${Math.floor(zufall() * 1e9).toString(16)}`, vorlageId: lage.id, name: lage.name, zentrum };
  return erzeugeWelle(lage, 1, basis, stations, wache, jetzt, zufall);
}

/** Ergebnis einer beendeten Lage – Bonus und EP gibt es nur, wenn sie vollständig abgearbeitet wurde */
export interface GrosslageBeendet {
  id: string;
  name: string;
  zentrum: Koordinaten;
  vollstaendig: boolean;
  bonus: number;
  xp: number;
}

export interface GrosslagenPruefung {
  /** Laufende Einsätze inkl. neu entstandener Abschnitte (Welle 2) */
  incidents: SpielEinsatz[];
  /** Neu entstandene Abschnitte – für Adresssuche und Hinweise */
  neu: SpielEinsatz[];
  beendet: GrosslageBeendet[];
}

/**
 * Nach einem Spiel-Tick: Welle 2 auslösen, Ausfälle merken, beendete Lagen melden.
 * `abgeschlossen` und `verfallen` sind die Einsätze, die in diesem Tick weggefallen sind.
 */
export function pruefeGrosslagen(
  incidents: SpielEinsatz[],
  abgeschlossen: SpielEinsatz[],
  verfallen: SpielEinsatz[],
  locations: MapLocation[],
): GrosslagenPruefung {
  const alle = [...incidents, ...abgeschlossen, ...verfallen];
  const lagenIds = [...new Set(alle.map((einsatz) => einsatz.grosslage?.id).filter((id): id is string => !!id))];
  if (lagenIds.length === 0) return { incidents, neu: [], beendet: [] };

  const stations = locations.filter((location) => location.type === 'station');
  let laufend = incidents;
  const neu: SpielEinsatz[] = [];
  const beendet: GrosslageBeendet[] = [];

  for (const lagenId of lagenIds) {
    const teile = alle.filter((einsatz) => einsatz.grosslage?.id === lagenId);
    const info = teile[0].grosslage!;
    const vorlage = findeGrosslagenVorlage(info.vorlageId);
    const hatWelle2 = vorlage?.abschnitte.some((a) => a.welle === 2) ?? false;
    let welle2 = teile.some((einsatz) => einsatz.grosslage?.welle2);
    const unvollstaendig = teile.some((einsatz) => einsatz.grosslage?.unvollstaendig)
      || verfallen.some((einsatz) => einsatz.grosslage?.id === lagenId);

    // Erkundung: Das erste Fahrzeug an der Schadensstelle meldet die weiteren Abschnitte
    const ersteAnkunft = Math.min(...teile.map((einsatz) => einsatz.erstesEintreffenAt ?? Infinity));
    let welle2Neu: SpielEinsatz[] = [];
    if (vorlage && hatWelle2 && !welle2 && Number.isFinite(ersteAnkunft) && stations.length > 0) {
      const ortsWache = stations.find((station) => station.id === teile[0].generatedByStationId) ?? stations[0];
      welle2Neu = erzeugeWelle(vorlage, 2, { id: info.id, vorlageId: info.vorlageId, name: info.name, zentrum: info.zentrum },
        stations, ortsWache, ersteAnkunft, Math.random)
        .map((einsatz) => ({
          ...einsatz,
          grosslage: { ...einsatz.grosslage!, welle2: true, ...(unvollstaendig ? { unvollstaendig } : {}) },
          neueMeldung: true,
          meldungen: [{ zeit: ersteAnkunft, text: `Erkundung ${info.name}: neuer Einsatzabschnitt „${einsatz.grosslage!.abschnitt}“ gebildet.`, art: 'lage' as const }],
        }));
      neu.push(...welle2Neu);
      welle2 = true;
    }

    // Merkmale an alle laufenden Abschnitte weitergeben (abgeschlossene Abschnitte sind schon weg)
    laufend = laufend.map((einsatz) => {
      if (einsatz.grosslage?.id !== lagenId) return einsatz;
      if (!!einsatz.grosslage.welle2 === welle2 && !!einsatz.grosslage.unvollstaendig === unvollstaendig) return einsatz;
      const meldungen = welle2Neu.length > 0 && einsatz.erstesEintreffenAt === ersteAnkunft
        ? fuegeMeldungenHinzu(einsatz.meldungen, [{
          zeit: ersteAnkunft,
          text: `Lage größer als gemeldet – weitere Abschnitte: ${welle2Neu.map((e) => e.grosslage!.abschnitt).join(', ')}.`,
          art: 'lage',
        }])
        : einsatz.meldungen;
      return { ...einsatz, meldungen, grosslage: { ...einsatz.grosslage, welle2, unvollstaendig } };
    });

    // Beendet: kein Abschnitt läuft mehr, und es kommt auch keiner mehr nach
    const nochOffen = laufend.some((einsatz) => einsatz.grosslage?.id === lagenId) || welle2Neu.length > 0;
    const endeteJetzt = teile.some((einsatz) => abgeschlossen.includes(einsatz) || verfallen.includes(einsatz));
    if (!nochOffen && endeteJetzt && (welle2 || !hatWelle2 || unvollstaendig)) {
      const vollstaendig = !unvollstaendig && !!vorlage;
      beendet.push({
        id: lagenId,
        name: info.name,
        zentrum: info.zentrum,
        vollstaendig,
        bonus: vollstaendig ? vorlage!.bonus : 0,
        xp: vollstaendig ? vorlage!.xp : 0,
      });
    }
  }

  return { incidents: [...neu, ...laufend], neu, beendet };
}

/** Fortschritt einer laufenden Lage für die Anzeige */
export interface GrosslagenStand {
  id: string;
  name: string;
  beschreibung?: string;
  /** Laufende Abschnitte */
  offen: number;
  /** Abschnitte insgesamt (inkl. der noch nicht erkundeten) */
  gesamt: number;
  /** Welle 2 steht noch aus */
  erkundungAusstehend: boolean;
  zentrum: Koordinaten;
}

export function getGrosslagenStaende(incidents: Pick<SpielEinsatz, 'grosslage' | 'status'>[]): GrosslagenStand[] {
  const staende = new Map<string, GrosslagenStand>();
  for (const einsatz of incidents) {
    const info = einsatz.grosslage;
    if (!info || einsatz.status === 'abgeschlossen') continue;
    const vorlage = findeGrosslagenVorlage(info.vorlageId);
    const stand = staende.get(info.id) ?? {
      id: info.id,
      name: info.name,
      beschreibung: vorlage?.beschreibung,
      offen: 0,
      gesamt: vorlage?.abschnitte.length ?? 0,
      erkundungAusstehend: !info.welle2 && (vorlage?.abschnitte.some((a) => a.welle === 2) ?? false),
      zentrum: info.zentrum,
    };
    stand.offen += 1;
    stand.gesamt = Math.max(stand.gesamt, stand.offen);
    staende.set(info.id, stand);
  }
  return [...staende.values()];
}
