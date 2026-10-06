export const APP_NAME = 'LeitstellenDispo';
export const APP_SUBTITLE = 'Deine Leitstelle. Deine Einsätze. Deine Entscheidungen.';
export const APP_VERSION = '0.1.0-alpha';

export type UserRole = 'player' | 'admin' | 'co_owner' | 'owner';

export interface AppInfo {
  name: string;
  subtitle: string;
  version: string;
}

export interface GameLocation {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface Organization {
  id: string;
  name: string;
  type?: string;
  description?: string;
}

export interface Station {
  id: string;
  name: string;
  organizationId?: string;
  location?: GameLocation;
  description?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  organizationId?: string;
  stationId?: string;
  type?: string;
  status?: string;
  capabilities?: string[];
  description?: string;
}

export type EinsatzStatus = 'offen' | 'alarmiert' | 'in_bearbeitung' | 'abgeschlossen';

export const EINSATZ_STATUS_LABELS: Record<EinsatzStatus, string> = {
  offen: 'Offen',
  alarmiert: 'Fahrzeuge alarmiert',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
};

export type EinsatzOrganisation = 'Rettungsdienst' | 'Feuerwehr';

export type FahrzeugKategorie = 'RTW' | 'Löschfahrzeug';

export interface FahrzeugBedarf {
  id: string;
  category: FahrzeugKategorie;
  amount: number;
}

export interface AlarmiertesFahrzeug {
  vehicleId: string;
  distanceKm: number;
  etaSeconds: number;
  arrivalAt: number;
}

/** Basisdaten eines Einsatzes – so liefert ihn aktuell auch der Server. */
export interface Einsatz {
  id: string;
  stichwort: string;
  status: EinsatzStatus;
}

/** Vollständiger Einsatz, wie ihn die Spiellogik verwendet. */
export interface SpielEinsatz extends Einsatz {
  organization: EinsatzOrganisation;
  coords: [number, number];
  address: string;
  generatedByStationId: string;
  generatedByStationName: string;
  requiredVehicles: FahrzeugBedarf[];
  alarmedVehicles: AlarmiertesFahrzeug[];
  reward: number;
  durationSeconds: number;
  createdAt: number;
  processingStartedAt?: number;
  processingEndsAt?: number;
  completedAt?: number;
  totalDurationSeconds?: number;
}

export type AbgeschlossenerSpielEinsatz = SpielEinsatz & {
  completedAt: number;
  totalDurationSeconds: number;
};

export interface GameUser {
  id: string;
  username: string;
  role?: UserRole;
  organizationId?: string;
  displayName?: string;
}

export function getAppInfo(): AppInfo {
  return {
    name: APP_NAME,
    subtitle: APP_SUBTITLE,
    version: APP_VERSION,
  };
}
