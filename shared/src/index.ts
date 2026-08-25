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

export type StationKind = 'Rettungswache' | 'Feuerwache';
export type VehicleCategory = 'RTW' | 'Löschfahrzeug';

export interface VehicleTypeSpec {
  type: string;
  stationKinds: readonly StationKind[];
  category: VehicleCategory;
  regularCrew: number;
  maxCrew: number;
  waterLiters: number;
  foamLiters?: number;
  pumpOutputLitersPerMinute: number;
  tags: readonly string[];
  notes?: string;
}

export const VEHICLE_TYPE_SPECS = [
  {
    type: 'LF 10',
    stationKinds: ['Feuerwache'],
    category: 'Löschfahrzeug',
    regularCrew: 9,
    maxCrew: 9,
    waterLiters: 1000,
    foamLiters: 120,
    pumpOutputLitersPerMinute: 1000,
    tags: ['Brandeinsatz', 'Wasserversorgung', 'Grundschutz'],
    notes: 'Typische DIN-/Aufbauwerte; je nach Hersteller und Beladung leicht abweichend.',
  },
  {
    type: 'LF 20',
    stationKinds: ['Feuerwache'],
    category: 'Löschfahrzeug',
    regularCrew: 9,
    maxCrew: 9,
    waterLiters: 1600,
    foamLiters: 120,
    pumpOutputLitersPerMinute: 2000,
    tags: ['Brandeinsatz', 'Wasserversorgung', 'Schaumeinsatz', 'Grundschutz'],
    notes: 'Typische Normwerte; Aufbau- und Pumpenvarianten sind möglich.',
  },
  {
    type: 'TLF 2000',
    stationKinds: ['Feuerwache'],
    category: 'Löschfahrzeug',
    regularCrew: 3,
    maxCrew: 6,
    waterLiters: 2000,
    foamLiters: 120,
    pumpOutputLitersPerMinute: 1000,
    tags: ['Erstangriff', 'Waldbrand', 'Wasservorhalt', 'Schaumeinsatz'],
    notes: 'Typische Werte; Besatzung und Schaumausrüstung können je nach Aufbau variieren.',
  },
  {
    type: 'TLF 3000',
    stationKinds: ['Feuerwache'],
    category: 'Löschfahrzeug',
    regularCrew: 3,
    maxCrew: 6,
    waterLiters: 3000,
    foamLiters: 120,
    pumpOutputLitersPerMinute: 1000,
    tags: ['Erstangriff', 'Waldbrand', 'Wasservorhalt', 'Schaumeinsatz'],
    notes: 'Typische Werte; TLF 3000 werden sehr unterschiedlich aufgebaut und bestückt.',
  },
  {
    type: 'TLF 4000',
    stationKinds: ['Feuerwache'],
    category: 'Löschfahrzeug',
    regularCrew: 3,
    maxCrew: 6,
    waterLiters: 4000,
    pumpOutputLitersPerMinute: 1000,
    tags: ['Großwasservorrat', 'Erstangriff', 'Waldbrand', 'Wasserförderung'],
    notes: 'Wasserleistung ist typisch; Schaummittel und Zusatzbeladung variieren stark je nach Aufbau.',
  },
] as const satisfies readonly VehicleTypeSpec[];

export function getVehicleTypeSpec(type?: string): VehicleTypeSpec | undefined {
  if (!type) return undefined;
  return VEHICLE_TYPE_SPECS.find((spec) => spec.type === type);
}

export function getVehicleCategory(type?: string): VehicleCategory | null {
  if (!type) return null;
  if (type === 'RTW') return 'RTW';
  return getVehicleTypeSpec(type)?.category ?? null;
}

export function getVehicleTypeSpecsForStationKind(stationKind: StationKind): VehicleTypeSpec[] {
  return VEHICLE_TYPE_SPECS.filter((spec) => spec.stationKinds.some((kind) => kind === stationKind));
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
