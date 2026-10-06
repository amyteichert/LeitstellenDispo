/** Typen für den Spielzustand – gemeinsam für Client und (später) Server. */

export type LocationType = 'station' | 'incident';

export type StationKind = 'Rettungswache' | 'Feuerwache';

export type MapLocation = {
  id: string;
  name: string;
  type: LocationType;
  coords: [number, number];
  description: string;
  details: string;
  price?: number;
  stationKind?: StationKind; // optional: for type === 'station' specifies whether it's a Rettungswache or Feuerwache
};

export type FinanceTransaction = {
  id: string;
  kind: 'Einnahme' | 'Ausgabe';
  label: string;
  amount: number;
  createdAt: string;
};

export type Vehicle = {
  id: string;
  name: string;
  type?: string;
  stationId?: string;
  price: number;
  callsign?: string; // Funkrufname
  status?: 'Einsatzbereit' | 'Alarmiert / auf Anfahrt' | 'Im Einsatz' | 'Rückfahrt';
  /** Gesetzt, solange das Fahrzeug vom Einsatzort zurück zur Wache fährt */
  rueckfahrt?: {
    von: [number, number];
    startAt: number;
    ankunftAt: number;
  };
};
