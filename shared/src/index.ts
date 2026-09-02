export const APP_NAME = 'LeitstellenDispo';
export const APP_SUBTITLE = 'Deine Leitstelle. Deine Einsätze. Deine Entscheidungen.';
export const APP_VERSION = '0.1.0-alpha';

export const STATION_PRICE_BY_KIND = {
  Rettungswache: 300000,
  Feuerwache: 200000,
} as const;

export const VEHICLE_CAPACITY_BY_STATION_KIND = {
  Rettungswache: 2,
  Feuerwache: 3,
} as const;

export const getDefaultVehicleCapacity = (stationKind?: 'Rettungswache' | 'Feuerwache') =>
  VEHICLE_CAPACITY_BY_STATION_KIND[stationKind ?? 'Rettungswache'];

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

export type FmsStatus = 1 | 2 | 3 | 4 | 5 | 6;
export type OperationalFmsStatus = 1 | 2 | 3 | 4 | 6;

export const FMS_STATUS_LABELS: Record<FmsStatus, string> = {
  1: 'Einsatzbereit über Funk',
  2: 'Einsatzbereit auf Wache',
  3: 'Auftrag übernommen / Anfahrt',
  4: 'Ankunft Einsatzstelle',
  5: 'Sprechwunsch',
  6: 'Nicht einsatzbereit',
};

export const isFmsAlarmable = (status: FmsStatus, operationalStatus?: OperationalFmsStatus) =>
  status === 1 || status === 2 || (status === 5 && (operationalStatus === 1 || operationalStatus === 2));

export interface Staff {
  id: string;
  name: string;
  stationId?: string;
  qualifications: string[];
  inTraining?: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  organizationId?: string;
  stationId?: string;
  type?: string;
  status?: string;
  fmsStatus?: FmsStatus;
  speechRequest?: boolean;
  previousOperationalStatus?: OperationalFmsStatus;
  returnAt?: number;
  assignedStaffIds?: string[];
  capabilities?: string[];
  description?: string;
}

export interface Incident {
  id: string;
  title?: string;
  organizationId?: string;
  location?: GameLocation;
  type?: string;
  status?: string;
  priority?: string;
  assignedVehicleIds?: string[];
  notes?: string;
}

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
