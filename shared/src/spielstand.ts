/**
 * Spielstand: Aufbau, Startzustand und Migration älterer Versionen.
 * Reine Funktionen – der Client speichert im Browser, ein Server könnte dasselbe Format nutzen.
 */
import { erzeugeAdresse, ermittleOrtFuerWache, formatAdresse } from './adressen.js';
import {
  START_GUTHABEN,
  findeEinsatzVorlage,
  type AbgeschlossenerSpielEinsatz,
  type SpielEinsatz,
} from './daten.js';
import type { Krankenhaus } from './krankenhaeuser.js';
import { erzeugePatienten } from './patienten.js';
import { RUF_CONFIG } from './bewertung.js';
import { erzeugeBesatzungFuer, synchronisiereBesatzung, type Mitarbeiter } from './personal.js';
import type { FunkSpruch } from './funk.js';
import { getFehlendeQualifikationen, type Qualifikation } from './fahrzeuge.js';
import type { FinanceTransaction, MapLocation, Vehicle } from './typen.js';

/** Wird erhöht, wenn sich der Aufbau des Spielstands ändert (ältere Versionen werden migriert). */
export const SPIELSTAND_VERSION = 5;

/** Alles, was zum Fortsetzen eines Spiels gespeichert werden muss. */
export interface Spielstand {
  version: number;
  gespeichertAm: string;
  balance: number;
  transactions: FinanceTransaction[];
  locations: MapLocation[];
  vehicles: Vehicle[];
  incidents: SpielEinsatz[];
  completedIncidentHistory: AbgeschlossenerSpielEinsatz[];
  krankenhaeuser: Krankenhaus[];
  /** Ruf der Leitstelle (0–100) – fehlt bei älteren Spielständen */
  ruf?: number;
  /** Personal aller Wachen – fehlt bei älteren Spielständen (wird dann für alle Fahrzeuge erzeugt) */
  personal?: Mitarbeiter[];
  /** Funkverkehr (neueste zuerst) – fehlt bei älteren Spielständen */
  funk?: FunkSpruch[];
}

export const START_WACHEN: MapLocation[] = [
  {
    id: 'rettungswache-zentrum',
    name: 'Rettungswache Zentrum',
    type: 'station',
    stationKind: 'Rettungswache',
    coords: [48.775, 9.1771],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
    price: 0,
    adresse: { strasse: 'Rotebühlplatz', plz: '70173', ort: 'Stuttgart' },
  },
  {
    id: 'rettungswache-sued',
    name: 'Rettungswache Süd',
    type: 'station',
    stationKind: 'Rettungswache',
    coords: [48.7692, 9.1931],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
    price: 0,
    adresse: { strasse: 'Hohenheimer Straße', plz: '70184', ort: 'Stuttgart' },
  },
];

/** Startzustand für ein neues Spiel: zwei Rettungswachen mit einem RTW, Krankenhäuser und Startguthaben. */
export const createNeuesSpiel = (jetzt: Date = new Date()): Spielstand => ergaenzePersonal({
  version: SPIELSTAND_VERSION,
  gespeichertAm: jetzt.toISOString(),
  balance: START_GUTHABEN,
  transactions: [
    { id: 'initial-balance', kind: 'Einnahme', label: 'Startguthaben', amount: START_GUTHABEN, createdAt: jetzt.toISOString() },
  ],
  // Man startet ohne Wache: Die erste Wache (mit Startfahrzeug und Besatzung) baut man selbst
  locations: [],
  vehicles: [],
  incidents: [],
  completedIncidentHistory: [],
  // Krankenhäuser gibt es nur, wenn der Spieler eigene baut
  krankenhaeuser: [],
  ruf: RUF_CONFIG.start,
});

/** Spielstände ohne Personal: Jedes Fahrzeug bekommt eine volle Besatzung (inkl. Pflicht-Qualifikation). */
function ergaenzePersonal(spielstand: Spielstand): Spielstand {
  const personal = Array.isArray(spielstand.personal)
    ? spielstand.personal
    : spielstand.vehicles.flatMap((vehicle) => erzeugeBesatzungFuer(vehicle));
  return { ...spielstand, personal, vehicles: synchronisiereBesatzung(spielstand.vehicles, personal) };
}


/** Seit Version 5 neu verlangte Qualifikationen (HLF/RW: Technische Hilfe, KTW: Rettungssanitäter) */
const NEUE_PFLICHT_QUALIFIKATIONEN: Qualifikation[] = ['technische_hilfe', 'rettungssanitaeter'];

/**
 * Version 4 → 5 (Bestandsschutz): Vorhandene Fahrzeuge sollen nach dem Update einsatzbereit bleiben.
 * Fehlt der Besatzung eine der neu verlangten Qualifikationen, bekommt sie eine Person geschenkt.
 */
export function gibNeuePflichtQualifikationen(spielstand: Spielstand): Spielstand {
  let personal = spielstand.personal ?? [];
  for (const vehicle of spielstand.vehicles) {
    const besatzung = personal.filter((person) => person.fahrzeugId === vehicle.id);
    const fehlend = getFehlendeQualifikationen(vehicle.type, besatzung).filter((q) => NEUE_PFLICHT_QUALIFIKATIONEN.includes(q));
    fehlend.forEach((qualifikation, index) => {
      const person = besatzung[index % Math.max(1, besatzung.length)];
      if (!person) return;
      personal = personal.map((p) => (p.id === person.id ? { ...p, qualifikationen: [...p.qualifikationen, qualifikation] } : p));
    });
  }
  return { ...spielstand, personal, vehicles: synchronisiereBesatzung(spielstand.vehicles, personal) };
}

/** Version 2 → 3: Adressen, Patienten und Krankenhäuser nachrüsten. */
const migriereV2 = (alt: Omit<Spielstand, 'krankenhaeuser'>): Spielstand => {
  const locations = alt.locations.map((location) => {
    const start = START_WACHEN.find((wache) => wache.id === location.id);
    return start && !location.adresse ? { ...location, adresse: start.adresse } : location;
  });
  const incidents = alt.incidents.map((incident): SpielEinsatz => {
    let ergebnis = incident;
    if (!ergebnis.adresse) {
      const wache = locations.find((location) => location.id === incident.generatedByStationId);
      // Wache gelöscht? Dann den Ort über die Einsatzkoordinaten bestimmen
      const adresse = erzeugeAdresse(ermittleOrtFuerWache(wache ?? { name: incident.generatedByStationName, coords: incident.coords, details: '' }));
      ergebnis = { ...ergebnis, adresse, address: formatAdresse(adresse) };
    }
    if (!ergebnis.patienten) {
      const patienten = erzeugePatienten(findeEinsatzVorlage(incident.vorlageId)?.patienten, incident.id);
      ergebnis = {
        ...ergebnis,
        patienten: patienten.map((patient) => (incident.status === 'in_bearbeitung' ? { ...patient, status: 'in_behandlung' } : patient)),
      };
    }
    // Laufende Einsätze sollen beim ersten Tick keine verspätete „Erstmeldung“ bekommen
    if (ergebnis.erstesEintreffenAt === undefined && incident.status === 'in_bearbeitung') {
      ergebnis = { ...ergebnis, erstesEintreffenAt: incident.processingStartedAt };
    }
    return ergebnis;
  });
  return {
    ...alt,
    version: SPIELSTAND_VERSION,
    locations,
    incidents,
    krankenhaeuser: [],
  };
};

/**
 * Nur eigene Krankenhäuser bleiben: Früher gab es vorgegebene Stuttgarter Häuser und automatisch
 * angelegte „Klinikum <Ort>“ – beides fällt beim Laden weg.
 */
const nurEigene = (krankenhaeuser: unknown): Krankenhaus[] =>
  (Array.isArray(krankenhaeuser) ? (krankenhaeuser as Krankenhaus[]) : []).filter((krankenhaus) => krankenhaus.eigen);

/**
 * Prüft und migriert einen geladenen Spielstand.
 * Liefert null, wenn er unbrauchbar oder von einer unbekannten Version ist.
 */
export function migriereSpielstand(roh: unknown): Spielstand | null {
  if (!roh || typeof roh !== 'object') return null;
  const spielstand = roh as Spielstand;
  if (!Array.isArray(spielstand.locations) || !Array.isArray(spielstand.vehicles) || !Array.isArray(spielstand.incidents)) return null;

  const ruf = typeof spielstand.ruf === 'number' ? spielstand.ruf : RUF_CONFIG.start;
  if (spielstand.version === 2) return gibNeuePflichtQualifikationen(ergaenzePersonal(entferneStartwachen({ ...migriereV2(spielstand), ruf })));
  if (spielstand.version === 3) return gibNeuePflichtQualifikationen(ergaenzePersonal(entferneStartwachen({ ...spielstand, version: SPIELSTAND_VERSION, ruf, krankenhaeuser: nurEigene(spielstand.krankenhaeuser) })));
  if (spielstand.version === 4) {
    return gibNeuePflichtQualifikationen(ergaenzePersonal({
      ...spielstand,
      version: SPIELSTAND_VERSION,
      krankenhaeuser: nurEigene(spielstand.krankenhaeuser),
      ruf,
    }));
  }
  if (spielstand.version !== SPIELSTAND_VERSION) return null;
  return ergaenzePersonal({
    ...spielstand,
    krankenhaeuser: nurEigene(spielstand.krankenhaeuser),
    ruf,
  });
}

/**
 * Version 3 → 4: Die früher geschenkten Start-Wachen (Stuttgart) samt Fahrzeugen, Personal und ihren Einsätzen entfernen.
 * Seit Version 4 baut jeder seine erste Wache selbst.
 */
export function entferneStartwachen(spielstand: Spielstand): Spielstand {
  const ids = new Set(START_WACHEN.map((wache) => wache.id));
  if (!spielstand.locations.some((location) => ids.has(location.id))) return spielstand;
  const fahrzeugIds = new Set(spielstand.vehicles.filter((v) => v.stationId && ids.has(v.stationId)).map((v) => v.id));
  return {
    ...spielstand,
    locations: spielstand.locations.filter((location) => !ids.has(location.id)),
    vehicles: spielstand.vehicles.filter((v) => !fahrzeugIds.has(v.id)),
    personal: spielstand.personal?.filter((p) => !ids.has(p.wacheId)),
    incidents: spielstand.incidents
      .filter((e) => !ids.has(e.generatedByStationId) && !e.alarmedVehicles.some((a) => fahrzeugIds.has(a.vehicleId))),
  };
}
