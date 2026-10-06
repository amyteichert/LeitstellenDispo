/** Typen für den Spielzustand – gemeinsam für Client und (später) Server. */
import type { Adresse } from './adressen.js';

export type LocationType = 'station' | 'incident';

export type StationKind = 'Rettungswache' | 'Feuerwache';
/** Deutscher Name für dieselbe Sache (früher doppelt definiert) */
export type WachenArt = StationKind;

export type EinsatzOrganisation = 'Rettungsdienst' | 'Feuerwehr';

export type Koordinaten = [number, number];

export type MapLocation = {
  id: string;
  name: string;
  type: LocationType;
  coords: Koordinaten;
  description: string;
  details: string;
  price?: number;
  stationKind?: StationKind; // optional: for type === 'station' specifies whether it's a Rettungswache or Feuerwache
  /** Strukturierte Adresse (z. B. aus der Adresssuche) – bestimmt Ort/PLZ der Einsätze in der Umgebung */
  adresse?: Adresse;
};

export type FinanceTransaction = {
  id: string;
  kind: 'Einnahme' | 'Ausgabe';
  label: string;
  amount: number;
  createdAt: string;
};

export type FahrzeugStatus =
  | 'Einsatzbereit'
  | 'Alarmiert / auf Anfahrt'
  | 'Im Einsatz'
  | 'Patiententransport'
  | 'Am Krankenhaus'
  | 'Rückfahrt';

/** Status nach dem Funkmeldesystem (FMS), wie er in Leitstellen üblich ist */
export const FMS_STATUS: Record<FahrzeugStatus, number> = {
  Einsatzbereit: 2,
  'Alarmiert / auf Anfahrt': 3,
  'Im Einsatz': 4,
  Patiententransport: 7,
  'Am Krankenhaus': 8,
  Rückfahrt: 1,
};

export type Vehicle = {
  id: string;
  name: string;
  type?: string;
  stationId?: string;
  price: number;
  callsign?: string; // Funkrufname
  status?: FahrzeugStatus;
  /** Vorhandene Besatzung (Personen). Nicht gesetzt = voll besetzt (ältere Spielstände) */
  besatzung?: number;
  /** Gesetzt, solange das Fahrzeug zurück zur Wache fährt (vom Einsatzort oder Krankenhaus) */
  rueckfahrt?: {
    von: Koordinaten;
    startAt: number;
    ankunftAt: number;
  };
};
