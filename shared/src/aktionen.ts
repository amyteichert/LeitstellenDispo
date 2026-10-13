/**
 * Spieleraktionen als reine Funktionen auf dem Spielstand.
 *
 * Bisher steckten Kaufen/Bauen/Alarmieren im Client-Hook `useSpiel`. Damit Spieler-UI,
 * ein späterer Server UND der Bot exakt dieselbe Logik verwenden (keine doppelte Wahrheit),
 * liegen die Aktionen jetzt hier: Jede nimmt einen Spielstand und liefert einen neuen
 * Spielstand zurück (unveränderlich) – plus bei Bedarf eine Fehlermeldung oder eine ID.
 */
import { alarmiereFahrzeuge } from './alarmierung.js';
import {
  WACHEN_PREISE,
  getAktiveZuteilungen,
  type SpielEinsatz,
} from './daten.js';
import { getFahrzeugTyp } from './fahrzeuge.js';
import { ergaenzeKrankenhaeuser } from './krankenhaeuser.js';
import type { Spielstand } from './spielstand.js';
import type { Adresse } from './adressen.js';
import type { FinanceTransaction, MapLocation, StationKind, Vehicle } from './typen.js';
import { type Zufall } from './zufall.js';

/** Eingaben zum Bau einer neuen Wache (strukturierte Adresse optional). */
export interface NeueWacheEingabe {
  name: string;
  stationKind: StationKind;
  coords: [number, number];
  details: string;
  startFahrzeugTyp: string;
  funkrufname: string;
  adresse?: Adresse;
}

/** Kurzer Zufalls-Hex-Anteil für IDs (deterministisch, wenn ein Seed-Zufall übergeben wird). */
const zufallsHex = (zufall: Zufall, laenge = 6): string =>
  zufall().toString(16).slice(2, 2 + laenge).padEnd(laenge, '0');

/** Fügt eine Transaktion vorne an (neueste zuerst), wie bisher im Hook. */
const mitTransaktion = (
  transactions: FinanceTransaction[],
  kind: FinanceTransaction['kind'],
  label: string,
  amount: number,
  jetzt: number,
  zufall: Zufall,
): FinanceTransaction[] => [
  { id: `txn-${jetzt}-${zufallsHex(zufall)}`, kind, label, amount, createdAt: new Date(jetzt).toISOString() },
  ...transactions,
];

/** Funkrufname nach Schema „LF10-2“ (fortlaufend je Fahrzeugtyp). */
export const naechsterFunkrufname = (typ: string, vehicles: Vehicle[]): string =>
  `${typ.replace(/\s+/g, '')}-${vehicles.filter((vehicle) => vehicle.type === typ).length + 1}`;

/** Baut ein neues, voll besetztes Fahrzeug (Sollstärke laut Katalog). */
const baueFahrzeug = (
  v: Omit<Vehicle, 'id'>,
  jetzt: number,
  zufall: Zufall,
): Vehicle => ({
  ...v,
  id: `fahrzeug-${jetzt}-${zufallsHex(zufall, 4)}`,
  besatzung: v.besatzung ?? getFahrzeugTyp(v.type)?.besatzung,
  status: v.status ?? 'Einsatzbereit',
});

export type KaufErgebnis = { spielstand: Spielstand } | { fehler: string };

/** Kauft ein Fahrzeug für eine Wache. */
export const kaufeFahrzeug = (
  spielstand: Spielstand,
  stationId: string,
  typ: string,
  jetzt: number = Date.now(),
  zufall: Zufall = Math.random,
): KaufErgebnis => {
  const station = spielstand.locations.find((location) => location.id === stationId && location.type === 'station');
  const fahrzeugTyp = getFahrzeugTyp(typ);
  if (!station || !fahrzeugTyp) return { fehler: 'Wache oder Fahrzeugtyp nicht gefunden.' };
  if (fahrzeugTyp.wachenArt !== (station.stationKind ?? 'Rettungswache')) {
    return { fehler: `${typ} passt nicht zu einer ${station.stationKind ?? 'Rettungswache'}.` };
  }
  if (spielstand.balance < fahrzeugTyp.preis) {
    return { fehler: `Nicht genügend Guthaben. Benötigt: ${fahrzeugTyp.preis} €, verfügbar: ${spielstand.balance} €.` };
  }

  const fahrzeug = baueFahrzeug({
    name: typ,
    type: typ,
    stationId,
    price: fahrzeugTyp.preis,
    callsign: naechsterFunkrufname(typ, spielstand.vehicles),
  }, jetzt, zufall);

  return {
    spielstand: {
      ...spielstand,
      balance: spielstand.balance - fahrzeugTyp.preis,
      transactions: mitTransaktion(spielstand.transactions, 'Ausgabe', `${typ} für ${station.name} gekauft`, fahrzeugTyp.preis, jetzt, zufall),
      vehicles: [...spielstand.vehicles, fahrzeug],
    },
  };
};

export type WacheErgebnis = { spielstand: Spielstand; id: string } | { fehler: string };

/** Baut eine neue Wache (mit Startfahrzeug) und ergänzt bei Bedarf ein Krankenhaus in der Nähe. */
export const erstelleWache = (
  spielstand: Spielstand,
  wache: NeueWacheEingabe,
  jetzt: number = Date.now(),
  zufall: Zufall = Math.random,
): WacheErgebnis => {
  const stationPrice = WACHEN_PREISE[wache.stationKind] ?? 0;
  const vehiclePrice = getFahrzeugTyp(wache.startFahrzeugTyp)?.preis ?? 0;
  const totalCost = stationPrice + vehiclePrice;

  if (spielstand.balance < totalCost) {
    return { fehler: `Nicht genügend Guthaben für die Erstellung. Benötigt: ${totalCost} €, verfügbar: ${spielstand.balance} €.` };
  }

  const name = wache.name.trim() || 'Neuer Standort';
  const locationId = `${name.toLowerCase().replace(/\s+/g, '-')}-${jetzt}`;

  const neueWache: MapLocation = {
    id: locationId,
    name,
    type: 'station',
    stationKind: wache.stationKind,
    coords: wache.coords,
    description: wache.stationKind === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
    details: wache.details.trim() || `Frei platzierbare ${wache.stationKind}`,
    price: stationPrice,
    adresse: wache.adresse,
  };

  const vehicles = wache.startFahrzeugTyp
    ? [...spielstand.vehicles, baueFahrzeug({
        name: wache.startFahrzeugTyp,
        type: wache.startFahrzeugTyp,
        stationId: locationId,
        price: vehiclePrice,
        callsign: wache.funkrufname.trim() || naechsterFunkrufname(wache.startFahrzeugTyp, spielstand.vehicles),
      }, jetzt, zufall)]
    : spielstand.vehicles;

  return {
    id: locationId,
    spielstand: {
      ...spielstand,
      balance: spielstand.balance - totalCost,
      transactions: mitTransaktion(spielstand.transactions, 'Ausgabe', `${wache.stationKind} mit ${wache.startFahrzeugTyp} erstellt`, totalCost, jetzt, zufall),
      locations: [...spielstand.locations, neueWache],
      krankenhaeuser: ergaenzeKrankenhaeuser(spielstand.krankenhaeuser, neueWache),
      vehicles,
    },
  };
};

/** Löscht eine Wache (ohne Prüfung auf zugewiesene Fahrzeuge – das macht die UI). */
export const loescheWache = (spielstand: Spielstand, id: string): Spielstand => ({
  ...spielstand,
  locations: spielstand.locations.filter((location) => location.id !== id),
});

/** Alarmiert Fahrzeuge zu einem Einsatz (nutzt die bestehende reine Funktion `alarmiereFahrzeuge`). */
export const alarmiere = (
  spielstand: Spielstand,
  incidentId: string,
  vehicleIds: string[],
  jetzt: number = Date.now(),
): Spielstand => {
  const ergebnis = alarmiereFahrzeuge(
    { incidents: spielstand.incidents, vehicles: spielstand.vehicles, locations: spielstand.locations },
    incidentId,
    vehicleIds,
    jetzt,
  );
  return { ...spielstand, incidents: ergebnis.incidents, vehicles: ergebnis.vehicles };
};

/** Markiert die „neue Meldung“-Markierung eines Einsatzes als gelesen. */
export const markiereMeldungGelesen = (spielstand: Spielstand, incidentId: string): Spielstand => ({
  ...spielstand,
  incidents: spielstand.incidents.map((incident) => (
    incident.id === incidentId ? { ...incident, neueMeldung: false } : incident
  )),
});

/** Zählt aktive (nicht freigegebene) Fahrzeugzuteilungen über alle laufenden Einsätze. */
export const zaehleAktiveZuteilungen = (incidents: SpielEinsatz[]): number =>
  incidents
    .filter((incident) => incident.status !== 'abgeschlossen')
    .reduce((summe, incident) => summe + getAktiveZuteilungen(incident).length, 0);
